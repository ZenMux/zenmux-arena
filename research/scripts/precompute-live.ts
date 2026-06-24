#!/usr/bin/env tsx
import { config as loadDotenv } from "dotenv";
import path from "path";
import { closeDbPool, fetchLiveTokenEconomics, incrementallyUpdateCache, readJsonCache } from "@research/token-economics/live-query";
import { LIVE_RANGE_OPTIONS, type LiveRangeKey } from "@research/token-economics/live-config";

// Load .env.local for local runs (Morphe deployments inject env vars directly)
loadDotenv({ path: path.resolve(process.cwd(), ".env.local") });

function formatPercent(p?: number): string {
  if (p == null) return "    ";
  return `${p.toString().padStart(3)}%`;
}

async function precomputeRange(range: LiveRangeKey, index: number, total: number): Promise<void> {
  const prefix = `[precompute-live] [${index + 1}/${total}] ${range.padEnd(4)}`;
  console.log(`${prefix} Starting...`);

  // Try incremental update first if existing cache exists
  const existing = await readJsonCache(range);
  if (existing) {
    process.stdout.write(`\r${prefix} ${formatPercent(0)} Found existing cache (up to ${existing.to.slice(0, 16).replace("T", " ")}), attempting incremental update...`);
    const data = await incrementallyUpdateCache(range, existing, undefined, {
      onProgress: (prog) => {
        process.stdout.write(`\r${prefix} ${formatPercent(prog.percent)} ${prog.message}`);
      },
    });

    if (data) {
      // Incremental update succeeded
      process.stdout.write("\n");
      const totalRequests = data.anchors.reduce((s, a) => s + a.totalRequests, 0);
      const totalTokens = data.anchors.reduce((s, a) => s + a.totalTokens, 0);
      const newBuckets = Math.max(0, Math.round((new Date(data.to).getTime() - new Date(existing.to).getTime()) / (data.bucketSeconds * 1000)));
      console.log(
        `${prefix} ✅ Incremental update done (+${newBuckets} new buckets): ${data.bucket} granularity, ${data.from.slice(0, 10)} → ${data.to.slice(0, 10)}, ` +
        `${(totalTokens / 1e9).toFixed(1)}B total tokens, ${totalRequests.toLocaleString()} total requests`
      );
      return;
    }
    // Incremental update not possible, fall through to full fetch
    process.stdout.write("\n");
    console.log(`${prefix} Incremental update not possible, falling back to full refetch...`);
  }

  // No existing cache or incremental failed: do full fetch
  const data = await fetchLiveTokenEconomics(range, undefined, {
    forceRefresh: true,
    preferJsonCache: false,
    onProgress: (prog) => {
      process.stdout.write(`\r${prefix} ${formatPercent(prog.percent)} ${prog.message}`);
    },
  });

  process.stdout.write("\n");
  const totalRequests = data.anchors.reduce((s, a) => s + a.totalRequests, 0);
  const totalTokens = data.anchors.reduce((s, a) => s + a.totalTokens, 0);
  console.log(
    `${prefix} ✅ Full fetch done: ${data.bucket} granularity, ${data.from.slice(0, 10)} → ${data.to.slice(0, 10)}, ` +
    `${(totalTokens / 1e9).toFixed(1)}B total tokens, ${totalRequests.toLocaleString()} total requests`
  );
}

async function main() {
  const ranges = LIVE_RANGE_OPTIONS.map(r => r.key);
  console.log(`[precompute-live] Starting pre-aggregation for ${ranges.length} ranges: ${ranges.join(", ")}`);
  console.log(`[precompute-live] Cache directory: .cache/token-economics/live/`);
  console.log(`[precompute-live] Mode: incremental (only fetches new data since last cache, with ${12} bucket overlap for late data)`);
  console.log();

  // Force fetch fresh data from DB for precompute, ignore existing JSON cache

  // Run sequentially for clearer progress output
  const results: Array<{ status: "fulfilled" | "rejected"; reason?: unknown; range: string }> = [];
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    try {
      await precomputeRange(range, i, ranges.length);
      results.push({ status: "fulfilled", range });
    } catch (err) {
      results.push({ status: "rejected", reason: err, range });
      console.error(`[precompute-live] [${i + 1}/${ranges.length}] ${range} ❌ Failed: ${err instanceof Error ? err.message : err}`);
    }
    console.log();
  }

  const failed = results.filter(r => r.status === "rejected");
  const succeeded = results.filter(r => r.status === "fulfilled");

  console.log(`[precompute-live] ${"─".repeat(60)}`);
  if (succeeded.length > 0) {
    console.log(`[precompute-live] ✅ ${succeeded.length}/${ranges.length} ranges cached successfully:`);
    for (const r of succeeded) {
      console.log(`  - ${r.range}.json`);
    }
  }
  if (failed.length > 0) {
    console.error(`[precompute-live] ❌ ${failed.length}/${ranges.length} ranges failed:`);
    failed.forEach((f) => {
      console.error(`  - ${f.range}: ${f.reason instanceof Error ? f.reason.message : f.reason}`);
    });
    await closeDbPool();
    process.exit(1);
  }

  console.log(`[precompute-live] 🎉 All ranges pre-aggregated successfully!`);
  await closeDbPool();
}

main().catch(async (err) => {
  console.error("[precompute-live] Fatal error:", err);
  await closeDbPool();
  process.exit(1);
});
