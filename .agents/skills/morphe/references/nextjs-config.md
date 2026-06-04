# Next.js config & install for Morphe (linux-x64-gnu)

Morphe runs the standalone server on Aliyun FC (`custom.debian11`, linux x64,
glibc). The bundle is built on the developer's machine (often macOS/arm64). Two
things must hold before building; a third is optional.

Division of labour:
- **The config + install (this file)** make the correct `linux-x64-gnu` binaries
  exist on disk, and optionally trim project data.
- **`morphe.py package`** does the mechanical assembly: repair pnpm partial
  packages, **prune every non-linux-x64-gnu native binary**, **symlink the kept
  linux bindings to top-level node_modules**, and zip with symlinks preserved.
  You do NOT hand-write `outputFileTracingIncludes` for native bindings anymore.

## 1. Standalone output

```js
output: "standalone"
```

Without this there is no `.next/standalone/` directory to zip.

## 2. Install the linux-x64-gnu native binaries on the build host

Packages with native addons (`.node` files) are published as per-platform
**optional dependencies**. A macOS install only puts the darwin binding on disk,
so the tracer can't include the linux one and the function crashes at runtime
with *Cannot find module `<pkg>-linux-x64-gnu`*.

### pnpm (preferred)

Add `supportedArchitectures` to **`pnpm-workspace.yaml`** so pnpm fetches the
linux-x64-gnu binaries alongside the host ones, then reinstall:

```yaml
supportedArchitectures:
  os: [current, linux]
  cpu: [current, x64]
  libc: [current, glibc]
```

```bash
pnpm install
```

With the binary installed, Next's tracer follows the package's own
`require("<pkg>-linux-x64-gnu")` and includes it automatically — so you usually
need **no** `outputFileTracingIncludes`. (If a binary is loaded so dynamically
that the tracer misses it, add a targeted include as a fallback — see §4.)

### npm / yarn

Install the specific binding(s) for the target without saving to deps:

```bash
npm i --no-save <pkg>-linux-x64-gnu --force --os=linux --cpu=x64 --libc=glibc
```

### Confirm the binary is on disk

```bash
# pnpm: bindings live under .pnpm
find node_modules/.pnpm -type d -name '*linux-x64-gnu*'
find node_modules/.pnpm -name '*.linux-x64-gnu.node' -o -name 'sharp-linux-x64.node'
# npm/yarn: at top level
ls node_modules/@scope/ | grep linux
```

Common packages and their linux binding directories:

| Package            | Linux binding directory                              |
|--------------------|------------------------------------------------------|
| `@resvg/resvg-js`  | `@resvg/resvg-js-linux-x64-gnu`                      |
| `sharp`            | `@img/sharp-linux-x64` (+ `@img/sharp-libvips-linux-x64`) |
| `@node-rs/argon2`  | `@node-rs/argon2-linux-x64-gnu`                      |
| `@prisma/client`   | engine for `debian-openssl-3.0.x` (set `binaryTargets`) |

`morphe.py package` identifies native bindings generically (a package whose
`package.json` declares an `os` array) and keeps only those matching
`os=linux, cpu=x64, libc∈{none,glibc}`. You don't have to enumerate them — just
make sure they're installed.

## 3. (Optional) Trim project data from the trace

`package` already removes the wrong-platform binaries. The other common source of
a huge zip is **project data** the tracer pulls in because a server component
reads it from `process.cwd()` (e.g. a page that `readdir`s a `results/`,
`data/`, or `fixtures/` dir). Next then traces the WHOLE tree.

Exclude only what the running server doesn't need:

```js
const nextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "*": [
      "**/results/**/*.jsonl",   // raw datasets — keep small summaries instead
      "paper/**", "docs/**", "README*.md",
      "src/**",                  // app TS sources (server runs compiled .next/)
    ],
  },
};
```

Anchor app-source globs to the repo root (`src/**`, not `**/src/**`) so they
can't match a dependency's own internal `src/` inside `node_modules` (e.g.
`@swc/helpers` ships a `src/` dir — excluding it corrupts the package).

**Never exclude files read at runtime via `process.cwd()`** — fonts, JSON the
route parses, logos. If unsure, deploy and test the route before trimming.

## 4. Fallback: force-include a binding the tracer missed

Only if §2 is done and the addon still isn't traced (rare, very dynamic loaders):

```js
serverExternalPackages: ["@resvg/resvg-js"],
outputFileTracingIncludes: {
  "*": ["./node_modules/.pnpm/@resvg+resvg-js-linux-x64-gnu@*/node_modules/@resvg/resvg-js-linux-x64-gnu/**"],
},
```

`package` will still place it at top level and prune the non-target siblings.

## Config file formats

- `next.config.js` / `.mjs` — plain object, CommonJS or ESM export.
- `next.config.ts` — typed; keep the `NextConfig` type import intact when editing.

Edit the existing file in place; preserve all other existing options.
