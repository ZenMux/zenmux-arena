---
name: morphe-plus
description: Enhanced Morphe deployment for ZenMux projects with pre-built data pre-aggregation step. Automatically pre-fetches and caches token economics data before build, packages .cache directory into the deployment artifact so production has warm cache immediately on startup, avoiding cold-start DB queries and timeouts. Extends the base morphe skill.
---

# Morphe Plus (ZenMux Enhanced Deploy)

## Overview
Upgraded version of the base `morphe` skill specifically for ZenMux projects. Adds a mandatory **pre-deployment data pre-aggregation step** that fetches token economics live data and caches it to `.cache/token-economics/live/` before building, then packages this cache into the deployment artifact. This ensures:
- Production deployments have warm cache immediately after startup
- No cold-start DB queries or timeouts on first visit
- First page load is instant, no waiting for DB aggregation
- Fallback logic still works: if cache is stale/missing, app will fetch fresh data and re-cache automatically

All base morphe functionality (framework detection, build, packaging, upload, deploy) is preserved — this skill adds the pre-aggregation step before build and configures packaging to include the cache.

## Workflow
Execute all base morphe steps **EXCEPT insert the pre-aggregation step between step 3 (resolve function name) and step 4 (validate & fix build config)**.

### Added Step: Pre-aggregate token economics data
After resolving function name but before building:

1. **Check if project has token economics precompute script**:
   ```bash
   if [ -f "research/scripts/precompute-live.ts" ] && grep -q "tokenecon:precompute" package.json; then
     # Project supports pre-aggregation, run it
     echo "=== Pre-aggregating token economics live data ==="
     # Load env vars from .env.local if it exists
     if [ -f ".env.local" ]; then
       export $(grep -v '^#' .env.local | xargs)
     fi
     pnpm tokenecon:precompute
     # Verify cache was generated
     if [ -d ".cache/token-economics/live" ] && [ "$(ls -A .cache/token-economics/live)" ]; then
       echo "✅ Token economics cache generated successfully:"
       ls -lh .cache/token-economics/live/
     else
       echo "⚠️  Warning: Token economics cache was not generated, deployment will use live DB fetch on first visit"
     fi
   else
     echo "ℹ️  No token economics precompute script found, skipping pre-aggregation"
   fi
   ```

2. **Configure Next.js to include .cache directory in standalone output** (only for Next.js projects):
   Check if `next.config.js`/`next.config.ts` already has `outputFileTracingIncludes` for `.cache/**`. If not, add it:
   ```js
   // next.config.js add to existing config:
   experimental: {
     outputFileTracingIncludes: {
       '/api/token-economics/live/**': ['./.cache/**'],
     },
   }
   ```
   *Note: This ensures the `.cache` directory is copied into the standalone build output that gets deployed. If the file already has this config, leave it as-is.*

3. **Add `.cache` to the files included in the deployment zip**:
   When running the `morphe.py package` step in step 6, ensure you pass the extra `--include .cache` flag if the script supports it, or manually copy the `.cache` directory into the build output directory before zipping.

### Remaining Steps
Continue with all normal morphe steps (validate config → build → package → upload → deploy) unchanged.

## Key Differences from Base Morphe
| Feature | Base morphe | morphe-plus |
|---------|-------------|-------------|
| Pre-deployment data pre-fetch | ❌ | ✅ Automatically runs `pnpm tokenecon:precompute` before build |
| Warm cache on production startup | ❌ First request hits DB | ✅ Cache is packaged into deployment, first request is instant |
| Timeout risk on first visit | High (large range queries take >60s) | Zero (reads directly from local JSON) |
| .cache included in build | ❌ | ✅ Automatically configured for Next.js standalone output |
| Backward compatible | - | ✅ Falls back to live DB fetch if cache is missing, no breakage |

## Fallback Behavior
If pre-aggregation fails for any reason (DB unavailable, script error), the deployment will still succeed — the app will just fetch data from DB on first visit and cache it locally automatically, same as before. The pre-aggregation step is non-blocking for deployment.

## Usage
Invoke this skill instead of `morphe` when deploying ZenMux projects that have the token economics live dashboard (the `/token-economics` page) to get instant cold starts and no DB timeouts in production.
