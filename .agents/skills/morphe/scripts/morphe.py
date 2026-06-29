#!/usr/bin/env python3
"""
morphe.py — Morphe deploy helper (auth + presign + upload + checksum + deploy).

Handles the deterministic, error-prone parts of deploying a built web project
to the Morphe service. Three frameworks are supported, all producing a zip whose
root is a `server.js` that the runtime starts with `node server.js`:
  * Next.js — the standalone server (.next/standalone/server.js) plus its traced
    node_modules; packaging prunes wrong-platform native bindings & repairs pnpm.
  * Bigfish (@alipay/bigfish) — a static/SPA build (dist/); packaging generates a
    zero-dependency static server.js wrapper that serves dist/ with SPA fallback.
  * Vite — two modes. A pure SPA (vite build → dist/, no server) reuses the same
    zero-dependency static wrapper as Bigfish. A custom-server app (a server.ts/js
    that serves dist/ AND backend API routes) is esbuild-bundled into a
    self-contained server.js at the zip root, with the build dir alongside it.
The detection / config fixing / build steps are handled by Claude per SKILL.md;
this script owns the API orchestration so it is reliable and consistent.

Subcommands:
  check-auth                 Exit 0 if logged in (accessToken present), else 1.
  login --username U --password P
                             Call /api/user/login, save accessToken to
                             ~/.morphe/auth.json. Exit 0 on success.
  detect-framework [--project-root DIR]
                             Print the detected framework (nextjs | bigfish |
                             vite) or "unknown". Exit 0 if recognized, else 1.
  set-function-name [--name NAME] [--project-root DIR]
                             Resolve & persist function_name in .morphe.json.
                             --name given -> use it; else keep existing; else
                             generate user-xxxxxxxx. Prints the final name.
  package [--project-root DIR] [--out code.zip]
          [--framework auto|nextjs|bigfish|vite] [--static-dir DIR]
          [--server-entry auto|PATH] [--external NAME ...]
                             Assemble a minimal RUNNABLE zip for the detected
                             framework. nextjs: copy static/public, repair pnpm
                             partial packages, prune non-linux-x64-gnu native
                             bindings & symlink the kept ones to top level, zip
                             with symlinks preserved (-y). bigfish: stage a
                             generated static server.js + the build output dir,
                             then zip. vite: SPA → same static wrapper as bigfish;
                             custom-server (--server-entry, auto-probed) →
                             esbuild-bundle the entry to server.js (vite always
                             external) + build dir, then zip. Writes the zip
                             OUTSIDE the source dir so it never nests itself.
  deploy --zip PATH [--project-root DIR] [--keep-zip]
                             presign -> PUT upload -> crc64 -> update
                             .morphe.json (checksum + function_name) -> /api/deploy.
                             Prints the deploy result as JSON on stdout. Deletes
                             the local zip on success (--keep-zip to keep it).

Notes:
  * Base URL defaults to https://morphe.zenmux.app, override with MORPHE_BASE_URL.
  * The OpenAPI spec advertises cookie auth (morphe_session) but login returns
    an accessToken. Authenticated requests send the token BOTH as the
    morphe_session cookie AND as an Authorization: Bearer header for robustness.
  * No third-party Python deps. Both the JSON API calls and the large-file OSS
    upload use urllib (the upload is streamed from disk via a PUT request).
"""

import argparse
import json
import os
import random
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = os.environ.get("MORPHE_BASE_URL", "https://morphe.zenmux.app").rstrip("/")
AUTH_PATH = Path.home() / ".morphe" / "auth.json"

# Cloudflare (error 1010) bans the default Python-urllib User-Agent, so present a
# browser-like one on every request.
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


# ----------------------------- auth storage -----------------------------------

