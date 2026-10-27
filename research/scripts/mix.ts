// Mix pass — pool several runs of the SAME study into one merged ("mix") run, so a
// study gathered in stages (a big run + a follow-up that adds a model + a top-up that
// adds repeats) can be read as one final result.
//
// The merge unit is the physical API call (generationId), NOT the resume key — see
// research/lib/mix.ts for the full rationale. The merged dir is written to look like a
// native run (records.jsonl + extractions.jsonl + study.yaml), plus a mix.json manifest
// that marks it as a mix and records the audit trail / methodology warnings.
//
// This step makes NO API calls and does NOT aggregate. After mixing, inspect the
// manifest, then aggregate manually:
//     pnpm study:aggregate --run mix-<stamp>
//
// Usage:
//   pnpm study:mix --runs <stampA,stampB,...>   [--config config/study.yaml]
//   pnpm study:mix --all                         (pool every native run; skips prior mixes)

import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { parseArgs } from "../lib/args";
import { bootstrapStudyId, loadRunConfig } from "../lib/config";
import { mixRuns, type MixInput } from "../lib/mix";
import {
  dedupeByKey,
  listStamps,
  loadJsonl,
  newStamp,
  runPaths,
} from "../lib/store";
import type { ExtractionResult, RawRecord } from "../lib/types";

async function main() {
  const args = parseArgs();
  const studyId = bootstrapStudyId(args.get("config"));

  // ── Resolve which source stamps to pool. ───────────────────────────────────
  const allStamps = listStamps(studyId);
  const nativeStamps = allStamps.filter((s) => !s.startsWith("mix-")); // never re-pool a mix in --all

  let stamps: string[];
  if (args.has("all")) {
    stamps = nativeStamps;
  } else {
    const raw = args.get("runs");
    if (!raw) {
      console.error(
        "[mix] specify which runs to pool: --runs <stampA,stampB,...>  (or --all to pool every native run).",
      );
      console.error(`[mix] available runs for "${studyId}": ${allStamps.join(", ") || "(none)"}`);
      process.exit(1);
    }
    stamps = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const unknown = stamps.filter((s) => !allStamps.includes(s));
    if (unknown.length) {
      console.error(`[mix] unknown run(s): ${unknown.join(", ")}`);
      console.error(`[mix] available: ${allStamps.join(", ")}`);
      process.exit(1);
    }
  }

  if (stamps.length < 1) {
    console.error("[mix] nothing to pool.");
    process.exit(1);
  }
  if (stamps.length === 1) {
    console.warn(`[mix] ⚠ only one source run (${stamps[0]}) — the mix will just be a copy of it.`);
  }

  // ── Load each source run (dedupe within each run by resume key, mirroring loaders). ─
  const inputs: MixInput[] = [];
  for (const stamp of stamps) {
    const p = runPaths(studyId, stamp);
    const records = [...dedupeByKey(loadJsonl<RawRecord>(p.records)).values()];
    const extractions = [...dedupeByKey(loadJsonl<ExtractionResult>(p.extractions)).values()];
    if (records.length === 0) {
      console.error(`[mix] source run ${stamp} has no records — aborting.`);
      process.exit(1);
    }
    inputs.push({ run: p.runId, records, extractions });
  }

  // ── Base metadata (study/api/extractor) from the NEWEST source run's pinned config.
  //    Its models/languages/repeats are replaced by the computed union in mixRuns. ───
  const newestSource = [...stamps].sort().pop()!;
  const basePaths = runPaths(studyId, newestSource);
  const { config: baseConfig } = loadRunConfig(basePaths.config, args.get("config"));

  // ── Merge. ──────────────────────────────────────────────────────────────────────
  const stamp = newStamp(new Date());
  const mixStamp = `mix-${stamp}`;
  const out = runPaths(studyId, mixStamp); // creates results/<study>/mix-<stamp>/
  const generatedAt = new Date().toISOString();

  console.log("─".repeat(72));
  console.log(`[mix] study=${studyId}  pooling ${stamps.length} run(s): ${stamps.join(", ")}`);
  console.log(`[mix] → ${out.dir}`);
  console.log("─".repeat(72));

  const { records, extractions, config, manifest } = mixRuns(inputs, baseConfig, out.runId, generatedAt);

  // ── Write the merged run, atomically per file (write temp → rename). ──────────────
  writeJsonl(out.records, records);
  writeJsonl(out.extractions, extractions);
  fs.writeFileSync(out.config, YAML.stringify(config));
  fs.writeFileSync(path.join(out.dir, "mix.json"), JSON.stringify(manifest, null, 2));

  // ── Report what happened. ─────────────────────────────────────────────────────────
  for (const s of manifest.sources) {
    console.log(`[mix]   ${s.run}: answered=${s.answered}  models=${s.models}  langs=${s.languages}`);
  }
  console.log(
    `[mix] merged: answered=${manifest.totalAnswered}  extractions=${extractions.length}  ` +
      `models=${config.models.length}  languages=${config.languages.length}  cells=${manifest.cells}  repeats(max)=${config.repeats}`,
  );

  if (manifest.warnings.length) {
    console.warn("[mix] ── methodology warnings ──");
    for (const w of manifest.warnings) console.warn(`[mix]   ⚠ ${w}`);
    console.warn(`[mix]   (proceeding anyway; the full prompt breakdown is in mix.json)`);
  }

  // Sanity: every kept extraction must point at a kept record (lockstep re-key invariant).
  const recKeys = new Set(records.map((r) => r.key));
  const orphan = extractions.filter((e) => !recKeys.has(e.key)).length;
  if (orphan > 0) console.warn(`[mix] ⚠ ${orphan} extraction(s) have no matching record — unexpected; investigate.`);

  console.log("─".repeat(72));
  console.log(`[mix] ✔ wrote ${path.relative(process.cwd(), out.dir)}/{records.jsonl, extractions.jsonl, study.yaml, mix.json}`);
  console.log(`[mix] next:  pnpm study:aggregate --run ${mixStamp}    (then study:report --run ${mixStamp})`);
}

/** Write objects as JSONL via a temp file + atomic rename (no torn file on crash). */
function writeJsonl(file: string, items: unknown[]): void {
  const body = items.map((o) => JSON.stringify(o)).join("\n") + (items.length ? "\n" : "");
  const tmp = `${file}.mix.${process.pid}.tmp`;
  fs.writeFileSync(tmp, body);
  fs.renameSync(tmp, file);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
