#!/usr/bin/env node
import { snapshotId, snapshotKey, validDeals, validEconomics, type SnapshotPayload } from "@research/cache/payload";
import { COMPARISON_REFRESH_SECONDS, COMPARISON_SNAPSHOT_ID, validComparison } from "@research/token-economics/comparison-snapshot";
import { DEFAULT_LIVE_START_ISO, type LiveRangeKey, type LiveTokenEconomicsPayload } from "@research/token-economics/live-config";
import { supabaseSnapshotStore } from "./supabase-writer";
import { fetchLiveTokenEconomics, incrementallyUpdateCache, closeDbPool } from "./economics";
import { fetchTokenDeals, incrementallyUpdate } from "./deals";
import { getPool, closeDealsDbPool, dealsStartMs, DAY } from "./billing-db";
import type { TokenDealsPayload } from "@research/token-deals/types";
import { buildComparison } from "./comparison";
import { runSnapshotJob, safeFailure } from "./job";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing ${name} value.`);
  return value;
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log("Usage: pnpm data:refresh [--modules comparison,economics,deals] [--ranges 72h,all] [--max-tail-hours 24] [--force] [--check]");
    return;
  }
  const allowed = new Set(["--modules", "--ranges", "--max-tail-hours", "--force", "--check"]);
  for (const value of process.argv.slice(2)) if (value.startsWith("--") && !allowed.has(value)) throw new Error("Unknown refresh option.");
  process.env.BILLING_DEALS_QUERY_TIMEOUT_MS ||= "300000";
  process.env.BILLING_ECON_QUERY_TIMEOUT_MS ||= "300000";
  const modules = (arg("--modules") ?? "comparison,economics,deals").split(",");
  const ranges = (arg("--ranges") ?? "72h,all").split(",");
  if (modules.some(m => !["comparison", "economics", "deals"].includes(m)) || ranges.some(r => !["all", "72h"].includes(r))) throw new Error("Invalid module or range.");
  const hours = Number(arg("--max-tail-hours") ?? "24");
  if (!Number.isFinite(hours) || hours < 1 || hours > 168) throw new Error("Tail window must be between 1 and 168 hours.");
  const now = new Date();
  const tailMs = hours * 3600000;
  const force = process.argv.includes("--force");
  if (process.argv.includes("--check")) {
    if (modules.some(m => m !== "comparison")) {
      const connection = await getPool().getConnection();
      try { await connection.query({ sql: "SELECT 1", timeout: 10000 }); } finally { connection.release(); }
      console.log("OK source database read access");
    }
    let missing = 0;
    if (modules.includes("comparison")) {
      const payload = await supabaseSnapshotStore(COMPARISON_SNAPSHOT_ID).read();
      const available = validComparison(payload);
      if (!available) missing++;
      console.log(JSON.stringify({ key: snapshotKey(COMPARISON_SNAPSHOT_ID), available, to: payload?.to }));
    }
    for (const range of [...new Set(ranges)] as LiveRangeKey[]) {
      for (const scope of ["token-economics", "token-deals"] as const) {
        if (!modules.includes(scope === "token-economics" ? "economics" : "deals")) continue;
        const id = snapshotId(scope, range);
        const payload = await supabaseSnapshotStore(id).read();
        const available = scope === "token-economics" ? validEconomics(payload, range) : validDeals(payload, range);
        if (!available) missing++;
        console.log(JSON.stringify({ key: snapshotKey(id), available, to: payload?.to }));
      }
    }
    if (missing) process.exitCode = 1;
    return;
  }
  let failures = 0;
  const execute = async <T extends SnapshotPayload>(label: string, run: () => Promise<T | { status: string; to?: string; stale?: boolean }>) => {
    const started = Date.now();
    try { console.log(JSON.stringify({ job: label, ...await run(), elapsedMs: Date.now() - started })); }
    catch (error) { failures++; console.error(JSON.stringify({ job: label, status: "failed", error: safeFailure(error), elapsedMs: Date.now() - started })); }
  };
  if (modules.includes("comparison")) await execute("comparison", () => runSnapshotJob({
    store: supabaseSnapshotStore(COMPARISON_SNAPSHOT_ID), valid: validComparison, force,
    fresh: p => Date.parse(p.generatedAt) + COMPARISON_REFRESH_SECONDS * 1000 > now.getTime(),
    build: () => buildComparison(now),
  }));
  for (const range of [...new Set(ranges)] as LiveRangeKey[]) {
    if (modules.includes("economics")) await execute(`economics:${range}`, () => runSnapshotJob({
      store: supabaseSnapshotStore<LiveTokenEconomicsPayload>(snapshotId("token-economics", range)),
      valid: (p): p is import("@research/token-economics/live-config").LiveTokenEconomicsPayload => validEconomics(p, range), force,
      fresh: p => Date.parse(p.to) >= Math.floor(now.getTime() / (Math.max(p.bucketSeconds, p.refreshIntervalSeconds) * 1000)) * Math.max(p.bucketSeconds, p.refreshIntervalSeconds) * 1000,
      async build(baseline) {
        const target = range === "all" && baseline ? new Date(Math.min(now.getTime(), Date.parse(baseline.to) + tailMs)) : now;
        if (baseline) {
          const updated = await incrementallyUpdateCache(range, baseline, target);
          if (updated) return { ...updated, generatedAt: now.toISOString() };
          if (range === "72h") return fetchLiveTokenEconomics(range, now);
          throw new Error("Snapshot configuration changed; use the explicit maintenance refresh.");
        }
        const start = Date.parse(process.env.TOKEN_ECON_LIVE_START_ISO || DEFAULT_LIVE_START_ISO);
        return fetchLiveTokenEconomics(range, range === "all" ? new Date(Math.min(now.getTime(), start + 15 * DAY * 1000)) : now);
      },
    }));
    if (modules.includes("deals")) await execute(`deals:${range}`, () => runSnapshotJob({
      store: supabaseSnapshotStore<TokenDealsPayload>(snapshotId("token-deals", range)),
      valid: (p): p is import("@research/token-deals/types").TokenDealsPayload => validDeals(p, range), force,
      fresh: p => Date.parse(p.to) >= Math.floor(now.getTime() / (p.refreshIntervalSeconds * 1000)) * p.refreshIntervalSeconds * 1000,
      async build(baseline) {
        if (baseline) {
          const updated = await incrementallyUpdate(range, baseline, now, range === "all" ? { maxTailMs: tailMs } : {});
          if (updated) return updated;
          if (range === "72h") return fetchTokenDeals(range, now);
          throw new Error("Snapshot configuration changed; use the explicit maintenance refresh.");
        }
        const target = range === "all" ? new Date(Math.min(now.getTime(), dealsStartMs() + tailMs)) : now;
        return { ...await fetchTokenDeals(range, target), generatedAt: now.toISOString(), lastSuccessAt: now.toISOString() };
      },
    }));
  }
  if (failures) process.exitCode = 1;
}

main().catch(error => { console.error(safeFailure(error)); process.exitCode = 1; }).finally(async () => {
  await Promise.allSettled([closeDbPool(), closeDealsDbPool()]);
});
