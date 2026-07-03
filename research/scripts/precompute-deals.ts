// Precompute the Token Deals（让利账本）baseline caches.
//
// Runs the full DB aggregation for both ranges and persists them to
// .cache/token-deals/{all,72h}.json — the packaged baselines the read-only
// runtime extends incrementally (see research/token-deals/query.ts). Run this
// on a writable machine with the TOKEN_ECON_LIVE_DB_* env set, before or during
// deploy, exactly like tokenecon:precompute does for the live leaderboard.
//
//   pnpm tokendeals:precompute

import { DEAL_RANGE_OPTIONS } from "../token-deals/deals-config";
import { closeDealsDbPool, fetchTokenDeals } from "../token-deals/query";

async function main() {
  const now = new Date();
  for (const range of DEAL_RANGE_OPTIONS) {
    const started = Date.now();
    const payload = await fetchTokenDeals(range.key, now, { persist: true });
    console.log(
      `[token-deals] precomputed ${range.key}: ${payload.deals.length} deals, ` +
        `${payload.from.slice(0, 10)} → ${payload.to}, ` +
        `total saved $${payload.totals?.saved.toFixed(2) ?? "—"} ` +
        `(${Date.now() - started}ms)`,
    );
  }
}

main()
  .catch((err) => {
    console.error("[token-deals] precompute failed:", err);
    process.exitCode = 1;
  })
  .finally(() => closeDealsDbPool());
