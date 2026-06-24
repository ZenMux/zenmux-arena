#!/bin/bash
# morphe-economics pre-deployment script: refresh the token-economics baseline
# before building, so the deploy artifact ships with fresh pre-aggregated data.
#
# Designed for a daily manual deploy whose whole purpose is to refresh data:
# it makes the shipped baseline's freshness LOUD and unmissable, but never hard-
# blocks the deploy (the read-only runtime tops up the tail incrementally at
# request time regardless, so shipping a slightly-old baseline is still safe).
set -euo pipefail

echo "=== [morphe-economics] Pre-deployment: refreshing token-economics baseline ==="

# Check for token economics precompute support
if [ -f "research/scripts/precompute-live.ts" ] && grep -q "tokenecon:precompute" package.json; then
  echo "✅ Token economics live feature detected"
else
  echo "ℹ️ No token economics precompute script found, skipping pre-aggregation"
  exit 0
fi

CACHE_DIR=".cache/token-economics/live"

# Prints each cached range's data window + how stale it is vs. now. Reads the
# JSON `to`/`generatedAt` fields (not file mtime) so you see the ACTUAL data age
# you are about to ship. `node` is always present (this is a Next.js project).
report_freshness() {
  if [ ! -d "$CACHE_DIR" ] || [ -z "$(ls -A "$CACHE_DIR" 2>/dev/null)" ]; then
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
  ' "$CACHE_DIR"
}

# Snapshot pre-existing baseline age so we can tell the user what they'd ship if
# precompute fails.
echo ""
echo "--- Baseline BEFORE refresh ---"
report_freshness

echo ""
echo "=== [morphe-economics] Incrementally pre-aggregating token economics data ==="
if ! pnpm tokenecon:precompute; then
  echo ""
  echo "############################################################"
  echo "⚠️  PRE-AGGREGATION FAILED — baseline was NOT refreshed."
  echo "    Deploy will continue and ship the PREVIOUS baseline below."
  echo "    The read-only runtime will top up the tail from the DB on"
  echo "    first request, so data is still correct (just a bigger first"
  echo "    incremental query). Re-run the deploy once the DB is reachable"
  echo "    if you want today's fresh baseline packaged."
  echo "############################################################"
  echo "--- Baseline being shipped (UNCHANGED, stale) ---"
  report_freshness
  exit 0
fi

echo ""
if [ -d "$CACHE_DIR" ] && [ -n "$(ls -A "$CACHE_DIR" 2>/dev/null)" ]; then
  echo "✅ Token economics baseline refreshed. Shipping this data:"
  report_freshness
else
  echo "⚠️  Warning: cache directory empty after precompute; runtime will do a one-time full DB fetch on first request."
fi

echo ""
echo "=== [morphe-economics] Pre-deployment complete ==="
