// Generate the arxiv-style Markdown report from aggregate.json.
//
// Usage: pnpm study:report [--config config/study.yaml] [--run <stamp|latest>]

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "../lib/args";
import { bootstrapStudyId, loadRunConfig } from "../lib/config";
import { buildReport } from "../lib/report";
import { resolveRun } from "../lib/store";
import type { GraphData } from "../lib/types";

async function main() {
  const args = parseArgs();
  const studyId = bootstrapStudyId(args.get("config"));
  const paths = resolveRun(studyId, args.get("run"));
  if (!paths) {
    console.error(`[report] no run found for study "${studyId}".`);
    process.exit(1);
  }
  // Load the run's pinned config snapshot (back-filled for older runs). Not strictly
  // needed today since report reads aggregate.json, but keeps all four scripts uniform.
  loadRunConfig(paths.config, args.get("config"));

  if (!fs.existsSync(paths.aggregate)) {
    console.error(`[report] ${paths.aggregate} not found. Run study:aggregate first.`);
    process.exit(1);
  }
  const graph = JSON.parse(fs.readFileSync(paths.aggregate, "utf8")) as GraphData;

  const md = buildReport(graph);
  fs.writeFileSync(paths.report, md);

  // Also publish to public/research for convenience.
  const pub = path.join(process.cwd(), "public", "research");
  fs.mkdirSync(pub, { recursive: true });
  fs.writeFileSync(path.join(pub, "report.md"), md);

  console.log(`[report] wrote ${paths.report} (${md.length} chars) and public/research/report.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
