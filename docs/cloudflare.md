# Cloudflare Workers (Vinext)

This target starts from commit `8fb8a6090f1c100a489d670fbb576cbb0a244c63`.
The first PR commit restores its exact tree; the migration is a separate commit.
It does not force-push `main`, merge the PR, or publish a Worker.

## Toolchain and commands

Use Node 24 and the pinned `pnpm@12.11.2`. A current Linux distribution is needed
for local workerd (CI uses Ubuntu 24.04). The existing `pnpm dev/build/start`
commands remain the Next.js / Morphe fallback. Do not point Morphe packaging at
Workers output.

```bash
pnpm install --frozen-lockfile --registry=https://registry.npmjs.org
pnpm cf:check                  # official vinext compatibility scan
pnpm cf:dev                    # actual workerd dev server, localhost:3001
pnpm cf:build                  # immutable inputs, then Vite RSC/SSR/client build
pnpm exec vite preview --host localhost --port 4173
pnpm cf:test                   # file boundary and all model-shard parity checks
pnpm cf:smoke                  # needs a secret-free preview at localhost:4173
pnpm exec wrangler deploy --dry-run
```

`wrangler.jsonc` and `@cloudflare/vite-plugin` v1 use the officially supported
legacy-Wrangler path of `vinext init --platform=cloudflare
--legacy-wrangler-cloudflare-init`. No beta `cf` config/runtime is required.
`@vitejs/plugin-rsc` is registered by Vinext; do not register it again.
React, React DOM and react-server-dom-webpack are pinned together to satisfy
Vinext's peer contract; unrelated baseline dependencies are retained.

## Runtime boundaries

- Public assets and **tracked, allowlisted** immutable research inputs are
  staged under `.vinext/`; no `.env*`, local caches, untracked runs, credentials,
  or wholesale checkout copies enter the build. `cf:prepare` performs no
  network calls and never runs `study:test` or live billing refresh commands.
- Workers has no checkout. `worker/vite-plugin.ts` replaces only application
  filesystem readers with a fail-closed, read-only packaged filesystem. The
  Node research CLI and Next/Morphe continue using their original file APIs.
  Missing inputs throw `ENOENT`; writes throw `EROFS`.
- The original raw-answer join is run **at build time**, with exact JSON parity
  tests. Only run/model metadata and the selected model's answers are loaded
  by a Worker request; the large source JSONL corpus is not put into one
  isolate or sent to a browser. Published runs update on the next build.
- Model shards and the CJK font are Worker-only assets. They are read via
  `cloudflare:workers`' `ASSETS` binding; `src/proxy.ts` rejects direct HTTP
  reads of `/__arena_private/**`. Preserve `assets.run_worker_first` and the
  guard together. The internal binding URL uses `localhost` so Vite's host
  validation remains enabled; this is a binding call, not a network fetch.
- PNG uses the real resvg WASM renderer and packaged Noto Sans SC font; SVG uses
  the unchanged shared graph builder. The Node target keeps native resvg.
  Never replace the native package with an empty stub to make a build pass.
- Identity and MBTI aggregates have distinct schemas. Identity pickers exclude
  MBTI runs; the MBTI narrative still reads its actual pinned artifacts.
- The browser's icon availability helpers stay inside a Client Component;
  a Server Component cannot call functions exported across `"use client"`.
- Live API responses use Workers' native `Content-Encoding` compression, not
  pre-gzipped bytes: Vinext can reconstruct Responses and lose `encodeBody`.
  The Node target retains explicit gzip. The smoke suite decodes a real HTTP
  response, so a double-gzipped payload cannot pass as working JSON.
- Supabase snapshot caching, lease fencing, stale flags, cutoff accounting and
  source-db read-only queries are unchanged. `mysql2` uses its static parser
  (`disableEval`) because Workers forbids runtime code generation.

## Deploy after review

The [CI workflow template](examples/cloudflare-checks.yml) validates but
**never deploys**. It is deliberately not installed in `.github/workflows/`:
the available GitHub credential cannot write workflows. Activate it separately
with appropriately scoped authorization; the local checks already run without
that permission. After PR review, authorize the
Cloudflare account (`pnpm exec wrangler login`) and configure runtime secrets
through the dashboard or `pnpm exec wrangler secret put NAME`:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (or the legacy `SUPABASE_SERVICE_ROLE_KEY`)
- `TOKEN_ECON_LIVE_DB_HOST`, `TOKEN_ECON_LIVE_DB_PORT`, `TOKEN_ECON_LIVE_DB_USER`,
  `TOKEN_ECON_LIVE_DB_PASSWORD`, `TOKEN_ECON_LIVE_DB_DATABASE`

Do not pass DDL/admin credentials, a model API key, `.env.local`, or local
credential files to the deployment. No secret belongs in `wrangler.jsonc`.
For local credentialed checks, use ignored `.dev.vars`; omit it for `cf:smoke`.
Cloudflare Images must be available for the `IMAGES` binding; check the final
compressed Worker size against the selected account's plan before publishing.

```bash
pnpm cf:deploy
```

A successful build/dry-run is not a deployment or production data check. Verify
both live API endpoints after deployment, including persistence headers,
`stale` and the actual `to` cutoff. Confirm that the account can reach the
billing database and Supabase; no such connectivity is asserted by the local
secret-free tests. Research routes, navigation, private-asset denial, and real
PNG/SVG exports must also be checked on the deployed hostname.