def read_access_token():
    try:
        data = json.loads(AUTH_PATH.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return None
    token = data.get("accessToken")
    return token if token else None


def save_auth(payload):
    AUTH_PATH.parent.mkdir(parents=True, exist_ok=True)
    AUTH_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    try:
        os.chmod(AUTH_PATH, 0o600)
    except OSError:
        pass


# ----------------------------- HTTP helpers -----------------------------------

def api_post(path, body, token=None):
    """POST JSON to {BASE_URL}/api{path}; returns parsed JSON dict.

    Raises RuntimeError with a readable message on non-2xx.
    """
    url = f"{BASE_URL}/api{path}"
    data = json.dumps(body).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
        headers["Cookie"] = f"morphe_session={token}"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        raise RuntimeError(f"POST {path} failed: HTTP {e.code} {detail}") from None
    except urllib.error.URLError as e:
        raise RuntimeError(f"POST {path} failed: {e.reason}") from None


def http_put_file(url, file_path, content_type):
    """PUT a file to a presigned URL, streaming it from disk.

    The file object is passed as the request body so urllib streams it instead
    of reading the whole (often 20M+) zip into memory; Content-Length is set
    explicitly because OSS rejects a chunked/identity PUT without it.
    Raises RuntimeError on non-2xx or transport error.
    """
    file_path = Path(file_path)
    size = file_path.stat().st_size
    headers = {
        "Content-Type": content_type,
        "Content-Length": str(size),
        "User-Agent": USER_AGENT,
    }
    with open(file_path, "rb") as f:
        req = urllib.request.Request(url, data=f, headers=headers, method="PUT")
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                resp.read()
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")
            raise RuntimeError(f"HTTP {e.code} {detail}") from None
        except urllib.error.URLError as e:
            raise RuntimeError(str(e.reason)) from None


# ----------------------------- CRC64 (ECMA / xz) ------------------------------
# Aliyun OSS uses CRC-64/XZ: poly 0x42F0E1EBA9EA3693, reflected, init/xorout all-ones.

_CRC64_POLY = 0x42F0E1EBA9EA3693


def _reflect(value, width):
    result = 0
    for i in range(width):
        if value & (1 << i):
            result |= 1 << (width - 1 - i)
    return result


def _build_crc64_table():
    table = []
    rpoly = _reflect(_CRC64_POLY, 64)
    for b in range(256):
        crc = b
        for _ in range(8):
            crc = (crc >> 1) ^ (rpoly if (crc & 1) else 0)
        table.append(crc)
    return table


_CRC64_TABLE = _build_crc64_table()


def crc64_ecma(path):
    """Return the CRC-64/XZ checksum of a file as an unsigned decimal string
    (the form Aliyun OSS reports in x-oss-hash-crc64ecma)."""
    crc = 0xFFFFFFFFFFFFFFFF
    with open(path, "rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            for byte in chunk:
                crc = _CRC64_TABLE[(crc ^ byte) & 0xFF] ^ (crc >> 8)
    crc ^= 0xFFFFFFFFFFFFFFFF
    return str(crc & 0xFFFFFFFFFFFFFFFF)


# ----------------------------- .morphe.json -----------------------------------

def gen_function_name():
    alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
    return "user-" + "".join(random.choice(alphabet) for _ in range(8))


def load_morphe_json(project_root):
    path = project_root / ".morphe.json"
    if path.exists():
        try:
            return json.loads(path.read_text())
        except json.JSONDecodeError:
            return {}
    return {}


def save_morphe_json(project_root, data):
    path = project_root / ".morphe.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))


# ----------------------------- framework detection ---------------------------

def _load_package_json(project_root):
    try:
        return json.loads((project_root / "package.json").read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def detect_framework(project_root):
    """Return 'nextjs', 'bigfish', 'vite', or None.

    Order matters. Bigfish is checked first: a Bigfish project also has next-like
    build scripts AND depends on vite-style tooling, but is distinguished by the
    @alipay/bigfish dependency / config/config.ts. Next.js is checked before Vite
    (a Next project can list vite as a transitive/dev dep). Vite is the broadest,
    so it is last.
    """
    pkg = _load_package_json(project_root)
    deps = {}
    for key in ("dependencies", "devDependencies"):
        deps.update(pkg.get(key) or {})

    if "@alipay/bigfish" in deps or (project_root / "config" / "config.ts").exists():
        return "bigfish"

    next_configs = ("next.config.js", "next.config.mjs", "next.config.ts")
    if "next" in deps or any((project_root / c).exists() for c in next_configs):
        return "nextjs"

    vite_configs = ("vite.config.js", "vite.config.mjs", "vite.config.ts",
                    "vite.config.mts", "vite.config.cjs")
    if "vite" in deps or any((project_root / c).exists() for c in vite_configs):
        return "vite"

    return None


# ----------------------------- subcommands ------------------------------------

def cmd_check_auth(_args):
    if read_access_token():
        print("logged-in")
        return 0
    print("not-logged-in", file=sys.stderr)
    return 1


def cmd_login(args):
    resp = api_post("/user/login", {
        "username": args.username,
        "password": args.password,
        "rememberMe": True,
    })
    token = resp.get("accessToken")
    if not resp.get("success") or not token:
        print(f"Login failed: {json.dumps(resp, ensure_ascii=False)}", file=sys.stderr)
        return 1
    save_auth({"accessToken": token, "user": resp.get("user")})
    print(f"Login OK, token saved to {AUTH_PATH}")
    return 0


def cmd_detect_framework(args):
    project_root = Path(args.project_root).resolve()
    fw = detect_framework(project_root)
    if fw:
        print(fw)
        return 0
    print("unknown", file=sys.stderr)
    return 1


def cmd_set_function_name(args):
    project_root = Path(args.project_root).resolve()
    morphe = load_morphe_json(project_root)
    name = (args.name or "").strip()
    if name:
        morphe["function_name"] = name
    elif not morphe.get("function_name"):
        morphe["function_name"] = gen_function_name()
    save_morphe_json(project_root, morphe)
    print(morphe["function_name"])
    return 0


# ----------------------------- packaging --------------------------------------
# Assemble .next/standalone into a minimal, RUNNABLE code.zip. This owns
# the error-prone mechanics that otherwise cause runtime 500s or a bloated zip:
#
#   1. Self-nesting: zipping INSIDE .next/standalone captures a previous code.zip
#      into the new one (+hundreds of MB, grows each redeploy). We always write
#      the zip OUTSIDE the dir and delete any stale copy first.
#   2. Static + public assets are NOT traced by `next build` — copy them in.
#   3. pnpm partial-package bug: the tracer copies a top-level node_modules/<pkg>
#      with ONLY package.json while the real files live under .pnpm; that stub
#      SHADOWS the real copy and crashes `node server.js` (e.g. @swc/helpers).
#      We overlay the full .pnpm contents onto every such stub.
#   4. Native bindings: resvg/sharp resolve their binary with a bare
#      `require("<pkg>-linux-x64-gnu")` satisfied by walking UP to top-level
#      node_modules. A macOS build only links the DARWIN binding there, so the
#      linux one is missing at runtime → "Cannot find module ...-linux-x64-gnu" (and
#      SVG works while PNG 500s). We symlink the needed linux bindings to the top
#      level. We also DELETE every non-(linux,x64,glibc) binding so the zip ships
#      only what the runtime loads.
#   5. Symlinks: pnpm's layout is ~all symlinks into .pnpm. The runtime preserves symlinks,
#      so we zip with `-y` (store links, don't follow) — this alone roughly halves
#      the zip by not triplicating every file the symlinks point at.

# Runtime target triple. Everything else is dead weight and is pruned.
TARGET_OS, TARGET_CPU, TARGET_LIBC = "linux", "x64", "glibc"


def _read_pkg_field(pkg_json_path, field):
    try:
        data = json.loads(Path(pkg_json_path).read_text())
    except (OSError, json.JSONDecodeError):
        return None
    return data.get(field)


def _is_native_binding(pkg_dir):
    """A platform binding package declares an `os` array in package.json
    (e.g. @resvg/resvg-js-linux-x64-gnu, @img/sharp-linux-x64). Regular
    packages (@swc/helpers, react, …) do not."""
    pj = pkg_dir / "package.json"
    return pj.exists() and isinstance(_read_pkg_field(pj, "os"), list)


def _binding_matches_target(pkg_dir):
    pj = pkg_dir / "package.json"
    os_list = _read_pkg_field(pj, "os") or []
    cpu_list = _read_pkg_field(pj, "cpu") or []
    libc_list = _read_pkg_field(pj, "libc")  # may be absent (darwin has none)
    if TARGET_OS not in os_list:
        return False
    if cpu_list and TARGET_CPU not in cpu_list:
        return False
    # No libc field → not libc-specific (fine). If present, must include glibc.
    if isinstance(libc_list, list) and libc_list and TARGET_LIBC not in libc_list:
        return False
    return True


def _iter_package_dirs(node_modules):
    """Yield every package dir under a node_modules (handles @scope/name)."""
    if not node_modules.is_dir():
        return
    for entry in sorted(node_modules.iterdir()):
        if entry.name in (".bin", ".pnpm") or entry.name.startswith("."):
            continue
        if entry.name.startswith("@"):
            if entry.is_dir():
                for sub in sorted(entry.iterdir()):
                    if (sub / "package.json").exists() or sub.is_dir():
                        yield sub
        else:
            yield entry


def _repair_partial_packages(standalone):
    """Overlay full .pnpm contents onto top-level stubs that hold only
    package.json (the pnpm + standalone partial-copy bug)."""
    nm = standalone / "node_modules"
    pnpm = nm / ".pnpm"
    if not pnpm.is_dir():
        return
    for pkg_dir in _iter_package_dirs(nm):
        if pkg_dir.is_symlink() or not pkg_dir.is_dir():
            continue
        entries = [p for p in pkg_dir.iterdir()]
        if not (len(entries) == 1 and entries[0].name == "package.json"):
            continue  # only repair bare stubs
        ver = _read_pkg_field(pkg_dir / "package.json", "version")
        if not ver:
            continue
        rel = pkg_dir.relative_to(nm).as_posix()  # @swc/helpers or detect-libc
        flat = rel.replace("/", "+")              # @swc+helpers
        src = pnpm / f"{flat}@{ver}" / "node_modules" / rel
        if src.is_dir() and len(list(src.iterdir())) > 1:
            for item in src.iterdir():
                dest = pkg_dir / item.name
                if dest.exists():
                    continue
                if item.is_dir():
                    shutil.copytree(item, dest, symlinks=True)
                else:
                    shutil.copy2(item, dest)
            print(f"  repaired partial package: {rel}@{ver}", file=sys.stderr)


def _prune_and_place_bindings(standalone):
    """Delete native bindings that don't match the runtime target, and ensure the
    matching linux-x64-gnu bindings exist at top-level node_modules (as symlinks
    into .pnpm) so the runtime walk-up resolves them."""
    nm = standalone / "node_modules"
    pnpm = nm / ".pnpm"

    # 1. Prune non-target binding packages everywhere (top-level + .pnpm),
    #    keeping only os=linux, cpu=x64, libc∈{none,glibc}.
    kept, pruned_bytes = [], 0
    search_roots = [nm]
    if pnpm.is_dir():
        search_roots += [d / "node_modules" for d in pnpm.iterdir() if (d / "node_modules").is_dir()]
    for root in search_roots:
        for pkg_dir in _iter_package_dirs(root):
            if pkg_dir.is_symlink() or not pkg_dir.is_dir():
                continue
            if not _is_native_binding(pkg_dir):
                continue
            if _binding_matches_target(pkg_dir):
                kept.append(pkg_dir)
            else:
                pruned_bytes += _dir_size(pkg_dir)
                shutil.rmtree(pkg_dir, ignore_errors=True)
    if pruned_bytes:
        print(f"  pruned non-linux-x64-gnu bindings: ~{pruned_bytes // (1024*1024)}M",
              file=sys.stderr)

    # 2. Ensure each KEPT binding that lives in .pnpm is reachable from top-level
    #    node_modules. If the top-level entry is missing (because only darwin was
    #    linked at build time), create a relative symlink into .pnpm.
    for pkg_dir in kept:
        try:
            rel = pkg_dir.relative_to(pnpm)
        except ValueError:
            continue  # already a top-level binding
        # rel = <flat>@<ver>/node_modules/<scope>/<name>
        parts = rel.as_posix().split("/node_modules/", 1)
        if len(parts) != 2:
            continue
        pkg_name = parts[1]                       # @img/sharp-linux-x64
        top = nm / pkg_name
        if top.exists() or top.is_symlink():
            continue
        top.parent.mkdir(parents=True, exist_ok=True)
        target = os.path.relpath(pkg_dir, top.parent)
        os.symlink(target, top)
        print(f"  linked linux binding to top level: {pkg_name}", file=sys.stderr)


def _dir_size(path):
    total = 0
    for root, _dirs, files in os.walk(path):
        for f in files:
            fp = os.path.join(root, f)
            if not os.path.islink(fp):
                try:
                    total += os.path.getsize(fp)
                except OSError:
                    pass
    return total


# --- Bigfish (static / SPA) packaging ----------------------------------------
# Bigfish `site` builds emit a static bundle (default ./dist): index.html + hashed
# JS/CSS. The runtime still starts the function with `node server.js`, so we generate a
# zero-dependency static server (Node built-ins only — nothing to install) that
# serves the build dir and falls back to index.html for client-side routes. The
# zip root is server.js with the build dir alongside it.

# Build-output dir candidates, in priority order, when --static-dir is "auto".
_BIGFISH_BUILD_DIRS = ("dist", "build", "out")

_STATIC_SERVER_JS = '''\
// Auto-generated by morphe.py for the Bigfish (static/SPA) build. The runtime starts the
// function with `node server.js`; this serves ./{build_dir} with SPA fallback so
// client-side routes (e.g. /about) resolve to index.html. Node built-ins only.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, "{build_dir}");
const INDEX = path.join(ROOT, "index.html");

const MIME = {{
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
}};

function serveFile(res, filePath) {{
  const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
  const stream = fs.createReadStream(filePath);
  stream.on("open", () => {{
    res.writeHead(200, {{ "Content-Type": type }});
    stream.pipe(res);
  }});
  stream.on("error", () => {{
    res.writeHead(500);
    res.end("Internal Server Error");
  }});
}}

const server = http.createServer((req, res) => {{
  const pathname = decodeURIComponent(req.url.split("?")[0]);
  const rel = path.normalize(pathname).replace(/^(\\.\\.[/\\\\])+/, "");
  const target = path.join(ROOT, rel);

  if (target.startsWith(ROOT) && fs.existsSync(target) && fs.statSync(target).isFile()) {{
    return serveFile(res, target);
  }}
  // SPA fallback: let the client router handle the route.
  return serveFile(res, INDEX);
}});

server.listen(PORT, () => {{
  console.log(`static server listening on :${{PORT}}, root=${{ROOT}}`);
}});
'''


def _resolve_build_dir(project_root, static_dir):
    """Resolve the Bigfish build output dir. Explicit --static-dir wins; 'auto'
    probes dist/build/out for one containing index.html."""
    if static_dir and static_dir != "auto":
        cand = project_root / static_dir
        return cand if cand.is_dir() else None
    for name in _BIGFISH_BUILD_DIRS:
        cand = project_root / name
        if (cand / "index.html").is_file():
            return cand
    return None


def cmd_package_static(args, project_root, zip_path, framework_label="bigfish"):
    """Assemble a zero-dependency static-server zip (Bigfish or Vite SPA).

    Generates a Node-built-ins-only server.js that serves the build dir with SPA
    fallback to index.html, stages it alongside the build dir, and zips so
    server.js is at the zip root. framework_label only changes the printed line.
    """
    build_dir = _resolve_build_dir(project_root, args.static_dir)
    if build_dir is None:
        print("error: no static build dir found (looked for index.html in "
              f"{', '.join(_BIGFISH_BUILD_DIRS)}). Run the build first "
              "(e.g. `npm run build`), or pass --static-dir.", file=sys.stderr)
        return 1
    build_name = build_dir.name

    # Stage server.js + the build dir in a clean temp dir, then zip from there so
    # server.js lands at the zip root with the build dir alongside it.
    stage = project_root / ".morphe-build"
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir()
    try:
        (stage / "server.js").write_text(_STATIC_SERVER_JS.format(build_dir=build_name))
        shutil.copytree(build_dir, stage / build_name, symlinks=True)

        if zip_path.exists():
            zip_path.unlink()
        print(f"zipping static bundle (server.js + {build_name}/)...", file=sys.stderr)
        proc = subprocess.run(
            ["zip", "-ryq", str(zip_path), "server.js", build_name],
            cwd=str(stage), capture_output=True, text=True,
        )
        if proc.returncode != 0:
            print(f"zip failed: {proc.stderr}", file=sys.stderr)
            return 1
    finally:
        shutil.rmtree(stage, ignore_errors=True)

    size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"packaged: {zip_path} ({size_mb:.1f}M, framework={framework_label})")
    return 0


# --- Vite packaging ----------------------------------------------------------
# Vite has two flavors. A pure SPA (`vite build` → dist/, no server) reuses the
# zero-dependency static wrapper above. A custom-server app ships its own
# server entry (server.ts/js, e.g. Express) that serves the build dir AND
# backend API routes; the runtime starts it with `node server.js`, so we esbuild-bundle
# that entry into a self-contained server.js at the zip root, with the build dir
# alongside. `vite` is externalized by default: custom-server apps import it only
# in a dev-middleware branch (never in production), and a top-level vite import
# otherwise drags in native .node addons (esbuild/lightningcss/fsevents) that
# esbuild cannot bundle.

# Probed in order when --server-entry is "auto"; first existing file wins.
_VITE_SERVER_ENTRIES = (
    "server.ts", "server.js", "server.mjs", "server.cjs",
    "src/server.ts", "src/server.js", "src/server.mjs",
)


def _resolve_server_entry(project_root, server_entry):
    """Resolve the Vite custom-server entry. Explicit --server-entry wins (a
    missing explicit path returns None → SPA fallback); 'auto' probes the known
    entry names. Returns a Path or None (None ⇒ SPA / static mode)."""
    if server_entry and server_entry != "auto":
        cand = (project_root / server_entry)
        return cand if cand.is_file() else None
    for name in _VITE_SERVER_ENTRIES:
        cand = project_root / name
        if cand.is_file():
            return cand
    return None


def _find_esbuild(project_root):
    """Prefer the project's local esbuild binary (a devDep in typical Vite
    projects); fall back to `npx --yes esbuild`."""
    local = project_root / "node_modules" / ".bin" / "esbuild"
    if local.is_file():
        return [str(local)]
    return ["npx", "--yes", "esbuild"]


def _bundle_server(project_root, entry, out_file, externals):
    """esbuild-bundle a server entry into a self-contained CJS file at out_file.
    Returns True on success. Native .node addons cannot be inlined by esbuild;
    a server that needs one at runtime should add it via --external and ship it
    in node_modules (documented edge case)."""
    cmd = _find_esbuild(project_root) + [
        str(entry),
        "--bundle",
        "--platform=node",
        "--format=cjs",
        f"--outfile={out_file}",
    ]
    for name in externals:
        cmd.append(f"--external:{name}")
    print(f"bundling server entry with esbuild: {entry.name} "
          f"(external: {', '.join(externals) or 'none'})...", file=sys.stderr)
    proc = subprocess.run(cmd, cwd=str(project_root), capture_output=True, text=True)
    if proc.stderr.strip():
        print(proc.stderr.strip(), file=sys.stderr)
    if proc.returncode != 0:
        print("error: esbuild failed to bundle the server entry. If it imports "
              "`vite` or a native .node addon at the top level, make that import "
              "dev-only (lazy `await import`) or pass it via --external.",
              file=sys.stderr)
        return False
    return True


def cmd_package_vite(args, project_root, zip_path):
    entry = _resolve_server_entry(project_root, args.server_entry)
    if entry is None:
        # No server entry → pure SPA. Reuse the static wrapper (like Bigfish).
        return cmd_package_static(args, project_root, zip_path, "vite")

    # Custom-server mode: bundle the server entry, ship it with the build dir.
    build_dir = _resolve_build_dir(project_root, args.static_dir)
    if build_dir is None:
        print("error: no build dir found (looked for index.html in "
              f"{', '.join(_BIGFISH_BUILD_DIRS)}). Run the frontend build first "
              "(e.g. `npm run build`), or pass --static-dir.", file=sys.stderr)
        return 1
    build_name = build_dir.name

    externals = ["vite"] + list(args.external or [])

    stage = project_root / ".morphe-build"
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir()
    try:
        if not _bundle_server(project_root, entry, stage / "server.js", externals):
            return 1
        shutil.copytree(build_dir, stage / build_name, symlinks=True)

        if zip_path.exists():
            zip_path.unlink()
        print(f"zipping server bundle (server.js + {build_name}/)...", file=sys.stderr)
        proc = subprocess.run(
            ["zip", "-ryq", str(zip_path), "server.js", build_name],
            cwd=str(stage), capture_output=True, text=True,
        )
        if proc.returncode != 0:
            print(f"zip failed: {proc.stderr}", file=sys.stderr)
            return 1
    finally:
        shutil.rmtree(stage, ignore_errors=True)

    size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"packaged: {zip_path} ({size_mb:.1f}M, framework=vite, mode=server, "
          f"entry={entry.name})")
    print("note: the bundled server must listen on process.env.PORT || 3000, bind "
          "0.0.0.0, and read its static dir from process.cwd(). Set runtime "
          "secrets in the function env, not in the zip.", file=sys.stderr)
    return 0


def cmd_package(args):
    project_root = Path(args.project_root).resolve()
    zip_path = (project_root / args.out).resolve()

    framework = args.framework
    if framework == "auto":
        framework = detect_framework(project_root)
        if framework is None:
            print("error: could not detect framework (not Next.js or Bigfish). "
                  "Pass --framework explicitly.", file=sys.stderr)
            return 1

    if framework == "bigfish":
        return cmd_package_static(args, project_root, zip_path, "bigfish")

    if framework == "vite":
        return cmd_package_vite(args, project_root, zip_path)

    # ----- Next.js standalone packaging -----
    standalone = project_root / ".next" / "standalone"

    if not standalone.is_dir():
        print(f"error: {standalone} not found — run the build first "
              "(e.g. `npm run build`).", file=sys.stderr)
        return 1

    # Never let a previous artifact get zipped into the new one.
    for stale in (zip_path, standalone / zip_path.name, standalone / "code.zip"):
        if stale.exists():
            stale.unlink()

    # `next build` traces server code + node_modules, but NOT static/public.
    static_src = project_root / ".next" / "static"
    if static_src.is_dir():
        dest = standalone / ".next" / "static"
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(static_src, dest, symlinks=True)
    public_src = project_root / "public"
    if public_src.is_dir():
        dest = standalone / "public"
        if not dest.exists():
            shutil.copytree(public_src, dest, symlinks=True)

    # Prune non-target bindings FIRST, so we don't waste work repairing darwin/
    # musl stubs we're about to delete.
    print("pruning + placing native bindings for linux-x64-gnu...", file=sys.stderr)
    _prune_and_place_bindings(standalone)
    print("repairing partial top-level packages...", file=sys.stderr)
    _repair_partial_packages(standalone)

    # Zip from INSIDE standalone (so server.js is at the zip root) but write the
    # archive OUTSIDE it. `-y` stores symlinks instead of following them: the runtime
    # preserves them, and pnpm's layout is mostly symlinks into .pnpm, so this
    # roughly halves the zip by not duplicating every linked file.
    print("zipping (symlinks preserved)...", file=sys.stderr)
    proc = subprocess.run(
        ["zip", "-ryq", str(zip_path), "."],
        cwd=str(standalone), capture_output=True, text=True,
    )
    if proc.returncode != 0:
        print(f"zip failed: {proc.stderr}", file=sys.stderr)
        return 1

    size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"packaged: {zip_path} ({size_mb:.0f}M)")
    return 0


