import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "../lib/args";
import { latestStamp, loadJsonl, runPaths } from "../lib/store";
import { bootstrapPersonalityStudyId, loadPersonalityRunConfig } from "./config";
import { loadOejtsInstrument } from "./instrument";
import { aggregateModel } from "./score";
import type { PersonalityAggregate, PersonalityRecord } from "./types";

function validRecord(record: PersonalityRecord): boolean {
  return !record.error && !record.parseError && record.answers?.length === 32;
}

function finalValidRecords(records: PersonalityRecord[]): Map<string, PersonalityRecord> {
  const valid = new Map<string, PersonalityRecord>();
  for (const record of records) {
    if (validRecord(record)) valid.set(record.key, record);
  }
  return valid;
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function reportMarkdown(aggregate: PersonalityAggregate): string {
  const lines = [
    `# ${aggregate.study.title}`,
    "",
    `- Run: \`${aggregate.runId}\``,
    `- Generated: ${aggregate.generatedAt}`,
    `- Instrument: OEJTS 1.2, original five-point scale`,
    `- Administrations per model: ${aggregate.repeats}`,
    `- Stable rule: unique modal type ≥ ${aggregate.classification.minModalCount}/${aggregate.repeats}, and each modal letter ≥ ${aggregate.classification.minLetterCount}/${aggregate.repeats}`,
    "",
    "A type is a response profile under this frozen test condition, not an intrinsic human personality.",
    "",
    "| Manufacturer | Model | Stable result | Modal type | Frequency | IE mean | SN mean | FT mean | JP mean |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const model of aggregate.models) {
    lines.push(
      `| ${model.manufacturer} | ${model.label} | ${model.stableType ?? "No stable type"} | ${model.modalType ?? "—"} | ${model.modalCount}/${model.n} | ${fmt(model.dimensions.IE.mean)} | ${fmt(model.dimensions.SN.mean)} | ${fmt(model.dimensions.FT.mean)} | ${fmt(model.dimensions.JP.mean)} |`,
    );
  }

  lines.push("", "## Model details", "");
  for (const model of aggregate.models) {
    const counts = Object.entries(model.typeCounts)
      .sort(([typeA, countA], [typeB, countB]) => countB - countA || typeA.localeCompare(typeB))
      .map(([type, count]) => `${type} ${count}`)
      .join(", ");
    lines.push(
      `### ${model.label}`,
      "",
      `- Pinned route: \`${model.modelId}\``,
      `- Result: **${model.stableType ?? "No stable type"}**`,
      `- Type distribution: ${counts}`,
      `- Letter counts: ${Object.entries(model.letterCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([letter, count]) => `${letter} ${count}/${model.n}`)
        .join(", ")}`,
      ...(model.reasons.length ? model.reasons.map((reason) => `- Instability reason: ${reason}`) : []),
      "",
    );
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs();
  const sourceConfig = args.get("config") ?? "config/personality-oejts.yaml";
  const studyId = bootstrapPersonalityStudyId(sourceConfig);
  const runArg = args.get("run");
  const stamp = !runArg || runArg === "latest" ? latestStamp(studyId) : runArg;
  if (!stamp) throw new Error(`no existing run for study ${studyId}`);

  const paths = runPaths(studyId, stamp);
  if (!fs.existsSync(paths.config)) throw new Error(`missing pinned config: ${paths.config}`);
  const { config } = loadPersonalityRunConfig(paths.config, sourceConfig, false);
  const instrumentPath = path.join(paths.dir, "instrument.json");
  if (!fs.existsSync(instrumentPath)) throw new Error(`missing pinned instrument: ${instrumentPath}`);
  const { instrument } = loadOejtsInstrument(instrumentPath);

  const records = loadJsonl<PersonalityRecord>(paths.records);
  const valid = finalValidRecords(records);
  const expectedKeys = config.models.flatMap((model) =>
    Array.from({ length: config.repeats }, (_, repeat) => `${model.id}::${repeat}`),
  );
  const missing = expectedKeys.filter((key) => !valid.has(key));
  if (missing.length > 0) {
    throw new Error(
      `incomplete run: ${missing.length}/${expectedKeys.length} administrations missing or invalid; resume personality:run first`,
    );
  }

  const models = config.models.map((model) => {
    const modelRecords = Array.from(valid.values()).filter((record) => record.modelId === model.id);
    return aggregateModel(model, modelRecords, instrument, config.classification);
  });
  const aggregate: PersonalityAggregate = {
    runId: paths.runId,
    generatedAt: new Date().toISOString(),
    study: config.study,
    instrument: config.instrument,
    repeats: config.repeats,
    classification: config.classification,
    models,
  };

  fs.writeFileSync(paths.aggregate, `${JSON.stringify(aggregate, null, 2)}\n`);
  fs.writeFileSync(paths.report, reportMarkdown(aggregate));
  console.log(`[personality:aggregate] aggregate=${paths.aggregate}`);
  console.log(`[personality:aggregate] report=${paths.report}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
