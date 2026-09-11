import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "../lib/args";
import { describeError, makeLimiter, runBatched, withRetry } from "../lib/limiter";
import { appendJsonl, latestStamp, loadJsonl, newStamp, runPaths } from "../lib/store";
import {
  bootstrapPersonalityStudyId,
  loadPersonalityRunConfig,
} from "./config";
import { buildOejtsPrompt, loadOejtsInstrument, sha256 } from "./instrument";
import { parseOejtsResponse } from "./score";
import { makePersonalityClient, type PersonalityClient } from "./client";
import type { PersonalityConfig, PersonalityModelSpec, PersonalityRecord } from "./types";

interface PersonalityTask {
  model: PersonalityModelSpec;
  repeat: number;
  key: string;
}

function makeKey(modelId: string, repeat: number): string {
  return `${modelId}::${repeat}`;
}

function enumerateTasks(config: PersonalityConfig): PersonalityTask[] {
  return config.models.flatMap((model) =>
    Array.from({ length: config.repeats }, (_, repeat) => ({
      model,
      repeat,
      key: makeKey(model.id, repeat),
    })),
  );
}

function isSuccess(record: PersonalityRecord): boolean {
  return !record.error && !record.parseError && record.answers?.length === 32;
}

function completedKeys(records: PersonalityRecord[]): Set<string> {
  return new Set(records.filter(isSuccess).map((record) => record.key));
}

function missingKeys(tasks: PersonalityTask[], records: PersonalityRecord[]): string[] {
  const done = completedKeys(records);
  return tasks.filter((task) => !done.has(task.key)).map((task) => task.key);
}

function writeRunStatus(
  config: PersonalityConfig,
  runId: string,
  runDir: string,
  records: PersonalityRecord[],
): void {
  const done = completedKeys(records);
  const models = config.models.map((model) => {
    const valid = Array.from({ length: config.repeats }, (_, repeat) =>
      done.has(makeKey(model.id, repeat)),
    ).filter(Boolean).length;
    return {
      modelId: model.id,
      label: model.label,
      valid,
      expected: config.repeats,
      status: valid === config.repeats ? "complete" : "unscorable",
    };
  });
  fs.writeFileSync(
    path.join(runDir, "run-status.json"),
    `${JSON.stringify(
      {
        runId,
        updatedAt: new Date().toISOString(),
        complete: models.every((model) => model.status === "complete"),
        models,
      },
      null,
      2,
    )}\n`,
  );
}

function pinnedInstrumentPath(runDir: string): string {
  return path.join(runDir, "instrument.json");
}

function pinnedPromptPath(runDir: string): string {
  return path.join(runDir, "prompt.txt");
}

function loadOrPinInstrument(config: PersonalityConfig, runDir: string) {
  const snapshot = pinnedInstrumentPath(runDir);
  if (fs.existsSync(snapshot)) return loadOejtsInstrument(snapshot);
  const source = loadOejtsInstrument(config.instrument.path);
  fs.writeFileSync(snapshot, source.raw);
  return loadOejtsInstrument(snapshot);
}

function loadOrPinPrompt(config: PersonalityConfig, runDir: string, generated: string): string {
  const snapshot = pinnedPromptPath(runDir);
  if (fs.existsSync(snapshot)) return fs.readFileSync(snapshot, "utf8");
  fs.writeFileSync(snapshot, generated);
  return generated;
}

async function administer(
  client: PersonalityClient,
  config: PersonalityConfig,
  runId: string,
  task: PersonalityTask,
  prompt: string,
  instrumentSha256: string,
): Promise<PersonalityRecord> {
  const base: Omit<PersonalityRecord, "generationId" | "response"> = {
    key: task.key,
    runId,
    timestamp: new Date().toISOString(),
    modelId: task.model.id,
    baseModelId: task.model.baseModelId,
    manufacturer: task.model.manufacturer,
    providerSlug: task.model.providerSlug,
    repeat: task.repeat,
    instrumentId: config.instrument.id,
    instrumentSha256,
    promptVersion: config.instrument.promptVersion,
    promptSha256: sha256(prompt),
    apiProtocol: config.api.protocol,
  };

  try {
    const completion = await withRetry(
      () => client(task.model.id, prompt),
      {
        maxRetries: config.api.maxRetries,
        baseMs: config.api.retryBaseMs,
        capMs: config.api.retryCapMs,
        onRetry: ({ attempt, delayMs, error }) =>
          console.log(
            `[personality:run] retry ${task.key} ${attempt}/${config.api.maxRetries} in ${Math.round(delayMs)}ms — ${describeError(error)}`,
          ),
      },
    );

    const response = completion.response;
    const common = {
      ...base,
      ...completion,
      timestamp: new Date().toISOString(),
    };
    if (common.error) return common;
    if (!response) return { ...common, error: `empty response (${common.stopReason ?? "unknown"})` };

    try {
      return { ...common, answers: parseOejtsResponse(response) };
    } catch (error) {
      return { ...common, parseError: (error as Error).message };
    }
  } catch (error) {
    return {
      ...base,
      timestamp: new Date().toISOString(),
      generationId: null,
      response: "",
      error: describeError(error),
    };
  }
}

