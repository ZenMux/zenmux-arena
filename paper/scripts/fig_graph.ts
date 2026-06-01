// Figure: the circular "who-claims-to-be-whom" relationship graph — rendered by
// the EXACT same buildGraphSvg() the web studio + /api/export use, so the paper's
// flagship figure is byte-for-byte the production graph. We only set a few render
// knobs (white background, top-3 edge labels to avoid clutter, a confusion
// threshold) and rasterize at 2x with the bundled CJK font.
//
// Run:  npx tsx paper/scripts/fig_graph.ts

import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_RENDER, isOffByDefault, type RenderConfig } from "../../research/lib/geometry";
import { buildGraphSvg } from "../../research/lib/svg";
import type { VendorId } from "../../research/lib/types";
import { FIG_DIR, FONT_PATH, loadGraph, REPO_ROOT } from "./figlib";

function rasterize(svg: string, filename: string, scale: number) {
  const widthMatch = svg.match(/width="(\d+(?:\.\d+)?)"/);
  const svgWidth = widthMatch ? Number(widthMatch[1]) : 1200;
  const fontFiles = fs.existsSync(FONT_PATH) ? [FONT_PATH] : [];
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: Math.round(svgWidth * scale) },
    font: { fontFiles, loadSystemFonts: true, defaultFontFamily: "Noto Sans SC" },
    background: "#ffffff",
  });
  const png = resvg.render().asPng();
  const out = path.join(FIG_DIR, filename);
  fs.writeFileSync(out, png);
  console.log(`  wrote ${path.relative(REPO_ROOT, out)} (${(png.length / 1024).toFixed(0)} KB)`);
}

function main() {
  const g = loadGraph();

  // Aggregate graph: every confusion edge >= 4% in at least one language,
  // labelled with the top driving language (+N overflow). White background,
  // no chrome (the LaTeX caption carries the title), colored by source vendor.
  const config: RenderConfig = {
    ...DEFAULT_RENDER,
    background: "#ffffff",
    labelMode: "top",
    threshold: 0.04,
    chrome: false,
    curveBow: 0.2,
    edgeWidthScale: 6,
  };

  // Mirror the studio's default picker: hide the analytical buckets (unknown/
  // refused) and every one-off extractor-discovered `other:<brand>` singleton, so
  // the ring is just the canonical vendors and the graph reads as vendor↔vendor
  // confusion. Without this the dozens of hallucinated brand nodes bloat the ring.
  const hidden: VendorId[] = g.vendors.map((v) => v.id).filter((id) => isOffByDefault(id));

  const svg = buildGraphSvg(g, { config, hidden });
  fs.mkdirSync(FIG_DIR, { recursive: true });
  fs.writeFileSync(path.join(FIG_DIR, "fig_graph.svg"), svg, "utf8");
  console.log("  wrote paper/figures/fig_graph.svg");
  rasterize(svg, "fig_graph.png", 2);
}

main();
