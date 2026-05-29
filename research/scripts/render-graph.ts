// Render the relationship graph: GraphData -> graph.svg -> graph.png (resvg).
// Publishes graph.png to public/research/.
//
// Usage: pnpm study:render [--config config/study.yaml] [--run <stamp|latest>]
//                          [--lang <code>] [--threshold <p>]

import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "../lib/args";
import { loadConfig } from "../lib/config";
import { resolveRun } from "../lib/store";
import { buildGraphSvg } from "../lib/svg";
import type { GraphData } from "../lib/types";

const FONT_PATH = path.join(process.cwd(), "research", "assets", "NotoSansSC-Regular.otf");

async function main() {
  const args = parseArgs();
  const cfg = loadConfig(args.get("config"));
  const paths = resolveRun(cfg.study.id, args.get("run"));
  if (!paths) {
    console.error(`[graph] no run found for study "${cfg.study.id}".`);
    process.exit(1);
  }

  if (!fs.existsSync(paths.aggregate)) {
    console.error(`[graph] ${paths.aggregate} not found. Run study:aggregate first.`);
    process.exit(1);
  }
  const graph = JSON.parse(fs.readFileSync(paths.aggregate, "utf8")) as GraphData;

  const langCode = args.get("lang");
  // Threshold comes from config (graph.edgeThreshold); --threshold overrides it.
  const threshold = args.has("threshold") ? args.num("threshold", cfg.graph.edgeThreshold) : cfg.graph.edgeThreshold;

  const svg = buildGraphSvg(graph, { langCode, threshold });
  fs.writeFileSync(paths.graphSvg, svg);

  const fontFiles = fs.existsSync(FONT_PATH) ? [FONT_PATH] : [];
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1600 },
    font: { fontFiles, loadSystemFonts: true, defaultFontFamily: "Noto Sans SC" },
    background: "#ffffff",
  });
  const png = resvg.render().asPng();
  fs.writeFileSync(paths.graphPng, png);

  const pub = path.join(process.cwd(), "public", "research");
  fs.mkdirSync(pub, { recursive: true });
  fs.copyFileSync(paths.graphPng, path.join(pub, "graph.png"));
  fs.copyFileSync(paths.graphSvg, path.join(pub, "graph.svg"));

  console.log(`[graph] wrote ${paths.graphSvg} and ${paths.graphPng} (${png.length} bytes)`);
  console.log(`[graph] published public/research/graph.png + graph.svg`);
  if (fontFiles.length === 0) console.warn(`[graph] WARNING: CJK font not found at ${FONT_PATH}; Chinese text may not render.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
