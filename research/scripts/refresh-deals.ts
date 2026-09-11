#!/usr/bin/env tsx
// Explicit maintenance refresh; writes shared Supabase snapshots independently
// of builds. Billing calculations and deep late-arrival overlap are preserved.
import { config as loadDotenv } from "dotenv";
import path from "node:path";
import {
  DEAL_RANGE_OPTIONS,
  type DealRangeKey,
  type TokenDealsPayload,
} from "@research/token-deals/types";
import {
  closeDealsDbPool,
  fetchTokenDeals,
  incrementallyUpdate,
  readSharedCache,
} from "@research/token-deals/query";

// Load .env.local for local runs (Morphe deployments inject env vars directly)
loadDotenv({ path: path.resolve(process.cwd(), ".env.local") });

// Maintenance refresh: same relaxed query budget as the backfill script (the
// runtime keeps the tight default). Explicit env still wins.
process.env.TOKEN_DEALS_QUERY_TIMEOUT_MS ||= "300000";

function summarize(payload: TokenDealsPayload): string {
  const freeCount = payload.deals.filter((d) => d.dealType === "free").length;
  const t = payload.totals;
  const split = t
    ? `saved $${t.saved.toFixed(2)} (PAYG $${(t.saved - t.subSaved).toFixed(2)} + 订阅 $${t.subSaved.toFixed(2)}), ` +
      `paid $${t.paid.toFixed(2)} (PAYG $${(t.paid - t.subPaid).toFixed(2)} + 订阅 $${t.subPaid.toFixed(2)})`
    : "no totals";
  return `${payload.deals.length} deals (${freeCount} free), ${payload.from.slice(0, 10)} → ${payload.to}, ${split}`;
}

async function refreshRange(range: DealRangeKey, index: number, total: number): Promise<void> {
  const prefix = `[refresh-deals] [${index + 1}/${total}] ${range.padEnd(4)}`;
  const started = Date.now();

  const existing = await readSharedCache(range);
  if (existing) {
    console.log(`${prefix} Found shared snapshot (data → ${existing.to}), attempting incremental update...`);
    // Maintenance refresh: no lookback cap — a newly-configured deal gets its
    // whole window (the serverless runtime caps this instead).
    const merged = await incrementallyUpdate(range, existing, new Date(), {
      persist: true,
      maxNewDealLookbackMs: Infinity,
    });
    if (merged) {
      const newBuckets = Math.max(
        0,
        Math.round((Date.parse(merged.to) - Date.parse(existing.to)) / (merged.bucketSeconds * 1000)),
      );
      console.log(`${prefix} ✅ Incremental update done (+${newBuckets} new buckets): ${summarize(merged)} (${Date.now() - started}ms)`);
      return;
    }
    console.log(`${prefix} Incremental update not possible (schema/bucket change).`);
  }

  // The "all" range spans the whole ledger (2025-09-29 → now); rebuilding it
  // is the chunked backfill script's job, never a single monster query.
  if (range === "all") {
    throw new Error(
      "no usable 'all' baseline — run `pnpm tokendeals:backfill` to (re)build it in chunks",
    );
  }
  const payload = await fetchTokenDeals(range, new Date(), { persist: true });
  console.log(`${prefix} ✅ Full fetch done: ${summarize(payload)} (${Date.now() - started}ms)`);
}

async function main() {
  const ranges = DEAL_RANGE_OPTIONS.map((r) => r.key);
  console.log(`[refresh-deals] Refreshing shared snapshots for ${ranges.length} ranges: ${ranges.join(", ")}`);
  console.log(`[refresh-deals] Shared cache: Supabase arena_snapshot_cache (token-deals)`);
  console.log();

  const failures: Array<{ range: string; reason: unknown }> = [];
  for (let i = 0; i < ranges.length; i++) {
    try {
      await refreshRange(ranges[i], i, ranges.length);
    } catch (err) {
      failures.push({ range: ranges[i], reason: err });
      console.error(`[refresh-deals] [${i + 1}/${ranges.length}] ${ranges[i]} ❌ Failed: ${err instanceof Error ? err.message : err}`);
    }
    console.log();
  }

  if (failures.length > 0) {
    console.error(`[refresh-deals] ❌ ${failures.length}/${ranges.length} ranges failed.`);
    await closeDealsDbPool();
    process.exit(1);
  }
  console.log(`[refresh-deals] 🎉 All shared snapshots refreshed successfully!`);
  await closeDealsDbPool();
}

main().catch(async (err) => {
  console.error("[refresh-deals] Fatal error:", err);
  await closeDealsDbPool();
  process.exit(1);
});
