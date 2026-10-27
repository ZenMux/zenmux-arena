// Explicit one-time research export. Never imported by the application.
import { writeFile } from "node:fs/promises";
import { config } from "dotenv";
import { serviceSupabase } from "@research/cache/supabase";
import { payloadHash, snapshotId, snapshotKey, validEconomics } from "@research/cache/payload";
import { HISTORY_END_DATE, HISTORY_FROM, HISTORY_TO, selectHistoricalWindow } from "./window";
import type { HistoricalEconomicsData } from "./types";

async function main() {
  config({ path: ".env.local", quiet: true });
  const key = snapshotKey(snapshotId("token-economics", "all"));
  // SELECT only. Do not call getLiveTokenEconomics/read-through/API routes:
  // those may trigger refresh, lease acquisition and persistence writes.
  const { data: row, error } = await serviceSupabase().from("arena_snapshot_cache")
    .select("payload,data_from,data_through,refreshed_at")
    .eq("cache_key", key).abortSignal(AbortSignal.timeout(15000)).maybeSingle();
  if (error) throw new Error(`Snapshot SELECT failed (${error.code}); no artifact written.`);
  if (!row || !validEconomics(row.payload, "all")) throw new Error("Missing or invalid ALL snapshot; no artifact written.");
  const source = row.payload;
  if (Date.parse(row.data_from) !== Date.parse(source.from) || Date.parse(row.data_through) !== Date.parse(source.to)
    || Date.parse(row.refreshed_at) !== Date.parse(source.generatedAt)) throw new Error("Snapshot metadata/payload mismatch.");
  const selected = selectHistoricalWindow(source);
  const artifact: HistoricalEconomicsData = {
    kind: "deepseek-challenge-history", version: 1,
    window: { from: HISTORY_FROM, to: HISTORY_TO, endDateInclusive: HISTORY_END_DATE, timezone: "UTC", days: selected.days },
    provenance: {
      source: "Supabase arena_snapshot_cache", snapshotKey: key,
      sourceFrom: source.from, sourceTo: source.to, sourceGeneratedAt: source.generatedAt,
      sourceWasStale: source.stale === true, extractedAt: new Date().toISOString(),
      sourcePayloadSha256: payloadHash(source), selectedPayloadSha256: payloadHash(selected.payload),
      coverage: selected.coverage,
      notes: [
        "Research artifact frozen from one read-only ALL snapshot; no billing query or refresh was run.",
        "Every model has every one of the 62 UTC daily buckets. Missing or duplicate days abort export; existing source zeros are retained without filling.",
        "Model and anchor totals, peaks, latest-day values and ranking are recomputed only from [2026-06-23, 2026-08-24). Chart cumulative values start from this window's first bucket.",
        "Daily points are persisted billing aggregates, not an independent audit of underlying billing rows. Pricing/campaign metadata is retained as recorded in the source snapshot, not reconstructed day by day.",
        "Campaign end dates may precede the observation-window end. Existing chart semantics retain post-campaign usage as muted tails.",
      ],
    },
    payload: selected.payload,
  };
  const output = new URL("./deepseek-challenge-2026-06-23--2026-08-23.json", import.meta.url);
  // Never overwrite a published research snapshot on a later execution.
  await writeFile(output, JSON.stringify(artifact) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ file: output.pathname, days: selected.days, models: selected.coverage.length,
    points: selected.coverage.reduce((sum, model) => sum + model.days, 0), sourceTo: source.to,
    sourceGeneratedAt: source.generatedAt, sha256: artifact.provenance.selectedPayloadSha256 }));
}

main().catch((error: unknown) => {
  // Do not dump response bodies, environment, credentials or SDK request state.
  console.error(error instanceof Error && "code" in error && error.code === "EEXIST"
    ? "Historical artifact already exists; immutable export refused overwrite."
    : error instanceof Error ? error.message : "Historical export failed.");
  process.exitCode = 1;
});
