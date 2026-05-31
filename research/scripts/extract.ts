// Extraction pass: for each answered record, extract the claimed identity via deepseek.
// Writes extractions.jsonl, resumable. Re-runnable without re-querying answer models.
//
// Like study:run, this self-heals: it loops up to --max-rounds, each round re-trying
// only the keys still missing or carrying a parseError, and COMPACTS the file at every
// round boundary so a key that parse-errored then succeeded keeps a single clean row
// (the stale error row is physically dropped, not left behind). A key whose every
// attempt parse-errors keeps its latest salvage row so no data is lost.
//
// GATE: refuses to run unless records.jsonl is COMPLETE (every model×lang×repeat has a
// successful record). Override with --force.
//
// Usage:
//   pnpm study:extract [--config config/study.yaml] [--run <stamp|latest>]
//                      [--re-extract] [--force] [--max-rounds <n>]

import { enumerateTasks } from "../lib/ask";
import { parseArgs } from "../lib/args";
import { makeClient } from "../lib/client";
import { loadConfig } from "../lib/config";
import { extract } from "../lib/extract";
import { runBatched } from "../lib/limiter";
import {
  appendJsonl,
  checkCompleteness,
  compactExtractions,
  completedExtractionKeys,
  dedupeByKey,
  loadJsonl,
  resolveRun,
} from "../lib/store";
import type { ExtractionResult, RawRecord, StudyConfig } from "../lib/types";

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

  const langName = new Map(cfg.languages.map((l) => [l.code, l.name]));
  // Global concurrency for extraction = batchSize × modelConcurrency (bounded, batched).
  const concurrency = Math.max(1, cfg.api.batchSize * cfg.api.modelConcurrency);
  const maxRounds = args.num("max-rounds", 5);
  const reExtract = args.has("re-extract");

  console.log("─".repeat(72));
  console.log(`[extract] extractor=${cfg.extractor.model}`);
  console.log(`[extract] answered=${records.length}  concurrency=${concurrency}  maxRounds=${maxRounds}${reExtract ? "  (re-extract: all)" : ""}`);
  console.log("─".repeat(72));

  const client = makeClient(cfg);

  // Compact once up front: collapse the append-only log so each key keeps one row
  // (a clean retry supersedes its earlier parseError row), cleaning pre-existing
  // stale rows even on a resume that has nothing left to do.
  {
    const c = compactExtractions(paths.extractions);
    if (c.removed > 0) console.log(`[extract] compacted extractions: kept ${c.kept} key(s), removed ${c.removed} stale row(s).`);
  }

  // Round loop: each round re-extracts only keys still missing or carrying a
  // parseError, until everything parses cleanly or we run out of rounds. Mirrors
  // study:run's self-healing behavior.
  for (let round = 1; round <= maxRounds; round++) {
    // `--re-extract` only forces a full redo on the FIRST round; later rounds always
    // target just the not-yet-clean keys (avoid re-doing already-clean extractions).
    const done = reExtract && round === 1
      ? new Set<string>()
      : completedExtractionKeys(loadJsonl<ExtractionResult>(paths.extractions));
    const todo = records.filter((r) => !done.has(r.key));

    if (todo.length === 0) {
      console.log(`[extract] round ${round}: all ${records.length} answers extracted — nothing to do.`);
      break;
    }

    console.log(`[extract] ═══ round ${round}/${maxRounds}: ${done.size}/${records.length} clean, ${todo.length} to (re)extract ═══`);
    const { parseErrors } = await runExtractRound(client, cfg, paths.runId, paths.extractions, todo, langName, concurrency);

    // Compact at the round boundary (no writes in flight): a key that parse-errored
    // this round but parsed cleanly on retry collapses to its single clean row.
    const c = compactExtractions(paths.extractions);
    if (c.removed > 0) console.log(`[extract] round ${round}: compacted — removed ${c.removed} stale row(s).`);

    if (parseErrors === 0) {
      console.log(`[extract] ✔ round ${round}: all extractions parsed cleanly.`);
      break;
    }
    if (round === maxRounds) {
      console.log(`[extract] ⚠ reached max-rounds=${maxRounds} with ${parseErrors} parseError(s) remaining (kept as salvage).`);
    }
  }

  const finalExt = dedupeByKey(loadJsonl<ExtractionResult>(paths.extractions));
  const clean = [...finalExt.values()].filter((e) => !e.parseError).length;
  const stuck = [...finalExt.values()].filter((e) => e.parseError).length;
  console.log("─".repeat(72));
  console.log(`[extract] FINAL: ${clean}/${records.length} clean, ${stuck} parseError (salvaged) → ${paths.extractions}`);
  if (clean < records.length) {
    console.log(`[extract] some answers still lack a clean extraction. Re-run: pnpm study:extract --run ${paths.stamp}`);
  }
}

/** Run one extraction round over `todo`, appending each result; returns parseError count. */
async function runExtractRound(
  client: ReturnType<typeof makeClient>,
  cfg: StudyConfig,
  runId: string,
  extractionsFile: string,
  todo: RawRecord[],
  langName: Map<string, string>,
  concurrency: number,
): Promise<{ completed: number; parseErrors: number }> {
  let completed = 0;
  let parseErrors = 0;
  const startedAt = Date.now();
  const since = () => `${((Date.now() - startedAt) / 1000).toFixed(0)}s`;

  await runBatched(todo, concurrency, async (record) => {
    const result = await extract(client, cfg, runId, record, langName.get(record.langCode) ?? record.langCode);
    appendJsonl(extractionsFile, result);
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

  return { completed, parseErrors };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