def cmd_deploy(args):
    token = read_access_token()
    if not token:
        print("Not logged in. Run `morphe.py login` first.", file=sys.stderr)
        return 1

    zip_path = Path(args.zip).resolve()
    if not zip_path.exists():
        print(f"Zip not found: {zip_path}", file=sys.stderr)
        return 1
    project_root = Path(args.project_root).resolve()

    # 6. presign
    presign = api_post("/oss/presign", {"contentType": "application/zip"}, token=token)
    upload_url = presign["url"]
    code_object = presign["codeObject"]
    print(f"Presigned object: {code_object}", file=sys.stderr)

    # 6. upload via PUT direct to OSS (streamed from disk so a large zip is not
    #    buffered in memory; Content-Length set explicitly as OSS requires it).
    try:
        http_put_file(upload_url, zip_path, "application/zip")
    except RuntimeError as e:
        print(f"Upload failed: {e}", file=sys.stderr)
        return 1
    print("Upload OK", file=sys.stderr)

    # 7. crc64 checksum
    checksum = crc64_ecma(zip_path)
    print(f"CRC64: {checksum}", file=sys.stderr)

    # 8 + 9. update .morphe.json (checksum + function_name)
    morphe = load_morphe_json(project_root)
    morphe["checksum"] = checksum
    if not morphe.get("function_name"):
        morphe["function_name"] = gen_function_name()
    function_name = morphe["function_name"]
    save_morphe_json(project_root, morphe)
    print(f"function_name: {function_name}", file=sys.stderr)

    # 10. deploy
    result = api_post("/deploy", {
        "functionName": function_name,
        "ossObjectName": code_object,
        "checksum": checksum,
    }, token=token)

    # 11. report
    print(json.dumps(result, ensure_ascii=False, indent=2))
    success = bool(result.get("success"))

    # 12. clean up the uploaded artifact on success (it's already in OSS; the
    #     local zip is a throwaway, often 20M+, and gitignored). --keep-zip opts
    #     out for inspection. On failure we keep it so a redeploy can retry.
    if success and not args.keep_zip:
        try:
            zip_path.unlink()
            print(f"Removed local artifact: {zip_path}", file=sys.stderr)
        except OSError as e:
            print(f"Could not remove {zip_path}: {e}", file=sys.stderr)

    return 0 if success else 1


