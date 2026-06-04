#!/usr/bin/env python3
"""
morphe.py — Morphe deploy helper (auth + presign + upload + checksum + deploy).

Handles the deterministic, error-prone parts of deploying a built Next.js
standalone bundle to the Morphe service. The Next.js detection / config
fixing / build steps are handled by Claude per SKILL.md; this script owns the
API orchestration so it is reliable and consistent.

Subcommands:
  check-auth                 Exit 0 if logged in (accessToken present), else 1.
  login --username U --password P
                             Call /api/user/login, save accessToken to
                             ~/.morphe/auth.json. Exit 0 on success.
  set-function-name [--name NAME] [--project-root DIR]
                             Resolve & persist function_name in .morphe.json.
                             --name given -> use it; else keep existing; else
                             generate user-xxxxxxxx. Prints the final name.
  package [--project-root DIR] [--out code.zip]
                             Assemble .next/standalone into a minimal RUNNABLE
                             zip: copy static/public, repair pnpm partial
                             packages, prune non-linux-x64-gnu native bindings &
                             symlink the kept ones to top level, zip with
                             symlinks preserved (-y). Writes the zip OUTSIDE
                             standalone so it never nests itself.
  deploy --zip PATH [--project-root DIR] [--keep-zip]
                             presign -> curl PUT upload -> crc64 -> update
                             .morphe.json (checksum + function_name) -> /api/deploy.
                             Prints the deploy result as JSON on stdout. Deletes
                             the local zip on success (--keep-zip to keep it).

Notes:
  * Base URL defaults to https://morphe.zenmux.app, override with MORPHE_BASE_URL.
  * The OpenAPI spec advertises cookie auth (morphe_session) but login returns
    an accessToken. Authenticated requests send the token BOTH as the
    morphe_session cookie AND as an Authorization: Bearer header for robustness.
  * No third-party Python deps. The large file upload uses curl (as required);
    JSON API calls use urllib.
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
# browser-like one on every request (urllib + curl upload).
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
# Assemble .next/standalone into a minimal, RUNNABLE code.zip for FC. This owns
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
#      linux one is missing on FC → "Cannot find module ...-linux-x64-gnu" (and
#      SVG works while PNG 500s). We symlink the needed linux bindings to the top
#      level. We also DELETE every non-(linux,x64,glibc) binding so the zip ships
#      only what FC loads.
#   5. Symlinks: pnpm's layout is ~all symlinks into .pnpm. FC preserves symlinks,
#      so we zip with `-y` (store links, don't follow) — this alone roughly halves
#      the zip by not triplicating every file the symlinks point at.

# FC target triple. Everything else is dead weight and is pruned.
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
    """Delete native bindings that don't match the FC target, and ensure the
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


def cmd_package(args):
    project_root = Path(args.project_root).resolve()
    standalone = project_root / ".next" / "standalone"
    zip_path = (project_root / args.out).resolve()

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
    # archive OUTSIDE it. `-y` stores symlinks instead of following them: FC
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

    # 6. upload via curl (PUT direct to OSS)
    curl = subprocess.run(
        ["curl", "-fsS", "-X", "PUT", "-T", str(zip_path),
         "-H", "Content-Type: application/zip",
         "-H", f"User-Agent: {USER_AGENT}", upload_url],
        capture_output=True, text=True,
    )
    if curl.returncode != 0:
        print(f"Upload failed: {curl.stderr}", file=sys.stderr)
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

    p_sfn = sub.add_parser("set-function-name")
    p_sfn.add_argument("--name", default="",
                       help="Function name to use; omit to keep existing or generate")
    p_sfn.add_argument("--project-root", default=".")

    p_package = sub.add_parser("package")
    p_package.add_argument("--project-root", default=".",
                           help="Project root holding .next/standalone (default: cwd)")
    p_package.add_argument("--out", default="code.zip",
                           help="Output zip path, relative to project root (default: code.zip)")

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
        "set-function-name": cmd_set_function_name,
        "package": cmd_package,
        "deploy": cmd_deploy,
    }
    return handlers[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
