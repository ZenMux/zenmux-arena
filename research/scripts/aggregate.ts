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
  // Abort if extractions lag behind the answered records. Compare by KEY SET, not by
  // raw counts: an orphan extraction (one whose record is gone) or a duplicate would
  // otherwise let a length comparison pass even though some answered key is unextracted.
  const answeredRecords = records.filter((r) => r.response && !r.error);
  const answeredKeys = new Set(answeredRecords.map((r) => r.key));
  const cleanlyExtracted = new Set(extractions.filter((e) => !e.parseError).map((e) => e.key));
  const unextracted = [...answeredKeys].filter((k) => !cleanlyExtracted.has(k));
  if (unextracted.length > 0 && !args.has("force")) {
    console.error(
      `[aggregate] ✗ ABORT: ${unextracted.length}/${answeredKeys.size} answered key(s) lack a clean extraction. ` +
        `Run: pnpm study:extract --run ${paths.stamp}  (or --force)`,
    );
    console.error(`[aggregate]   unextracted sample: ${unextracted.slice(0, 8).join(", ")}${unextracted.length > 8 ? " …" : ""}`);
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
  if (s.missingExtraction > 0) {
    console.log(`[aggregate] ⚠ ${s.missingExtraction} answered record(s) had no extraction — counted as unknown.`);
  }
  console.log(
    `[aggregate] selfRate=${pct(s.overallSelfRate)} confusion=${pct(s.confusionRate)} ` +
      `unknown=${pct(s.unknownRate)} refused=${pct(s.refusedRate)}`,
  );
  console.log(`[aggregate] edges=${graph.edges.length} nodes=${graph.vendors.length}`);

  // Full report — NO truncation, NO threshold. Everything in aggregate.json is shown,
  // partitioned into the same buckets the data uses, sorted by probability desc.
  const isPseudoTo = (to: string) => to === "self" || to === "unknown" || to === "refused";
  const confusion = graph.edges.filter((e) => !isPseudoTo(e.to)); // real cross-vendor (incl. other:<brand>)
  const buckets = graph.edges.filter((e) => isPseudoTo(e.to)); // self / unknown / refused sinks

  console.log(`[aggregate] ── cross-vendor confusion edges (${confusion.length}) ──`);
  if (confusion.length === 0) console.log(`[aggregate]   (none)`);
  for (const e of confusion) {
    console.log(`[aggregate]   ${e.from} -> ${e.to}: ${pct(e.probability)} (${e.count}/${e.total})`);
  }

  console.log(`[aggregate] ── self / unknown / refused edges (${buckets.length}) ──`);
  for (const e of buckets) {
    console.log(`[aggregate]   ${e.from} -> ${e.to}: ${pct(e.probability)} (${e.count}/${e.total})`);
  }

  // Node roster, so the printed view fully matches the vendors stored in aggregate.json.
  const nodeNames = graph.vendors.map((v) => v.id).sort();
  console.log(`[aggregate] ── nodes (${graph.vendors.length}) ──`);
  console.log(`[aggregate]   ${nodeNames.join(", ")}`);

  console.log(`[aggregate] wrote ${paths.aggregate} and public/research/aggregate.json`);
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
