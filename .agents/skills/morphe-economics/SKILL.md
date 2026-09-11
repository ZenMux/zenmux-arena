---
name: morphe-economics
description: Deploy ZenMux Arena to Morphe with Supabase shared snapshots for Token Economics and Token Deals. Checks schema, server write access and migrated data, then builds, packages and deploys Next.js standalone without local cache or credential files. Includes optional shared-data refresh and independent freshness reporting. All deployment scripts are bundled in this skill.
---

# Morphe Economics

Run from the project root. Scripts are under `.agents/skills/morphe-economics/scripts/`.
The target is Morphe (`custom.debian11`, linux-x64-gnu); it starts `node server.js`.
This skill is self-contained and does not require the base Morphe skill.

## Data model

Arena follows Insights' shared-snapshot flow: memory → Supabase → a bounded,
read-only billing query → a Supabase commit. A visit triggers refresh after the
current data boundary expires. Other visitors and newly started instances read
the same snapshot. Next `after()` keeps refresh, persistence and lease release
alive after a stale response is sent.

- `arena_snapshot_cache`: current snapshots for both modules and both ranges.
- `arena_cache_leases`: cross-instance refresh exclusion; expired workers cannot
  publish and older cutoffs cannot overwrite newer data.
- `arena_cache_archives`: immutable imports and backfill checkpoints.
- Only the server Secret Key (or legacy service-role key) can access these tables.
  Publishable keys cannot write or directly read the private cache tables.
- No `.cache/token-economics` or `.cache/token-deals` file is needed at runtime.
  Deploying code neither resets snapshots nor refreshes billing data by itself.
- Preserve the PAYG/subscription split, deal-window semantics, bucket overlap,
  and bounded full-ledger catch-up when changing maintenance scripts.

Implementation and recovery details: [shared cache](../../../docs/shared-cache.md).

## Deployment workflow

### 1. Inspect the target and credentials

Inspect the existing `.morphe.json` and reuse its function name. A new name is
needed only when the user asks for a new function or none is configured.

```bash
bash .agents/skills/morphe-economics/scripts/login.sh
```

The login script reuses `~/.morphe/auth.json`; otherwise it opens the browser
OAuth flow. Surface `OPEN_AUTH` if manual navigation is needed. Stop on failure;
never ask for a username/password or print keys.

Ensure the **Morphe function environment**, not just the local build environment,
contains `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`),
and the existing `TOKEN_ECON_LIVE_DB_*` and aggregation settings. Server variables
are read at runtime. `NEXT_PUBLIC_*` values are fixed when building and are not
a substitute for server secrets. Follow the current API in [api.md](references/api.md)
when inspecting the configured function. Report missing runtime configuration.

### 2. Check shared-data readiness

```bash
bash .agents/skills/morphe-economics/scripts/predeploy.sh
```

This checks schema/RPC availability, read/write isolation, refresh locking, and
all four usable current snapshots. It does **not** query the billing source or
run migration on every deployment. Missing schema or data is a failed readiness
gate: fix it before packaging a release that relies on shared snapshots.

First-time migration only:

```bash
pnpm supabase:setup
pnpm cache:migrate --dry-run
pnpm cache:migrate
pnpm cache:migrate --verify-only
pnpm supabase:check --require-data
```

Schema setup needs `SUPABASE_ACCESS_TOKEN` or `SUPABASE_DB_URL`; runtime does not.
If neither is available, use `pnpm supabase:sql` in the project's SQL Editor.
Import reads the existing `.cache` files, archives every source, verifies all
fields after the JSONB round trip, and promotes only current snapshots. Reruns
preserve newer shared data. Keep the local originals as rollback evidence.

### 3. Optional data refresh

When the user asks to refresh data as part of the release:

```bash
bash .agents/skills/morphe-economics/scripts/predeploy.sh --refresh
```

This runs both maintenance refreshes independently, writing Supabase directly.
A failed refresh does not erase the existing snapshot. Report the two outcomes
and actual cutoffs separately; a successful build/deploy does not prove freshness.
If usable snapshots remain, a degraded refresh permits deployment. Full ledger
recovery is an explicit `pnpm tokendeals:backfill`, which checkpoints to Supabase.
Do not run an expensive full backfill on every release.

### 4. Version, validation and build

For an actual release, bump the version **before** building. Preserve Arena's
existing minor-bump convention unless the user requests another version:

```bash
python3 .agents/skills/morphe-economics/scripts/morphe.py bump-version
pnpm cache:test
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Do not bump or deploy for a request limited to refactoring or local verification.
See [nextjs-config.md](references/nextjs-config.md) for native binaries and pnpm.
Keep `output: "standalone"`, required public/config files, and the existing
research viewer assets. Exclude `.cache/**`, `.env*` and `.npmrc` from tracing.
Never copy cache files into standalone or add them back to tracing includes.

### 5. Package and verify

```bash
python3 .agents/skills/morphe-economics/scripts/morphe.py package --project-root . --framework nextjs
python3 .agents/skills/morphe-economics/scripts/verify-package.py code.zip
```

The packager stages public/static assets, repairs pnpm links, prunes native
binaries for linux-x64-gnu, removes local caches/credentials, and creates a zip
with `server.js` at its root. Verification fails on leaked cache/credential files
or missing required runtime assets. Never copy `.env.local` into the package.

### 6. Deploy and verify runtime behavior

```bash
python3 .agents/skills/morphe-economics/scripts/morphe.py deploy --zip code.zip --project-root . --timeout 3600
```

If the deploy call times out, inspect the actual function state before retrying;
do not assume every error is transient or blindly redeploy a successful release.

Use ordinary GETs against the returned live domain (HEAD may be rejected by the
gateway). Verify `/token-economics`, `/token-deals`, `/token-deals/ladder`, and
both `/api/token-*/live?range=all|72h` routes. Inspect `X-Cache-Source`,
`X-Cache-Persistence`, `to`, `stale`, and `live`. An HTTP 200 with stale or degraded
data is not proof that refresh persisted. Re-read shared metadata after a refresh
and confirm another cold process serves it with no repeated billing query.

Report release status, each refresh outcome, the data cutoffs, and any runtime
configuration/degradation separately. Never promise a fixed cold-start latency.
Inspect generated version/`.morphe.json` changes. Commit/push only within the
user's authorized release scope and keep unrelated working-tree edits intact.
