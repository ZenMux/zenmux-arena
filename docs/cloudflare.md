# Deploying Arena to Cloudflare Workers

The Cloudflare target is a **Workers** app built by the OpenNext adapter
(`@opennextjs/cloudflare`), deployed by **Workers Builds (Git integration)**.
There is deliberately **no GitHub Actions workflow** in this repo: Cloudflare
builds and deploys on every push itself, so a workflow file would only be a
second, divergent CI pipeline.

Supabase stays the persistent store (see [shared-cache.md](shared-cache.md)).
Workers only serve requests; nothing is cached to local disk.

## One-time project setup (dashboard, not code)

1. Workers & Pages → **Create application → Connect to Git** → pick
   `ZenMux/zenmux-arena` (the Cloudflare GitHub App must be installed on the
   repo) and the `main` production branch.
2. Worker name must be **`zenmux-arena`** — it has to match `name` in
   `wrangler.jsonc`, and the config self-references the worker through the
   `WORKER_SELF_REFERENCE` service binding.
3. Build settings:

   | Setting | Value |
   |---|---|
   | Root directory | `/` |
   | Build command | `pnpm cf:build` (→ `opennextjs-cloudflare build`) |
   | Deploy command | `npx wrangler deploy` |
   | Preview / non-production | `npx wrangler versions upload` (optional) |
   | Node version | from `.node-version` (`26.12.1`); override with a `NODE_VERSION` build variable if the image cannot install it |

   `pnpm` comes from `packageManager` in `package.json`; `pnpm-lock.yaml` makes
   the install reproducible (`--frozen-lockfile`).
4. Build **variables** (baked into the client bundle at build time — changing
   one requires a new build):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
5. Runtime **secrets** (dashboard → Settings → Variables and Secrets, or
   `wrangler secret put <NAME>`). `keep_vars: true` in `wrangler.jsonc` stops a
   CI deploy from wiping them:
   - `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (server-only; never `NEXT_PUBLIC_*`)
   - `TOKEN_ECON_LIVE_DB_HOST` / `_PORT` / `_USER` / `_PASSWORD` / `_DATABASE`
   - optional: `TOKEN_ECON_LIVE_START_ISO`, `TOKEN_DEALS_START_ISO`,
     `ARENA_CACHE_TIMEOUT_MS`, `TOKEN_ECON_LIVE_*` tuning knobs
   - `ZENMUX_API_KEY` is **not** needed at runtime (study pipeline only)

   `NEXT_PUBLIC_*` is build-time public configuration; the secret key must never
   live there.
6. A **Workers Paid** plan is required: the built worker is ~16 MB / ~3.2 MiB
   gzip, above the 3 MiB free-plan limit.

Nothing else is needed — no `wrangler login` on a laptop, no manual upload.

## What runs where

| Piece | Workers runtime behaviour |
|---|---|
| Supabase snapshot read/write | unchanged (`fetch`-based) |
| Live billing queries (`mysql2`) | works, but **`disableEval: true` is required** — workerd forbids `eval`/`new Function` and mysql2's default row-parser compiler uses it (`EvalError: Code generation from strings disallowed` on the first query) |
| `config/token-deals.json`, `config/token-economics-live-models.json` | read from disk on Node; **statically imported** so the worker bundle carries a copy, used when the disk read reports a missing file |
| `.open-next/assets` (everything under `public/`) | served as static assets through the `ASSETS` binding |
| Files written at runtime | not persisted (only `/tmp`, per request) |

`fs` in Workers is a virtual filesystem: `/bundle` (read-only, only modules that
are actually in the bundle) and `/tmp`. `process.cwd()` resolves to `/bundle`.
Anything that is not `import`ed — `results/**`, `public/research/**` read by
path — does not exist there.

## Known gaps on Workers (verified in workerd)

1. **Research viewer pages** (`/who-are-you`, `/who-are-you/studio`,
   `/who-are-you/data`, `/who-are-you/browse`) enumerate `results/**` with
   `readdir`/`readFile` at request time. In Workers that directory does not
   exist, so they render their empty state ("No runs found."). Run artifacts
   (136 MB, individual `records.jsonl` up to 31 MB) must move to a real store —
   Supabase Storage + a run manifest table, or R2 — before these pages work on
   Cloudflare.
2. **`/api/export` PNG** needs two files that are not in the worker bundle:
   `@resvg/resvg-wasm/index_bg.wasm` and `research/assets/NotoSansSC-Regular.otf`
   (7.9 MB). Until they are shipped as static assets (fetch through the `ASSETS`
   binding) or inlined, PNG export fails and CJK glyphs would be missing. SVG
   export is unaffected.
3. `results/**` is still the input for `src/app/talk/mbti` and other research
   surfaces — the same treatment as (1) applies.

## Verification after a deploy

```bash
# assets + worker alive
curl -sI https://<worker-url>/ | head -1

# live data plane: coverage + provenance, not just HTTP 200
curl -sD - -o /dev/null https://<worker-url>/api/token-deals/live | grep -i x-cache
curl -sD - -o /dev/null https://<worker-url>/api/token-economics/live | grep -i x-cache
```

`x-cache-source` should stop reporting `stale-baseline` once the refresh path
runs (it needs the DB secrets above). `to` — not the response time — is the
freshness signal.

## Troubleshooting

- **Build fails on `pnpm install`** → Node version mismatch: check
  `.node-version` against the build image, or pin `NODE_VERSION`.
- **`EvalError: Code generation from strings disallowed`** → a library is using
  `eval`/`new Function`; mysql2 is already handled with `disableEval`.
- **`Unable to read ... at /bundle/...`** → a file read by path that is not in
  the bundle: import it, ship it as a static asset, or move it to Supabase/R2.
- **Secrets vanish after a deploy** → `keep_vars` must stay `true`.
