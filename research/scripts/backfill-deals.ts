#!/usr/bin/env tsx
// Resumable chunked backfill into Supabase; each committed chunk survives
// process restarts. Completion also creates an immutable Supabase archive.
import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { archiveSnapshot } from "../cache/archive";
import { DEALS_SCHEMA_VERSION, type TokenDealsPayload } from "@research/token-deals/types";
import { DAY, REFRESH_INTERVAL_SECONDS, closeDealsDbPool, dealsStartMs, floorTo } from "@research/token-deals/db";
import { loadDealsConfig } from "@research/token-deals/deals-config";
import {
  fetchTokenDeals,
  incrementallyUpdate,
  readSharedCache,
} from "@research/token-deals/query";

loadDotenv({ path: path.resolve(process.cwd(), ".env.local") });

// A build machine doesn't care about first-byte latency — give each chunk a
// 300s budget instead of the runtime's 120s (a busy month's chunk was measured
// at ~110s, too close to the line). Explicit env still wins.
process.env.TOKEN_DEALS_QUERY_TIMEOUT_MS ||= "300000";

const CHUNK_MS = 30 * DAY * 1000;
// High-traffic months can blow the 120s DB query timeout on a 30-day chunk —
// halve the step on failure down to this floor, grow back on success.
const MIN_CHUNK_MS = 2 * DAY * 1000;

function fmt(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function summarize(payload: TokenDealsPayload): string {
  const t = payload.totals;
  return `${payload.deals.length} deals, saved $${(t?.saved ?? 0).toFixed(2)}, paid $${(t?.paid ?? 0).toFixed(2)}`;
}

async function snapshotLedger(): Promise<void> {
  const payload = await readSharedCache("all");
  if (!payload) throw new Error("No shared ledger to archive.");
  await archiveSnapshot("token-deals", `backfill/all-${payload.to}.json`, payload);
  console.log("[tokendeals:backfill] Verified immutable Supabase ledger archive.");
}

async function main() {
  const config = await loadDealsConfig();
  const displayed =
    (config?.discounts.filter((d) => d.display).length ?? 0) +
    (config?.freeModels.filter((f) => f.display).length ?? 0);
  if (!config || displayed === 0) {
    console.error(
      "[tokendeals:backfill] ❌ config/token-deals.json missing or has no displayed entries — run `pnpm tokendeals:sync` and confirm the roster first.",
    );
    process.exit(1);
  }
  console.log(`[tokendeals:backfill] Roster: ${displayed} displayed entries. Storage: Supabase`);


  const startMs = dealsStartMs();
  const nowFloorMs = floorTo(Date.now(), REFRESH_INTERVAL_SECONDS);

  let baseline = await readSharedCache("all");
  if (baseline && baseline.schema === DEALS_SCHEMA_VERSION && baseline.live) {
    console.log(`[tokendeals:backfill] Resuming from existing v${DEALS_SCHEMA_VERSION} baseline (data → ${baseline.to}).`);
  } else {
    const firstTarget = Math.min(startMs + CHUNK_MS, nowFloorMs);
    console.log(`[tokendeals:backfill] Bootstrapping ledger: ${fmt(startMs)} → ${fmt(firstTarget)}…`);
    const started = Date.now();
    baseline = await fetchTokenDeals("all", new Date(firstTarget), { persist: true });
    console.log(`[tokendeals:backfill] ✅ Bootstrap chunk done: ${summarize(baseline)} (${Date.now() - started}ms)`);
  }

  let chunk = 0;
  let stepMs = CHUNK_MS;
  for (;;) {
    const baselineTo = Date.parse(baseline.to);
    if (baselineTo >= nowFloorMs) break;
    const target = Math.min(baselineTo + stepMs, nowFloorMs);
    chunk += 1;
    const started = Date.now();
    let merged: TokenDealsPayload | null;
    try {
      merged = await incrementallyUpdate("all", baseline, new Date(target), {
        persist: true,
        allowLargeTail: true,
        maxNewDealLookbackMs: Infinity,
      });
    } catch (err) {
      if (stepMs > MIN_CHUNK_MS) {
        stepMs = Math.max(MIN_CHUNK_MS, Math.floor(stepMs / 2));
        console.warn(
          `[tokendeals:backfill] ⚠️  Chunk ${chunk} (${fmt(baselineTo)} → ${fmt(target)}) failed (${err instanceof Error ? err.message : err}) — retrying with ${Math.round(stepMs / (DAY * 1000))}-day steps`,
        );
        chunk -= 1;
        continue;
      }
      throw err;
    }
    if (!merged) {
      throw new Error(`chunk ${chunk} (${fmt(baselineTo)} → ${fmt(target)}) was not mergeable — baseline schema/bucket mismatch`);
    }
    baseline = merged;
    console.log(
      `[tokendeals:backfill] ✅ Chunk ${chunk}: ledger advanced to ${fmt(Date.parse(baseline.to))} — ${summarize(baseline)} (${Date.now() - started}ms)`,
    );
    // Ease the step back up after a smooth chunk.
    if (stepMs < CHUNK_MS) stepMs = Math.min(CHUNK_MS, stepMs * 2);
  }

  console.log("[tokendeals:backfill] Rebuilding the 72h hourly cache…");
  const h72 = await fetchTokenDeals("72h", new Date(), { persist: true });
  console.log(`[tokendeals:backfill] ✅ 72h cache: ${summarize(h72)}`);

  await snapshotLedger();
  console.log(
    `[tokendeals:backfill] 🎉 Ledger complete: ${baseline.from.slice(0, 10)} → ${baseline.to} · ${summarize(baseline)}`,
  );
  await closeDealsDbPool();
}

main().catch(async (err) => {
  console.error("[tokendeals:backfill] Fatal error:", err);
  await closeDealsDbPool();
  process.exit(1);
});
