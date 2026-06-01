// One-shot regenerator for every paper artifact derived from the mix aggregate:
//   stats.json  ->  all figures (PNG+SVG)  ->  all LaTeX tables + macros.
// Run this after re-mixing/re-aggregating to refresh the whole paper's data layer.
//
// Run:  npx tsx paper/scripts/build_all.ts

import { execFileSync } from "node:child_process";
import path from "node:path";

const HERE = __dirname;
const steps = [
  "stats.ts",
  "fig_vendor_bars.ts",
  "fig_variant_gradient.ts",
  "fig_lang_heatmap.ts",
  "fig_model_scatter.ts",
  "fig_graph.ts",
  "gen_tables.ts",
];

for (const s of steps) {
  console.log(`\n▶ ${s}`);
  execFileSync("npx", ["tsx", path.join(HERE, s)], { stdio: "inherit" });
}
console.log("\n✓ all paper artifacts regenerated.");
