---
name: morphe
description: Build and deploy a Next.js project to the Morphe service (https://morphe.zenmux.app), targeting a linux-x64-gnu runtime. Use when the user asks to deploy, ship, publish, or release a Next.js app to Morphe, run "morphe deploy", or otherwise push a Next.js build to the Morphe / zenmux platform. Handles login, Next.js standalone validation and config fixing, building, zipping, OSS upload, CRC64 checksum, .morphe.json management, and the deploy API call.
---

# Morphe Deploy

## Overview

Deploy a Next.js project to Morphe (Aliyun FC, runtime `custom.debian11`, linux-x64-gnu).
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

### 2. Confirm it is a Next.js project

Check the project root for `package.json` AND a Next.js config
(`next.config.js`, `next.config.mjs`, `next.config.ts`), or `next` listed in
`package.json` dependencies. If it is NOT a Next.js project, tell the user
"暂不支持非 Next.js 项目" and stop.

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
This name is reused on every redeploy, so the same FC function is updated.

### 4. Validate & fix the build config

The goal: the FC target (`linux-x64-gnu`) binary of every native dep must be
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

### 5. Build

```bash
npm run build   # or: pnpm build / yarn build
```

Do NOT hand-copy static/public or hand-zip — step 6 does all assembly.

### 6. Assemble the minimal deploy zip

```bash
python3 SKILL_DIR/scripts/morphe.py package --project-root .
```

This single command (idempotent; safe to re-run, but re-run `npm run build`
first if you changed code):

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
  standalone dir (so it never nests a previous `code.zip`). FC preserves
  symlinks, and pnpm's layout is mostly symlinks into `.pnpm`, so this roughly
  halves the zip.

It prints the final path and size, e.g. `packaged: …/code.zip (25M)`.

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
  redeploy so the same FC function is updated rather than duplicated. Do not
  hand-edit or regenerate it.
- **Keeping `code.zip` small** is mostly automatic via `morphe.py package`
  (binding pruning + symlink-preserving zip). The remaining large item is usually
  **project data** the build traced in (raw datasets, fixtures, generated
  outputs under a dir a server component `readdir`s). Trim those with
  `outputFileTracingExcludes` in the Next config — but never exclude files read
  at runtime via `process.cwd()` (fonts, JSON the route parses).
- **If a native addon still 500s on FC** with *Cannot find module
  `<pkg>-linux-x64-gnu`*: the binary wasn't installed on the build host. Fix the
  install (step 4: `supportedArchitectures` for pnpm, or `npm i --os=linux
  --cpu=x64 --libc=glibc …`), reinstall, rebuild, repackage. `package` warns
  when an expected linux binding is absent.
- Full API reference: `references/api.md`.
