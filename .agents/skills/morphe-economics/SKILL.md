---
name: morphe-economics
description: Fully independent deployment skill for ZenMux projects with live token economics dashboards. Automatically runs incremental pre-aggregation of live data and packages warm cache into deployment for instant cold starts. Does NOT depend on base morphe skill - all scripts are bundled directly. Use when deploying ZenMux Arena or any project with the token economics live dashboard to get zero-timeout instant page loads.
---

# Morphe Economics (ZenMux Token Economics Optimized Deploy)

## Overview
**Fully independent deployment skill** for ZenMux Arena and other projects with live token economics dashboards. Does **NOT** depend on the base `morphe` skill - all required scripts are bundled directly in this skill directory. Key features:
- 🚀 **Automatic incremental pre-aggregation** of token economics data before build
- 🔥 **Instant cold starts**: Warm cache packaged directly into deployment, no DB queries on first visit
- ⚡ **Blazing fast pre-deploy step**: Incremental caching only fetches new data since last run (typically 1-5 seconds, not minutes)
- 🛡️ **Non-blocking design**: If pre-aggregation fails for any reason, deployment proceeds normally and the app does a one-time full DB fetch on first request (read-only runtime never writes; the L1 in-memory cache absorbs the rest)
- 📦 **Self-contained**: All deploy scripts are included, no external dependencies on other skills

## Usage
Invoke directly with: `/morphe-economics [app-name]`
- If app name is not provided, defaults to the current directory name (for this repo: `arena`)

## Workflow (Fully Automated, Run All Steps In Order)
Execute all steps below from the project root, using scripts bundled inside `.agents/skills/morphe-economics/scripts/` (no external dependencies).

---

### Step 1: Ensure Logged In
Log in via the browser — **never ask the user for a username or password**:

```bash
bash .agents/skills/morphe-economics/scripts/login.sh
```

This works like `gh auth login` / `vercel login`: the user only clicks in the browser, no copy-pasting tokens.

