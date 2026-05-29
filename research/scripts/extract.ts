// Extraction pass: for each answered record, extract the claimed identity via deepseek.
// Appends to extractions.jsonl, resumable. Re-runnable without re-querying answer models.
//
// GATE: refuses to run unless records.jsonl is COMPLETE (every model×lang×repeat has a
// successful record). Override with --force.
//
// Usage:
//   pnpm study:extract [--config config/study.yaml] [--run <stamp|latest>]
//                      [--re-extract] [--force]

import { enumerateTasks } from "../lib/ask";
import { parseArgs } from "../lib/args";
import { makeClient } from "../lib/client";
import { loadConfig } from "../lib/config";
import { extract } from "../lib/extract";
import { runBatched } from "../lib/limiter";
import {
  appendJsonl,
  checkCompleteness,
  completedExtractionKeys,
  dedupeByKey,
  loadJsonl,
  resolveRun,
} from "../lib/store";
import type { ExtractionResult, RawRecord } from "../lib/types";

async function main() {
  const args = parseArgs();
  const cfg = loadConfig(args.get("config"));
  const paths = resolveRun(cfg.study.id, args.get("run"));
  if (!paths) {
    console.error(`[extract] no run found for study "${cfg.study.id}". Run study:run first.`);
    process.exit(1);
  }

  const allRecords = [...dedupeByKey(loadJsonl<RawRecord>(paths.records)).values()];

  // ── Completeness gate ──────────────────────────────────────────────────────
  const expectedKeys = enumerateTasks(cfg).map((t) => t.key);
  const comp = checkCompleteness(expectedKeys, allRecords);
  console.log(`[extract] run=${paths.runId}  records ok=${comp.ok}/${comp.expected}  missing=${comp.missing.length}  errored=${comp.errored.length}`);
  if (!comp.complete && !args.has("force")) {
    console.error("─".repeat(72));
    console.error(`[extract] ✗ ABORT: records.jsonl is incomplete; refusing to extract on partial data.`);
    const sample = [...comp.missing, ...comp.errored].slice(0, 10);
    console.error(`[extract]   incomplete sample: ${sample.join(", ")}${comp.missing.length + comp.errored.length > 10 ? " …" : ""}`);
    console.error(`[extract]   finish the run first:  pnpm study:run --run ${paths.stamp}`);
    console.error(`[extract]   (or force anyway with --force)`);
    console.error("─".repeat(72));
    process.exit(2);
  }
  if (!comp.complete) console.log(`[extract] ⚠ --force: proceeding on incomplete records.`);

  const records = allRecords.filter((r) => r.response && !r.error);
  if (records.length === 0) {
    console.error(`[extract] no answered records in ${paths.records}.`);
    process.exit(1);
  }

  const done = args.has("re-extract")
    ? new Set<string>()
    : completedExtractionKeys(loadJsonl<ExtractionResult>(paths.extractions));
  const todo = records.filter((r) => !done.has(r.key));

  const langName = new Map(cfg.languages.map((l) => [l.code, l.name]));

  // Global concurrency for extraction = batchSize × modelConcurrency (bounded, batched).
  const concurrency = Math.max(1, cfg.api.batchSize * cfg.api.modelConcurrency);

  console.log("─".repeat(72));
  console.log(`[extract] extractor=${cfg.extractor.model}`);
  console.log(`[extract] answered=${records.length}  done=${done.size}  todo=${todo.length}  concurrency=${concurrency}`);
  console.log("─".repeat(72));
  if (todo.length === 0) {
    console.log("[extract] nothing to do — all answers extracted.");
    return;
  }

  const client = makeClient(cfg);
  let completed = 0;
  let parseErrors = 0;
  const startedAt = Date.now();
  const since = () => `${((Date.now() - startedAt) / 1000).toFixed(0)}s`;

  await runBatched(todo, concurrency, async (record) => {
    const result = await extract(client, cfg, paths.runId, record, langName.get(record.langCode) ?? record.langCode);
    appendJsonl(paths.extractions, result);
    completed++;
    if (result.parseError) parseErrors++;
    const claim =
      result.claimedVendor === "other" && result.claimedVendorOther
        ? `other:${result.claimedVendorOther}`
        : result.claimedVendor;
    const src = result.sourceGenerationId ?? "—";
    const ext = result.extractorGenerationId ?? "—";
    console.log(
      `[extract] [${completed}/${todo.length} ${since()}] ${record.key} → ${claim}  ` +
        `(source=${src} extractor=${ext})` +
        (result.parseError ? `  (parseError: ${result.parseError})` : ""),
    );
  });

  console.log("─".repeat(72));
  console.log(`[extract] finished in ${since()} — wrote ${completed} extractions (${parseErrors} parse issues) → ${paths.extractions}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