async function runRound(
  client: PersonalityClient,
  config: PersonalityConfig,
  runId: string,
  recordsFile: string,
  prompt: string,
  instrumentSha256: string,
  done: Set<string>,
) {
  const modelLimit = makeLimiter(config.api.modelConcurrency);
  const jobs = config.models.map((model) =>
    modelLimit(async () => {
      const tasks = Array.from({ length: config.repeats }, (_, repeat) => ({
        model,
        repeat,
        key: makeKey(model.id, repeat),
      })).filter((task) => !done.has(task.key));
      if (tasks.length === 0) return;

      console.log(`[personality:run] ▶ ${model.label}: ${tasks.length} administration(s)`);
      await runBatched(tasks, config.api.batchSize, async (task) => {
        const record = await administer(client, config, runId, task, prompt, instrumentSha256);
        appendJsonl(recordsFile, record);
        const state = isSuccess(record) ? "✓" : "✗";
        console.log(`[personality:run]   ${state} ${task.key}`);
      });
    }),
  );
  await Promise.allSettled(jobs);
}

async function main() {
  const args = parseArgs();
  const sourceConfig = args.get("config") ?? "config/personality-oejts.yaml";
  const studyId = bootstrapPersonalityStudyId(sourceConfig);
  const runArg = args.get("run");
  const stamp =
    !runArg ? newStamp(new Date()) : runArg === "latest" ? latestStamp(studyId) : runArg;
  if (!stamp) throw new Error(`no existing run for study ${studyId}`);

  const paths = runPaths(studyId, stamp);
  const dryRun = args.has("dry-run");
  const { config, pinned } = loadPersonalityRunConfig(paths.config, sourceConfig, !dryRun);
  if (args.has("model-concurrency")) {
    config.api.modelConcurrency = args.num("model-concurrency", config.api.modelConcurrency);
  }
  if (args.has("batch-size")) config.api.batchSize = args.num("batch-size", config.api.batchSize);

  const loadedInstrument = loadOrPinInstrument(config, paths.dir);
  const prompt = loadOrPinPrompt(
    config,
    paths.dir,
    buildOejtsPrompt(loadedInstrument.instrument),
  );
  const tasks = enumerateTasks(config);
  const maxRounds = args.num("max-rounds", 5);

  console.log("─".repeat(72));
  console.log(`[personality:run] run=${paths.runId}`);
  console.log(`[personality:run] config=${pinned ? "new pinned snapshot" : "existing pinned snapshot"}`);
  console.log(
    `[personality:run] models=${config.models.length} repeats=${config.repeats} total=${tasks.length}`,
  );
  console.log(`[personality:run] catalogue as of ${config.catalog.asOf}; provider routes are pinned`);
  console.log(`[personality:run] protocol=${config.api.protocol} baseURL=${config.api.baseURL}`);
  console.log("─".repeat(72));

  if (dryRun) {
    console.log(`[personality:run] dry run complete; no model requests were made.`);
    return;
  }

  const client = makePersonalityClient(config);
  for (let round = 1; round <= maxRounds; round++) {
    const records = loadJsonl<PersonalityRecord>(paths.records);
    const done = completedKeys(records);
    const missing = missingKeys(tasks, records);
    if (missing.length === 0) break;
    console.log(`[personality:run] round ${round}/${maxRounds}: ${missing.length} remaining`);
    await runRound(
      client,
      config,
      paths.runId,
      paths.records,
      prompt,
      loadedInstrument.sha256,
      done,
    );
  }

  const finalRecords = loadJsonl<PersonalityRecord>(paths.records);
  const missing = missingKeys(tasks, finalRecords);
  writeRunStatus(config, paths.runId, paths.dir, finalRecords);
  console.log(`[personality:run] complete=${tasks.length - missing.length}/${tasks.length}`);
  console.log(`[personality:run] records=${paths.records}`);
  if (missing.length > 0) {
    console.error(`[personality:run] incomplete; resume with --run ${stamp}`);
    process.exit(3);
  }
  console.log(`[personality:run] next: pnpm personality:aggregate --run ${stamp}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
