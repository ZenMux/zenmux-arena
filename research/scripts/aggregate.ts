// Aggregate pass: join records + extractions into aggregate.json, and publish a copy
// to public/research/ for the Next.js page.
//
// GATE: refuses to run unless records.jsonl is COMPLETE (every model×lang×repeat has a
// successful record). Override with --force.
//
// Usage: pnpm study:aggregate [--config config/study.yaml] [--run <stamp|latest>] [--force]

import fs from "node:fs";
import path from "node:path";
import { aggregate } from "../lib/aggregate";
import { enumerateTasks } from "../lib/ask";
import { parseArgs } from "../lib/args";
import { loadConfig } from "../lib/config";
import { checkCompleteness, dedupeByKey, loadJsonl, resolveRun } from "../lib/store";
import type { ExtractionResult, RawRecord } from "../lib/types";

async function main() {
  const args = parseArgs();
  const cfg = loadConfig(args.get("config"));
  const paths = resolveRun(cfg.study.id, args.get("run"));
  if (!paths) {
    console.error(`[aggregate] no run found for study "${cfg.study.id}". Run study:run first.`);
    process.exit(1);
  }

  const records = [...dedupeByKey(loadJsonl<RawRecord>(paths.records)).values()];
  const extractions = [...dedupeByKey(loadJsonl<ExtractionResult>(paths.extractions)).values()];
  if (records.length === 0) {
    console.error(`[aggregate] no records in ${paths.records}.`);
    process.exit(1);
  }

  // ── Completeness gate ──────────────────────────────────────────────────────
  const expectedKeys = enumerateTasks(cfg).map((t) => t.key);
  const comp = checkCompleteness(expectedKeys, records);
  console.log(`[aggregate] run=${paths.runId}  records ok=${comp.ok}/${comp.expected}  missing=${comp.missing.length}  errored=${comp.errored.length}`);
  if (!comp.complete && !args.has("force")) {
    console.error(`[aggregate] ✗ ABORT: records.jsonl incomplete; refusing to aggregate partial data. Finish: pnpm study:run --run ${paths.stamp}  (or --force)`);
    process.exit(2);
  }
  // Also warn if extractions lag behind the answered records.
  const answered = records.filter((r) => r.response && !r.error).length;
  if (extractions.filter((e) => !e.parseError).length < answered && !args.has("force")) {
    console.error(`[aggregate] ✗ ABORT: extractions incomplete (${extractions.length}/${answered}). Run: pnpm study:extract --run ${paths.stamp}  (or --force)`);
    process.exit(2);
  }

  const graph = aggregate(cfg, records, extractions, paths.runId, new Date().toISOString());
  fs.writeFileSync(paths.aggregate, JSON.stringify(graph, null, 2));

  // Publish to public/research/ for the web page.
  const pub = path.join(process.cwd(), "public", "research");
  fs.mkdirSync(pub, { recursive: true });
  fs.writeFileSync(path.join(pub, "aggregate.json"), JSON.stringify(graph, null, 2));

  const s = graph.summary;
  console.log(`[aggregate] answers=${s.totalAnswers} errors=${s.errorCount}`);
  console.log(
    `[aggregate] selfRate=${pct(s.overallSelfRate)} confusion=${pct(s.confusionRate)} ` +
      `unknown=${pct(s.unknownRate)} refused=${pct(s.refusedRate)}`,
  );
  console.log(`[aggregate] edges=${graph.edges.length} nodes=${graph.vendors.length}`);
  const topConfusion = graph.edges.filter((e) => e.to !== "self" && !["unknown", "refused"].includes(e.to)).slice(0, 5);
  for (const e of topConfusion) console.log(`[aggregate]   ${e.from} -> ${e.to}: ${pct(e.probability)} (${e.count}/${e.total})`);
  console.log(`[aggregate] wrote ${paths.aggregate} and public/research/aggregate.json`);
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
