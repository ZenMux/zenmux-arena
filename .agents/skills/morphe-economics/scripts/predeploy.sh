#!/bin/bash
# morphe-economics pre-deployment script: refresh the token-economics AND
# token-deals baselines before building, so the deploy artifact ships with
# fresh pre-aggregated data for both live dashboards.
#
# Designed for a daily manual deploy whose whole purpose is to refresh data:
# it makes the shipped baselines' freshness LOUD and unmissable, but never
# hard-blocks the deploy (the read-only runtime tops up the tail incrementally
# at request time regardless, so shipping a slightly-old baseline is still
# safe). Each module refreshes independently — a token-deals failure never
# blocks the token-economics refresh, and vice versa.
set -euo pipefail

echo "=== [morphe-economics] Pre-deployment: refreshing live baselines ==="

# Prints each cached range's data window + how stale it is vs. now. Reads the
# JSON `to`/`generatedAt` fields (not file mtime) so you see the ACTUAL data age
# you are about to ship. `node` is always present (this is a Next.js project).
report_freshness() {
  local dir="$1"
  if [ ! -d "$dir" ] || [ -z "$(ls -A "$dir" 2>/dev/null)" ]; then
    echo "   (no cache files present)"
    return
  fi
  node -e '
    const fs = require("fs"), path = require("path");
    const dir = process.argv[1];
    const now = Date.now();
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort()) {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
        const ageMin = Math.round((now - new Date(d.to).getTime()) / 60000);
        const flag = ageMin > 60 ? "  ⚠️  >1h behind" : "";
        console.log(`   ${f.padEnd(10)} data → ${d.to}  (${ageMin}m behind now)${flag}`);
      } catch (e) {
        console.log(`   ${f.padEnd(10)} ⚠️  unreadable: ${e.message}`);
      }
    }
  ' "$dir"
}

# refresh_module <label> <cache-dir> <pnpm-script> [fallback-pnpm-script]
# Runs one module's incremental precompute; on failure tries the fallback
# script (if given) before giving up — token-deals passes its chunked backfill
# here, which halves the query window on timeout and so succeeds where the
# one-shot incremental can't (an old baseline's tail query blowing the DB
# timeout). Only after BOTH fail does the loud stale-baseline banner print,
# and even then deploy continues — precompute is a performance optimization,
# never a deploy blocker.
refresh_module() {
  local label="$1" cache_dir="$2" script="$3" fallback="${4:-}"

  echo ""
  echo "--- [$label] Baseline BEFORE refresh ---"
  report_freshness "$cache_dir"

  echo ""
  echo "=== [morphe-economics] Incrementally pre-aggregating $label ==="
  if ! pnpm "$script"; then
    if [ -n "$fallback" ]; then
      echo ""
      echo "⚠️  [$label] Incremental precompute failed — falling back to chunked $fallback"
      if pnpm "$fallback"; then
        echo ""
        echo "✅ [$label] Baseline recovered via $fallback. Shipping this data:"
        report_freshness "$cache_dir"
        return 0
      fi
    fi
    echo ""
    echo "############################################################"
    echo "⚠️  [$label] PRE-AGGREGATION FAILED — baseline NOT refreshed."
    echo "    Deploy will continue and ship the PREVIOUS baseline below."
    echo "    The read-only runtime will top up the tail from the DB on"
    echo "    first request, so data is still correct (just a bigger first"
    echo "    incremental query). Re-run the deploy once the DB is reachable"
    echo "    if you want today's fresh baseline packaged."
    echo "############################################################"
    echo "--- [$label] Baseline being shipped (UNCHANGED, stale) ---"
    report_freshness "$cache_dir"
    return 0
  fi

  echo ""
  if [ -d "$cache_dir" ] && [ -n "$(ls -A "$cache_dir" 2>/dev/null)" ]; then
    echo "✅ [$label] Baseline refreshed. Shipping this data:"
    report_freshness "$cache_dir"
  else
    echo "⚠️  [$label] Warning: cache directory empty after precompute; runtime will do a one-time full DB fetch on first request."
  fi
}

FOUND_ANY=0

if [ -f "research/scripts/precompute-live.ts" ] && grep -q "tokenecon:precompute" package.json; then
  FOUND_ANY=1
  refresh_module "token-economics" ".cache/token-economics/live" "tokenecon:precompute"
else
  echo "ℹ️ No token-economics precompute script found, skipping"
fi

if [ -f "research/scripts/precompute-deals.ts" ] && grep -q "tokendeals:precompute" package.json; then
  FOUND_ANY=1
  DEALS_FALLBACK=""
  if grep -q "tokendeals:backfill" package.json; then
    DEALS_FALLBACK="tokendeals:backfill"
  fi
  refresh_module "token-deals" ".cache/token-deals" "tokendeals:precompute" "$DEALS_FALLBACK"
else
  echo "ℹ️ No token-deals precompute script found, skipping"
fi

if [ "$FOUND_ANY" = "0" ]; then
  echo "ℹ️ No live precompute scripts found in this project, nothing to pre-aggregate"
  exit 0
fi

echo ""
echo "=== [morphe-economics] Pre-deployment complete ==="
