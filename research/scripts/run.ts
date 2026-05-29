// Ask pass — concurrency model:
//   • All models run in parallel, capped at api.modelConcurrency workers.
//   • Within a model, languages run SEQUENTIALLY (lang 1 fully, then lang 2, ...).
//   • Within a language, the `repeats` requests run in BATCHES of api.batchSize.
// Appends to records.jsonl, fully resumable. After the main pass, automatically
// retries any missing/errored keys for up to --max-rounds rounds until complete.
//
// Run directory: results/<study.id>/<stamp>/
//   • No --run  → a fresh timestamped run.
//   • --run <stamp> → resume that run, filling only what's missing.
//   • --run latest  → resume the most recent run for this study.
//
// Usage:
//   pnpm study:run [--config config/study.yaml] [--run <stamp|latest>]
//                  [--model-concurrency <n>] [--batch-size <n>] [--max-rounds <n>]

import { ask, enumerateTasks, tasksForModelLang } from "../lib/ask";
import { parseArgs } from "../lib/args";
import { makeClient } from "../lib/client";
import { loadConfig } from "../lib/config";
import { makeLimiter, runBatched } from "../lib/limiter";
import {
  appendJsonl,
  checkCompleteness,
  completedAnswerKeys,
  latestStamp,
  loadJsonl,
  newStamp,
  runPaths,
} from "../lib/store";
import type { RawRecord, StudyConfig } from "../lib/types";

async function main() {
  const args = parseArgs();
  const cfg = loadConfig(args.get("config"));
  if (args.has("model-concurrency")) cfg.api.modelConcurrency = args.num("model-concurrency", cfg.api.modelConcurrency);
  if (args.has("batch-size")) cfg.api.batchSize = args.num("batch-size", cfg.api.batchSize);
  const maxRounds = args.num("max-rounds", 5);

  // Resolve run directory.
  const runArg = args.get("run");
  let stamp: string;
  if (!runArg) {
    stamp = newStamp(new Date());
  } else if (runArg === "latest") {
    const latest = latestStamp(cfg.study.id);
    if (!latest) {
      console.error(`[run] no existing run for study "${cfg.study.id}" to resume.`);
      process.exit(1);
    }
    stamp = latest;
  } else {
    stamp = runArg;
  }
  const paths = runPaths(cfg.study.id, stamp);

  const allTasks = enumerateTasks(cfg);
  const expectedKeys = allTasks.map((t) => t.key);

  console.log("─".repeat(72));
  console.log(`[run] run=${paths.runId}  dir=${paths.dir}`);
  console.log(`[run] models=${cfg.models.length}  languages=${cfg.languages.length}  repeats=${cfg.repeats}  → total=${allTasks.length}`);
  console.log(`[run] modelConcurrency=${cfg.api.modelConcurrency}  batchSize=${cfg.api.batchSize}  maxRetries=${cfg.api.maxRetries}  maxRounds=${maxRounds}`);
  console.log("─".repeat(72));

  const client = makeClient(cfg);

  // Round loop: each round attempts only keys that are still missing or errored,
  // until the run is complete or we run out of rounds.
  for (let round = 1; round <= maxRounds; round++) {
    const existing = loadJsonl<RawRecord>(paths.records);
    const done = completedAnswerKeys(existing); // only successful keys count as done
    const todoCount = allTasks.length - done.size;

    if (todoCount === 0) {
      console.log(`[run] round ${round}: all ${allTasks.length} keys complete — nothing to do.`);
      break;
    }

    console.log(`[run] ═══ round ${round}/${maxRounds}: ${done.size}/${allTasks.length} done, ${todoCount} to (re)try ═══`);
    await runRound(client, cfg, paths.runId, paths.records, done);

    // Re-check after the round.
    const after = checkCompleteness(expectedKeys, loadJsonl<RawRecord>(paths.records));
    console.log(`[run] round ${round} result: ok=${after.ok}/${after.expected}  missing=${after.missing.length}  errored=${after.errored.length}`);
    if (after.complete) {
      console.log(`[run] ✔ run complete after round ${round}.`);
      break;
    }
    if (round === maxRounds) {
      console.log(`[run] ⚠ reached max-rounds=${maxRounds} with ${after.missing.length + after.errored.length} key(s) still incomplete.`);
    }
  }

  const final = checkCompleteness(expectedKeys, loadJsonl<RawRecord>(paths.records));
  console.log("─".repeat(72));
  console.log(`[run] FINAL: ok=${final.ok}/${final.expected}  missing=${final.missing.length}  errored=${final.errored.length}`);
  console.log(`[run] records → ${paths.records}`);
  if (!final.complete) {
    console.log(`[run] incomplete. Resume with: pnpm study:run --run ${stamp}`);
    const sample = [...final.missing, ...final.errored].slice(0, 8);
    console.log(`[run] still-incomplete sample: ${sample.join(", ")}${final.missing.length + final.errored.length > 8 ? " …" : ""}`);
    // Non-zero exit so a chained `study:test` halts before extract/aggregate.
    process.exit(3);
  }
  console.log(`[run] ✔ complete. Next: pnpm study:extract --run ${stamp}  (or --run latest)`);
}

/** Run one round: every model in parallel, languages sequential, repeats batched. */
async function runRound(
  client: ReturnType<typeof makeClient>,
  cfg: StudyConfig,
  runId: string,
  recordsFile: string,
  done: Set<string>,
) {
  const modelLimit = makeLimiter(cfg.api.modelConcurrency);
  let completed = 0;
  let ok = 0;
  let errored = 0;
  const startedAt = Date.now();
  const since = () => `${((Date.now() - startedAt) / 1000).toFixed(0)}s`;

  const modelJobs = cfg.models.map((model) =>
    modelLimit(async () => {
      const label = model.label ?? model.id;
      const pending = cfg.languages
        .map((lang) => ({ lang, tasks: tasksForModelLang(cfg, model, lang).filter((t) => !done.has(t.key)) }))
        .filter((x) => x.tasks.length > 0);
      if (pending.length === 0) return;

      console.log(`[run] ▶ ${label}`);
      for (const { lang, tasks } of pending) {
        console.log(`[run]   · ${label} / ${lang.name}: ${tasks.length} request(s), batches of ${cfg.api.batchSize}`);
        await runBatched(tasks, cfg.api.batchSize, async (task) => {
          const record = await ask(client, cfg, runId, task);
          appendJsonl(recordsFile, record);
          completed++;
          if (record.error) {
            errored++;
            console.log(`[run]   ✗ [${completed} ${since()}] ${task.key} — ${record.error}`);
          } else {
            ok++;
            console.log(`[run]   ✓ [${completed} ${since()}] ${task.key} — ${record.response.length} chars`);
          }
        });
      }
      console.log(`[run] ◀ ${label}`);
    }),
  );

  await Promise.allSettled(modelJobs);
  console.log(`[run] round wrote ${completed} (ok=${ok}, errored=${errored}) in ${since()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