def main():
    parser = argparse.ArgumentParser(description="Morphe deploy helper")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("check-auth")

    p_login = sub.add_parser("login")
    p_login.add_argument("--username", required=True)
    p_login.add_argument("--password", required=True)

    p_detect = sub.add_parser("detect-framework")
    p_detect.add_argument("--project-root", default=".")

    p_sfn = sub.add_parser("set-function-name")
    p_sfn.add_argument("--name", default="",
                       help="Function name to use; omit to keep existing or generate")
    p_sfn.add_argument("--project-root", default=".")

    p_package = sub.add_parser("package")
    p_package.add_argument("--project-root", default=".",
                           help="Project root holding the build output (default: cwd)")
    p_package.add_argument("--out", default="code.zip",
                           help="Output zip path, relative to project root (default: code.zip)")
    p_package.add_argument("--framework", default="auto",
                           choices=["auto", "nextjs", "bigfish", "vite"],
                           help="Framework to package for (default: auto-detect)")
    p_package.add_argument("--static-dir", default="auto",
                           help="Bigfish/Vite build output dir; 'auto' probes "
                                "dist/build/out (default: auto)")
    p_package.add_argument("--server-entry", default="auto",
                           help="Vite custom-server entry to esbuild-bundle; 'auto' "
                                "probes server.{ts,js,mjs,cjs} (and src/); a path "
                                "forces custom-server mode, a missing path falls back "
                                "to SPA/static (default: auto)")
    p_package.add_argument("--external", action="append", default=None,
                           help="Extra esbuild external for the Vite custom-server "
                                "bundle (repeatable; 'vite' is always external)")

    p_deploy = sub.add_parser("deploy")
    p_deploy.add_argument("--zip", required=True, help="Path to code.zip")
    p_deploy.add_argument("--project-root", default=".",
                          help="Project root holding .morphe.json (default: cwd)")
    p_deploy.add_argument("--keep-zip", action="store_true",
                          help="Keep the local zip after a successful deploy "
                               "(default: delete it)")

    args = parser.parse_args()
    handlers = {
        "check-auth": cmd_check_auth,
        "login": cmd_login,
        "detect-framework": cmd_detect_framework,
        "set-function-name": cmd_set_function_name,
        "package": cmd_package,
        "deploy": cmd_deploy,
    }
    return handlers[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
