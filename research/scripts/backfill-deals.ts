#!/usr/bin/env tsx
// Backfill the Token Deals ledger from ZenMux's launch (2025-09-29) in chunks.
//
// The daily ledger IS the packaged baseline: .cache/token-deals/all.json holds
// per-deal 1-day buckets, so "backfill" simply advances that baseline from the
// launch day to now, ≤30 days per step, through the SAME incremental-merge
// machinery the runtime uses (research/token-deals/query.ts). Each chunk:
//   · only queries slugs whose registered deal windows intersect the chunk
//     (discount models are never pulled outside their windows; free models
//     run from max(publishDate, launch)),
//   · persists atomically (tmp → rename) → Ctrl-C anytime, rerun resumes from
//     the baseline's `to`.
//
// CACHE PROTECTION — this script never deletes anything:
//   · a pre-v4 all.json/72h.json is COPIED to backups/<range>.v<schema>.bak.json
//     before the new baseline overwrites the live filename;
//   · on completion all.json is COPIED to backups/all.snapshot-<date>.json so
//     the expensive full-history ledger survives even if the live file is ever
//     clobbered.
// Backups live in the backups/ SUBDIR on purpose: the runtime only ever reads
// <range>.json, and the deploy packaging globs .cache/token-deals/*.json —
// keeping backups out of the top level keeps them out of the shipped artifact.
//
//   pnpm tokendeals:backfill

import { config as loadDotenv } from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { DEALS_SCHEMA_VERSION, type TokenDealsPayload } from "@research/token-deals/types";
import { DAY, REFRESH_INTERVAL_SECONDS, closeDealsDbPool, dealsStartMs, floorTo } from "@research/token-deals/db";
import { loadDealsConfig } from "@research/token-deals/deals-config";
import {
  cacheDir,
  fetchTokenDeals,
  incrementallyUpdate,
  readJsonCache,
} from "@research/token-deals/query";

loadDotenv({ path: path.resolve(process.cwd(), ".env.local") });

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

function backupsDir(): string {
  return path.join(cacheDir(), "backups");
}

/** Copy (never move/delete) a legacy-schema cache aside before it gets
    superseded. Idempotent: an existing backup is left alone. */
async function backupLegacyCache(range: "all" | "72h"): Promise<void> {
  const existing = await readJsonCache(range);
  if (!existing || existing.schema === DEALS_SCHEMA_VERSION) return;
  const src = path.join(cacheDir(), `${range}.json`);
  const dest = path.join(backupsDir(), `${range}.v${existing.schema ?? 1}.bak.json`);
  try {
    await fs.access(dest);
    return; // backup already there
  } catch {
    /* fall through */
  }
  await fs.mkdir(backupsDir(), { recursive: true });
  await fs.copyFile(src, dest);
  console.log(`[tokendeals:backfill] 🛟 Backed up legacy ${range}.json (schema ${existing.schema ?? "none"}) → backups/${path.basename(dest)}`);
}

async function snapshotLedger(): Promise<void> {
  const src = path.join(cacheDir(), "all.json");
  const dest = path.join(backupsDir(), `all.snapshot-${new Date().toISOString().slice(0, 10)}.json`);
  try {
    await fs.access(dest);
    return;
  } catch {
    /* fall through */
  }
  await fs.mkdir(backupsDir(), { recursive: true });
  await fs.copyFile(src, dest);
  console.log(`[tokendeals:backfill] 🛟 Ledger snapshot written: backups/${path.basename(dest)}`);
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
  console.log(`[tokendeals:backfill] Roster: ${displayed} displayed entries. Cache dir: ${cacheDir()}`);

  await backupLegacyCache("all");
  await backupLegacyCache("72h");

  const startMs = dealsStartMs();
  const nowFloorMs = floorTo(Date.now(), REFRESH_INTERVAL_SECONDS);

  let baseline = await readJsonCache("all");
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
