---
name: morphe
description: Build and deploy a Next.js, Bigfish (@alipay/bigfish), or Vite project to the Morphe service (https://morphe.zenmux.app), targeting a linux-x64-gnu runtime. Use when the user asks to deploy, ship, publish, or release a Next.js, Bigfish, or Vite app to Morphe, run "morphe deploy", or otherwise push a build to the Morphe / zenmux platform. Handles login, framework detection, Next.js standalone validation / config fixing, Bigfish static-server wrapping, Vite SPA static wrapping or custom-server (server.ts/js) esbuild bundling, building, zipping, OSS upload, CRC64 checksum, .morphe.json management, and the deploy API call.
---

# Morphe Deploy

## Overview

Deploy a **Next.js**, **Bigfish** (`@alipay/bigfish`), or **Vite** project to
Morphe (runtime `custom.debian11`, linux-x64-gnu). The runtime always starts
the function with `node server.js`, so every framework packages down to a zip
whose root is a `server.js`:

- **Next.js** → the standalone server (`.next/standalone/server.js`) plus its
  traced `node_modules`. Packaging prunes wrong-platform native bindings and
  repairs pnpm partial packages.
- **Bigfish** → a static / SPA build (`dist/`). Packaging generates a
  **zero-dependency** static `server.js` (Node built-ins only — nothing to
  install) that serves the build dir with SPA fallback to `index.html`.
- **Vite** → two modes. A **pure SPA** (`vite build` → `dist/`, no server)
  reuses the same zero-dependency static wrapper as Bigfish. A **custom-server**
  app (a `server.ts`/`server.js`, e.g. Express, that serves `dist/` *and*
  backend API routes) is **esbuild-bundled** into a self-contained `server.js`
  at the zip root, with the build dir alongside it.

The fragile, deterministic API work (auth, presign, upload, CRC64, `.morphe.json`,
deploy) lives in `scripts/morphe.py`. The build/config judgment steps are done by you.

Run all `scripts/morphe.py` commands from the project root. Replace `SKILL_DIR`
below with this skill's directory (the folder containing this file).

## Workflow

Execute these steps in order. Stop and report if any step fails.

### 1. Ensure logged in

```bash
python3 SKILL_DIR/scripts/morphe.py check-auth
```

- Exit 0 → already logged in (valid `accessToken` in `~/.morphe/auth.json`). Continue.
- Exit 1 → not logged in. Ask the user for their **username** and **password**, then:

```bash
python3 SKILL_DIR/scripts/morphe.py login --username "USER" --password "PASS"
```

Never echo the password back. On success the token is saved to `~/.morphe/auth.json`.
If login fails (e.g. HTTP 401), report the error and stop.

### 2. Detect the framework

```bash
python3 SKILL_DIR/scripts/morphe.py detect-framework --project-root .
```

Prints `nextjs`, `bigfish`, `vite`, or `unknown` (exit 1). Detection is ordered
(first match wins):
- **bigfish** — `@alipay/bigfish` in `package.json` deps, or a `config/config.ts`
  exists (checked first; Bigfish projects also have next-like build scripts and
  vite-style tooling).
- **nextjs** — `next` in deps, or a `next.config.{js,mjs,ts}` exists.
- **vite** — `vite` in deps, or a `vite.config.{js,mjs,ts,mts,cjs}` exists
  (checked last; it's the broadest).

If it prints `unknown`, tell the user "暂不支持该项目类型（仅支持 Next.js、Bigfish 与 Vite）"
and stop. Otherwise remember the framework — it selects the build and packaging
path below.

### 3. Resolve the function name

Ask the user what function name to deploy under. Tell them: **如果不知道填什么，
可以留空，会自动生成一个 `user-xxxxxxxx` 格式的随机函数名。**

- If `.morphe.json` already has a `function_name`, mention it as the current
  default and let the user keep it (just press enter) or override.
- Persist the choice (empty input → keep existing or generate):

```bash
# user provided a name:
python3 SKILL_DIR/scripts/morphe.py set-function-name --name "NAME" --project-root .
# user left it blank:
python3 SKILL_DIR/scripts/morphe.py set-function-name --project-root .
```

The command prints the final function name and writes it to `.morphe.json`.
This name is reused on every redeploy, so the same function is updated.

### 4. Validate & fix the build config

**Steps 4–6 differ by framework.** Follow the branch for the framework detected
in step 2.

#### 4a. Next.js

The goal: the runtime target (`linux-x64-gnu`) binary of every native dep must be
**installed on disk** before the build, so Next's tracer can pick it up. The
`morphe.py package` step (step 6) handles top-level placement, pruning, and
zipping — but it can only ship a binary that the install actually downloaded.

Edit the config in place to ensure:

1. **standalone output** — `output: "standalone"` (else there is no
   `.next/standalone/` to zip).

2. **Install the linux binaries on the build host.** Native addons ship as
   per-platform optional deps; a macOS install only fetches the darwin one.
   - **pnpm** (`pnpm-workspace.yaml`) — add `supportedArchitectures` so the
     linux-x64-gnu binaries are fetched too. This is the single most important
     fix; with it, the tracer auto-includes the binding and you usually need NO
     `outputFileTracingIncludes` at all:
     ```yaml
     supportedArchitectures:
       os: [current, linux]
       cpu: [current, x64]
       libc: [current, glibc]
     ```
     Then re-run `pnpm install`.
   - **npm/yarn** — install the specific binding(s) for the target, e.g.
     `npm i --no-save @resvg/resvg-js-linux-x64-gnu --force --os=linux --cpu=x64 --libc=glibc`.

3. **(Optional) trim the bundle further.** `morphe.py package` already prunes
   every non-linux-x64-gnu native binary, so you do NOT need
   `outputFileTracingExcludes` for those. Only add excludes for **project data**
   the server doesn't need at runtime (large fixtures, raw datasets, docs). Keep
   anything read at runtime via `process.cwd()` (fonts, JSON the route reads).

See `references/nextjs-config.md` for details, per-package binding names, and
how to confirm the linux binary is on disk.

#### 4b. Bigfish

No native-binding work — Bigfish builds a static / SPA bundle and `morphe.py
package` generates a **zero-dependency** `server.js` (Node built-ins only). There
is nothing to install for the linux target and no config to patch in the common
case.

- Confirm the app builds to a **static** bundle. A default Bigfish `site` build
  emits `dist/` (`index.html` + hashed JS/CSS), which is what the generated
  static server serves. `deployMode: 'render'` (SSR) is **not** covered by this
  static wrapper — if the app truly needs server-side rendering at runtime, stop
  and tell the user the static path won't serve their SSR routes.
- If the build output dir is not `dist/` (Bigfish lets you override it), note the
  dir name; you'll pass it via `--static-dir` in step 6.

#### 4c. Vite

Vite has two modes; `morphe.py package` (step 6) auto-detects which by probing
for a server entry (`server.{ts,js,mjs,cjs}`, also under `src/`).

- **Pure SPA** (no server entry) — nothing to install or patch, exactly like
  Bigfish. `vite build` emits `dist/` (`index.html` + hashed assets) and the
  generated **zero-dependency** static `server.js` serves it with SPA fallback.
  If the output dir isn't `dist/`, note it for `--static-dir` in step 6.

- **Custom-server** (a `server.ts`/`server.js` serving `dist/` **and** API
  routes) — `package` will **esbuild-bundle** that entry into a self-contained
  `server.js`. Make sure the server:
  1. **listens on `process.env.PORT || 3000` and binds `0.0.0.0`** (the runtime
     sets `PORT` and routes to all interfaces);
  2. **reads its static dir from `process.cwd()`** (e.g.
     `path.join(process.cwd(), "dist")`), since the zip ships the build dir
     alongside `server.js` at the runtime working dir;
  3. **keeps any `vite` import dev-only.** `vite` is **always externalized** from
     the bundle (it's huge and pulls in native `.node` addons — esbuild/
     lightningcss/fsevents — that can't be bundled and break the build). A
     production server must not load it. Put any dev-middleware vite usage behind
     a lazy, non-production branch, e.g.:
     ```ts
     if (process.env.NODE_ENV !== "production") {
       const { createServer } = await import("vite");  // lazy: never bundled
       // ... dev middleware
     }
     ```
  Runtime **secrets** (API keys, etc.) belong in the **function environment**,
  not in the zip — the build never bundles your `.env`.
  - If your server needs an extra package kept out of the bundle (e.g. a native
    `.node` addon esbuild can't inline), pass it via `--external NAME` in step 6
    — but then that package must be reachable at runtime (this is an edge case;
    most pure-JS deps bundle fine).

### 5. Build

```bash
npm run build   # or: pnpm build / yarn build  (Bigfish: also `bigfish build`)
```

Do NOT hand-copy assets or hand-zip — step 6 does all assembly. (Vite: run only
the **frontend** build here to produce `dist/`. For a custom-server app you do
**not** need to bundle the server yourself — `package` runs esbuild for you in
step 6. If your `build` script already esbuilds the server, that's harmless;
`package` re-bundles into the staged zip regardless.)

### 6. Assemble the minimal deploy zip

```bash
python3 SKILL_DIR/scripts/morphe.py package --project-root .
```

`package` auto-detects the framework (override with `--framework
nextjs|bigfish|vite`). It is idempotent (safe to re-run, but re-run the build
first if you changed code).

**Next.js** — assembles `.next/standalone` into a runnable zip:

- copies `.next/static` and `public/` into the bundle (not traced by the build);
- **repairs pnpm partial packages** — top-level `node_modules/<pkg>` dirs that
  hold only `package.json` while the real files live in `.pnpm` (this shadowing
  is what crashes `node server.js` with e.g. *Cannot find module
  `@swc/helpers/cjs/_interop_require_default.cjs`*);
- **prunes every native binding that isn't `linux-x64-gnu`** (darwin/musl/arm64
  — often 100M+) and **symlinks the kept linux bindings to top-level
  node_modules**, where the runtime resolves them with a bare
  `require("<pkg>-linux-x64-gnu")`. Missing this is why SVG-style code paths work
  but anything hitting the native addon 500s with *Cannot find module
  `…-linux-x64-gnu`*;
- **zips with symlinks preserved (`zip -y`)** to `./code.zip` OUTSIDE the
  standalone dir (so it never nests a previous `code.zip`). The runtime preserves
  symlinks, and pnpm's layout is mostly symlinks into `.pnpm`, so this roughly
  halves the zip.

**Bigfish** — assembles a static-server zip:

- locates the build output dir (auto-probes `dist`, `build`, `out` for one
  containing `index.html`; override with `--static-dir DIR`);
- **generates a zero-dependency `server.js`** (Node `http`/`fs`/`path` only) that
  serves the build dir and falls back to `index.html` for client-side routes;
- stages `server.js` + the build dir and **zips** so `server.js` is at the zip
  root with the build dir alongside it. No `node_modules`, so the zip is small.

**Vite** — two modes, auto-selected by probing for a server entry:

- **SPA** (no server entry found) — identical to the Bigfish path above: a
  generated **zero-dependency** static `server.js` + the build dir.
- **Custom-server** (a `server.{ts,js,mjs,cjs}` entry, auto-probed; force/override
  with `--server-entry PATH`) — **esbuild-bundles** the entry
  (`--bundle --platform=node --format=cjs`, **`vite` always external**, plus any
  `--external NAME` you pass) into a self-contained `server.js`, then stages it
  with the build dir (auto-probes `dist`/`build`/`out`, override `--static-dir`)
  and zips so `server.js` is at the zip root. Deps are inlined, so no
  `node_modules` ships.

It prints the final path, size, and framework, e.g.
`packaged: …/code.zip (25M)` or `packaged: …/code.zip (0.2M, framework=bigfish)`
or `packaged: …/code.zip (0.7M, framework=vite, mode=server, entry=server.ts)`.

### 7–11. Upload, checksum, and deploy

A single command does presign → curl PUT upload → CRC64 checksum →
update `.morphe.json` (writes `checksum`; uses the `function_name` resolved in
step 3, generating one only if somehow still absent) → call `/api/deploy`:

```bash
python3 SKILL_DIR/scripts/morphe.py deploy --zip code.zip --project-root .
```

On success it prints the deploy result JSON (including `action`, `functionName`,
and `triggerUrl` when available), then **deletes the local `code.zip`** (it's
already in OSS and is a large throwaway). Pass `--keep-zip` to retain it for
inspection. On failure the zip is kept so a redeploy can retry. Report the
outcome to the user — give them the `triggerUrl` if present. If it prints
`not-logged-in` or an HTTP error, go back to step 1 (the token may have expired)
or report the failure.

## Notes

- The Morphe API advertises cookie auth but login returns an `accessToken`;
  the script sends it as both a `morphe_session` cookie and a Bearer header.
- `function_name` in `.morphe.json` is generated ONCE and reused on every
  redeploy so the same function is updated rather than duplicated. Do not
  hand-edit or regenerate it.
- All frameworks deploy with the default `command="node server.js"`,
  `port=3000` — no per-framework deploy flags. The Bigfish / Vite-SPA static
  server honors `process.env.PORT` (defaults to 3000) so it matches; a Vite
  custom-server must do the same (step 4c).
- **(Next.js) Keeping `code.zip` small** is mostly automatic via `morphe.py
  package` (binding pruning + symlink-preserving zip). The remaining large item
  is usually **project data** the build traced in (raw datasets, fixtures,
  generated outputs under a dir a server component `readdir`s). Trim those with
  `outputFileTracingExcludes` in the Next config — but never exclude files read
  at runtime via `process.cwd()` (fonts, JSON the route parses). (Bigfish zips
  are just the static build — already small, no `node_modules`.)
- **(Next.js) If a native addon still 500s at runtime** with *Cannot find module
  `<pkg>-linux-x64-gnu`*: the binary wasn't installed on the build host. Fix the
  install (step 4a: `supportedArchitectures` for pnpm, or `npm i --os=linux
  --cpu=x64 --libc=glibc …`), reinstall, rebuild, repackage. `package` warns
  when an expected linux binding is absent.
- **(Bigfish) A blank page or 404 on a client route** means the SPA fallback
  isn't reaching `index.html`, or the build dir wasn't `dist/`. Confirm
  `index.html` exists in the build dir and pass `--static-dir` if it's not one of
  `dist`/`build`/`out`. The generated static server is for **static** builds; an
  SSR (`deployMode: 'render'`) app needs a real server entry, not this wrapper.
- **(Vite) `package` esbuild step fails** (e.g. *No loader is configured for
  ".node" files* or a glob/`require.resolve` error from `vite`/`lightningcss`/
  `fsevents`): the server entry imports `vite` (or another native-addon dep) at
  the **top level**. Make that import dev-only / lazy (step 4c) so it's
  externalized, or pass the dep via `--external NAME`.
- **(Vite) SPA blank page / 404 on a client route** — same as Bigfish: confirm
  `index.html` is in the build dir and pass `--static-dir` if it isn't
  `dist`/`build`/`out`. **A custom-server route 500ing** usually means a dep was
  externalized but actually needed at runtime, or the server reads its static
  dir from a path other than `process.cwd()` — fix per step 4c.
- **(Vite) A 500 from a backend route at runtime but not locally** is often a missing
  **runtime secret** — set API keys etc. in the function environment (they're
  never bundled into the zip from your `.env`).
- Full API reference: `references/api.md`.
