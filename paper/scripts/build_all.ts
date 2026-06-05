// One-shot regenerator for every paper artifact derived from the mix aggregate:
//   stats.json  ->  all figures (PNG+SVG)  ->  all LaTeX tables + macros.
// Run this after re-mixing/re-aggregating to refresh the whole paper's data layer.
//
// Run:  npx tsx paper/scripts/build_all.ts

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, "..", "..");
const steps = [
  "stats.ts",
  "fig_vendor_bars.ts",
  "fig_variant_gradient.ts",
  "fig_imitation_balance.ts", // NEW: who-imitates-whom diverging bar (by count)
  "fig_imitation_degree.ts", // NEW: same, binarized to distinct-vendor edge degree
  "fig_lang_heatmap.ts",
  "fig_lang_fragility.ts", // NEW: per-model self-ID span across languages
  "fig_model_scatter.ts",
  "gen_tables.ts",
];

for (const s of steps) {
  console.log(`\n▶ ${s}`);
  execFileSync("npx", ["tsx", path.join(HERE, s)], { stdio: "inherit" });
}

// The flagship relationship graph is NOT CLI-rendered anymore — it is the WYSIWYG
// PNG manually exported from the web studio (per-edge curves, hand-tuned layout)
// and committed under public/research/. We copy that canonical export into
// figures/fig_graph.png so the build stays one-command and the paper shows exactly
// the graph the studio produced. (fig_graph.ts remains as a fallback renderer.)
{
  const src = path.join(REPO_ROOT, "public/research/who-are-you-mix-20260601T062425.png");
  const dest = path.join(HERE, "..", "figures", "fig_graph.png");
  console.log(`\n▶ copy studio graph export -> figures/fig_graph.png`);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  copied ${path.relative(REPO_ROOT, src)} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
  } else {
    console.warn(`  ! studio export not found at ${path.relative(REPO_ROOT, src)} — falling back to fig_graph.ts`);
    execFileSync("npx", ["tsx", path.join(HERE, "fig_graph.ts")], { stdio: "inherit" });
  }
}

console.log("\n✓ all paper artifacts regenerated.");