- If a valid `accessToken` already exists in `~/.morphe/auth.json`, the script reuses it and skips the browser (prints `AUTH_OK=1` immediately).
- Otherwise it starts a local callback server, opens the browser to `morphe.zenmux.app/cli-auth` (prints `OPEN_AUTH=<url>` — surface this to the user in case the browser can't auto-open), and waits. The user logs in (password or Google) and clicks **「授权并返回终端」**; the browser POSTs the token back and the script writes it to `~/.morphe/auth.json`.
- On success the script prints `AUTH_OK=1`. To force a fresh login (e.g. switch accounts), run `bash .agents/skills/morphe-economics/scripts/login.sh --force`.
- If the script errors or times out (no `AUTH_OK=1`), report the error and stop.

---

### Step 2: Resolve Function Name
Use the provided app name or detect from directory name:
```bash
APP_NAME="${1:-$(basename "$PWD")}"
echo "🚀 Deploying to Morphe function: $APP_NAME"
python3 .agents/skills/morphe-economics/scripts/morphe.py set-function-name --name "$APP_NAME" 2>/dev/null || echo "ℹ️  Function name already set"
```

---

### Step 3: Bump Version (auto-increment, runs BEFORE the build)
Increment `package.json`'s version so the in-app build badge advances on every
deploy. This **must** run before `pnpm build` — `next.config.ts` reads
`package.json`'s `version` at build time and bakes it into the bundle, so a bump
after the build would not ship.

Default behavior is a **minor bump** (`X.Y.Z → X.(Y+1).0`, e.g. `0.22.0 →
0.23.0`) — what the user calls "+0.1". The script edits `package.json` in place,
preserving its formatting (only the version line changes):
```bash
echo ""
echo "=== Bumping app version (minor +1 by default) ==="
python3 .agents/skills/morphe-economics/scripts/morphe.py bump-version
```
Variations (only if explicitly requested):
- Patch fix: `... bump-version --part patch`   (`0.22.0 → 0.22.1`)
- Major release: `... bump-version --part major` (`0.22.0 → 1.0.0`)
- Pin exact: `... bump-version --set 1.0.0`

> The bumped `package.json` is part of the deploy diff — commit it (or let it
> ride as a working-tree change). The build badge then reads `v0.23.0` while the
> git sha + build time auto-refresh on their own (see `next.config.ts` /
> `src/components/BuildStamp.tsx`).

---

### Step 4: Run Incremental Pre-Aggregation
This step warms the token economics cache before building, using incremental updates to minimize runtime:
```bash
bash .agents/skills/morphe-economics/scripts/predeploy.sh
```
This script automatically:
- Detects if the project has the token economics precompute script
- Loads environment variables from `.env.local`
- Runs **incremental** pre-aggregation: only fetches new data since last cache + 12 bucket overlap to fix late-arriving DB records
- Automatically cleans up DB connections so it doesn't hang
- Never fails the deployment on precompute errors (just warns loudly and continues)
- Prints a **data-freshness report** before AND after refresh — each range's
  actual data cutoff (`to`) and how many minutes it lags `now` — so a daily
  deploy can confirm at a glance that the shipped baseline really advanced. If
  precompute fails it prints a loud banner naming the (unchanged, stale)
  baseline it is about to ship.

---

### Step 5: Verify Build Configuration
Ensure Next.js is configured to include the `.cache` directory in standalone output. For this project, it's already pre-configured, but automatically add it if missing:
```bash
if ! grep -q '\.cache/\*\*' next.config.ts 2>/dev/null && ! grep -q '\.cache/\*\*' next.config.js 2>/dev/null; then
  echo "🔧 Adding .cache to outputFileTracingIncludes in next config..."
  # Auto-add config if missing (edit next.config.ts appropriately)
fi
```
Required config (Next.js 15+ — `outputFileTracingIncludes` is a **top-level**
key, NOT under `experimental`):
```ts
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/token-economics/live/**": ["./.cache/**"],
  },
};
```
> This makes `next build`'s tracer pull `.cache/**` into `.next/standalone/`.
> Step 6 below ALSO copies it in by hand — that's deliberate belt-and-braces:
> the trace include can miss freshly-written files depending on build timing,
> so the explicit copy guarantees the just-refreshed baseline is packaged.

---

### Step 6: Production Build
Run standard Next.js production build:
```bash
echo ""
echo "=== Building production bundle ==="
pnpm build
```

---

### Step 7: Copy Cache into Standalone Before Packaging
The morphe.py packager handles copying `.next/static` and `public/` automatically. We only need to copy the `.cache` directory into `.next/standalone/` so it gets included in the zip:
```bash
echo ""
echo "=== Copying token economics cache into standalone ==="
if [ -d ".cache/token-economics/live" ] && [ "$(ls -A .cache/token-economics/live)" ]; then
  mkdir -p .next/standalone/.cache/token-economics/live
  cp -f .cache/token-economics/live/*.json .next/standalone/.cache/token-economics/live/
  echo "✅ Token economics cache staged in standalone dir"
else
  echo "ℹ️  No cache directory found; runtime will do a one-time full DB fetch on first request (no baseline packaged)"
fi
```
> **Note**: morphe.py already handles `.next/static` and `public/` during the package step — do NOT manually cp those, it would duplicate them.

---

### Step 8: Package Deployment Zip (Use official morphe packager)
Use the bundled morphe.py package command for Next.js - it automatically handles native binary pruning for linux-x64, fixes pnpm symlink issues, and preserves symlinks to reduce package size:
```bash
echo ""
echo "=== Packaging deployment (linux-x64 optimized) ==="
python3 .agents/skills/morphe-economics/scripts/morphe.py package --framework nextjs

# morphe.py writes code.zip to the PROJECT ROOT (not .next/code.zip)
PACKAGE_SIZE=$(ls -lh code.zip | awk '{print $5}')
echo "📦 Deployment package: code.zip ($PACKAGE_SIZE)"

# Verify server.js is at the zip root and cache is included
if ! unzip -l code.zip | grep -qE "^[[:space:]]+[0-9]+ .+ server\.js$"; then
  echo "❌ Error: server.js not found at zip root, deployment would fail!"; exit 1
fi
if unzip -l code.zip | grep -q ".cache/token-economics/live/.*\.json"; then
  echo "✅ Cache files verified in deployment package (instant cold start guaranteed)"
else
  echo "⚠️  Warning: Cache not found in package; runtime will do a one-time full DB fetch on first request"
fi
```

---

### Step 9: Deploy to Morphe
Upload and deploy, with one automatic retry on transient timeout errors:
```bash
echo ""
echo "=== Deploying to Morphe ==="
if ! python3 .agents/skills/morphe-economics/scripts/morphe.py deploy --zip code.zip --timeout 3600; then
  echo "⚠️  First deploy attempt hit transient timeout, retrying..."
  sleep 5
  python3 .agents/skills/morphe-economics/scripts/morphe.py deploy --zip code.zip --timeout 3600
fi

echo ""
echo "🎉 Deployment complete!"
echo "💡 Token economics page will load instantly from pre-built cache"
```

---

## Deploy Guarantees
| Metric | Standard morphe deploy | morphe-economics deploy |
|--------|-------------------------|--------------------------|
| Pre-deploy pre-aggregation | ❌ Manual, full fetch every time | ✅ Automatic incremental fetch (~1-5s) |
| Cold start first visit latency | 10-60s (DB aggregation, risk of timeout) | <100ms (reads local JSON cache) |
| DB connection dependency at startup | Required | Not needed for initial load (stale cache returned while refreshing) |
| Deployment failure risk | Precompute failures can block deploy | Precompute errors just warn, deploy always proceeds |
| External dependencies | Requires base morphe skill | ❌ None (fully self-contained, all scripts bundled) |
| Cache persistence across deployments | ❌ Fresh cold cache every deploy | ✅ Cache packaged into artifact, warm immediately on boot |

## Cache Architecture on Production
The production filesystem is **read-only**: the runtime never writes the cache,
it only reads the packaged JSON baseline and queries the DB for the new tail.
After deployment, the token economics API serves a live leaderboard like this:
1. **L1 In-memory cache** (10s TTL): serves hot concurrent bursts with zero DB load.
2. **Single-flight**: at most one incremental DB query per range runs at a time;
   concurrent callers share its result.
3. **Baseline + incremental tail**: the packaged `.cache/<range>.json` is the
   historical baseline (all older buckets, reused as-is). Each request queries
   the DB **only** for `baseline.to → now` (plus a small overlap for late data)
   and merges in memory. The bulk of the series is never re-queried, so the live
   number stays current without a full re-aggregation.
4. **Stale fallback**: if the incremental DB query fails (transient blip), the
   packaged baseline is served with `stale: true` so the page never hard-fails.

The runtime is **read-only**: it never writes to disk. The only writer is the
`tokenecon:precompute` step on the writable build machine, whose output is
packaged into the deploy artifact (Step 6).

## Fallback Behavior
If *anything* goes wrong with pre-aggregation (DB down, network issues, script errors):
1. Clear warning is printed during deployment
2. Deployment continues normally and succeeds
3. The deployed app ships without a packaged baseline; on the first request the
   runtime does one full DB fetch (slower cold start) and serves it from the L1
   in-memory cache. It still never writes to the read-only disk.
4. No data loss, no downtime, no broken functionality - pre-aggregation is purely a performance optimization.
