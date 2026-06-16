// Token Economics pipeline — scrape ZenMux's model listing, derive per-model
// price/usage economics, and publish the artifact the viewer reads.
//
// Unlike the "Who Are You?" study this makes NO model API calls (so no
// ZENMUX_API_KEY, no completeness gate) — it just scrapes the public listing.
// Like the other study it writes a timestamped run dir AND publishes a copy to
// public/research/ for the Next.js page.
//
// Usage:
//   pnpm tokenecon                       # scrape live, write run + publish
//   pnpm tokenecon --html path/to.html   # parse a saved HTML snapshot (offline)
//   pnpm tokenecon --no-publish          # write the run dir only, don't publish

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "../lib/args";
import { fetchModelsHtml, parseModels, MODELS_URL } from "../token-economics/scrape";
import { compute } from "../token-economics/compute";

const STUDY_ID = "token-economics";

/** results/<study>/<stamp> using the same compact stamp shape as the other study. */
function stamp(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(n < 0.01 ? 5 : 4)}`;
}

function fmtTokens(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return String(n);
}

async function main() {
  const args = parseArgs();
  const now = new Date();

  // 1) Acquire HTML — live fetch or a saved snapshot for offline/repro runs.
  let html: string;
  const htmlPath = args.get("html");
  if (htmlPath) {
    console.log(`[tokenecon] reading saved HTML: ${htmlPath}`);
    html = fs.readFileSync(htmlPath, "utf8");
  } else {
    console.log(`[tokenecon] fetching ${MODELS_URL}`);
    html = await fetchModelsHtml();
    console.log(`[tokenecon] fetched ${(html.length / 1024).toFixed(0)} KB`);
  }

  // 2) Parse + compute.
  const rows = parseModels(html);
  console.log(`[tokenecon] parsed ${rows.length} card row(s)`);
  const { data, dropped } = compute(rows, now.toISOString());

  if (data.models.length === 0) {
    console.error(
      `[tokenecon] ✗ ABORT: parsed 0 priced models — the page layout likely changed. ` +
        `Inspect the HTML and update research/token-economics/scrape.ts.`,
    );
    process.exit(2);
  }
  if (dropped.length) {
    console.log(`[tokenecon] dropped ${dropped.length} unpriced row(s): ${dropped.join(", ")}`);
  }

  // 3) Write the timestamped run dir (records the raw HTML + the artifact for audit).
  const runDir = path.join(process.cwd(), "results", STUDY_ID, stamp(now));
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, "models.html"), html);
  fs.writeFileSync(
    path.join(runDir, "token-economics.json"),
    JSON.stringify(data, null, 2),
  );
  console.log(`[tokenecon] wrote ${runDir}/token-economics.json`);

  // 4) Publish to public/research/ for the web page (unless suppressed).
  if (!args.has("no-publish")) {
    const pub = path.join(process.cwd(), "public", "research");
    fs.mkdirSync(pub, { recursive: true });
    fs.writeFileSync(
      path.join(pub, "token-economics.json"),
      JSON.stringify(data, null, 2),
    );
    console.log(`[tokenecon] published public/research/token-economics.json`);
  }

  // 5) Console summary — a quick sanity read of the headline numbers.
  const s = data.summary;
  console.log(`[tokenecon] ── summary ──`);
  console.log(`[tokenecon]   models=${s.modelCount}  vendors=${s.vendorCount}  withUsage=${s.withUsage}`);
  console.log(`[tokenecon]   basket=${data.basket.inputTokens / 1000}K in + ${data.basket.outputTokens / 1000}K out`);
  console.log(`[tokenecon]   median basket cost=${fmtUsd(s.medianBlendedCost)}  mean=${fmtUsd(s.meanBlendedCost)}`);
  if (s.priciest) console.log(`[tokenecon]   priciest: ${s.priciest.name} ${fmtUsd(s.priciest.blendedCost)}`);
  if (s.cheapest) console.log(`[tokenecon]   cheapest: ${s.cheapest.name} ${fmtUsd(s.cheapest.blendedCost)}`);
  if (s.mostUsed) console.log(`[tokenecon]   most used: ${s.mostUsed.name} ${fmtTokens(s.mostUsed.usageTokens)} tokens`);
  if (s.bestValue) console.log(`[tokenecon]   best value: ${s.bestValue.name} ${fmtTokens(s.bestValue.tokensPerDollar)} tokens/$`);

  console.log(`[tokenecon] ── top 10 priciest (per ${data.basket.inputTokens / 1000}K in + ${data.basket.outputTokens}-out basket) ──`);
  for (const m of [...data.models].sort((a, b) => b.blendedCost - a.blendedCost).slice(0, 10)) {
    console.log(`[tokenecon]   ${fmtUsd(m.blendedCost).padStart(9)}  in=$${m.inputPrice}/M out=$${m.outputPrice}/M  ${m.slug}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
