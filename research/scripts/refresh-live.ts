#!/usr/bin/env tsx
import { config as loadDotenv } from "dotenv";
import path from "path";
import { closeDbPool, fetchLiveTokenEconomics, incrementallyUpdateCache, readSharedCache } from "@research/token-economics/live-query";
import { LIVE_RANGE_OPTIONS, type LiveRangeKey } from "@research/token-economics/live-config";

// Load .env.local for local runs (Morphe deployments inject env vars directly)
loadDotenv({ path: path.resolve(process.cwd(), ".env.local") });

function formatPercent(p?: number): string {
  if (p == null) return "    ";
  return `${p.toString().padStart(3)}%`;
}

async function refreshRange(range: LiveRangeKey, index: number, total: number): Promise<void> {
  const prefix = `[refresh-live] [${index + 1}/${total}] ${range.padEnd(4)}`;
  console.log(`${prefix} Starting...`);

  // Use the latest shared snapshot for incremental updates
  const existing = await readSharedCache(range);
  if (existing) {
    process.stdout.write(`\r${prefix} ${formatPercent(0)} Found shared snapshot (up to ${existing.to.slice(0, 16).replace("T", " ")}), attempting incremental update...`);
    const data = await incrementallyUpdateCache(range, existing, undefined, {
      persist: true,
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

  // No compatible shared snapshot: do full fetch
  const data = await fetchLiveTokenEconomics(range, undefined, {
    persist: true,
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
  console.log(`[refresh-live] Refreshing shared snapshots for ${ranges.length} ranges: ${ranges.join(", ")}`);
  console.log(`[refresh-live] Shared cache: Supabase arena_snapshot_cache (token-economics)`);
  console.log(`[refresh-live] Mode: incremental (only fetches new data since last cache, with ${12} bucket overlap for late data)`);
  console.log();

  // Run sequentially for clearer progress output
  const results: Array<{ status: "fulfilled" | "rejected"; reason?: unknown; range: string }> = [];
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    try {
      await refreshRange(range, i, ranges.length);
      results.push({ status: "fulfilled", range });
    } catch (err) {
      results.push({ status: "rejected", reason: err, range });
      console.error(`[refresh-live] [${i + 1}/${ranges.length}] ${range} ❌ Failed: ${err instanceof Error ? err.message : err}`);
    }
    console.log();
  }

  const failed = results.filter(r => r.status === "rejected");
  const succeeded = results.filter(r => r.status === "fulfilled");

  console.log(`[refresh-live] ${"─".repeat(60)}`);
  if (succeeded.length > 0) {
    console.log(`[refresh-live] ✅ ${succeeded.length}/${ranges.length} shared snapshots refreshed successfully:`);
    for (const r of succeeded) {
      console.log(`  - token-economics:${r.range}`);
    }
  }
  if (failed.length > 0) {
    console.error(`[refresh-live] ❌ ${failed.length}/${ranges.length} ranges failed:`);
    failed.forEach((f) => {
      console.error(`  - ${f.range}: ${f.reason instanceof Error ? f.reason.message : f.reason}`);
    });
    await closeDbPool();
    process.exit(1);
  }

  console.log(`[refresh-live] 🎉 All shared snapshots refreshed successfully!`);
  await closeDbPool();
}

main().catch(async (err) => {
  console.error("[refresh-live] Fatal error:", err);
  await closeDbPool();
  process.exit(1);
});
