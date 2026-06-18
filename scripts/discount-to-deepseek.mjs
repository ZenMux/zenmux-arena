// One-off pricing calculator (NOT part of the token-economics pipeline).
//
// Goal: discount a hand-picked set of models so each ends up at the SAME price
// as a DeepSeek anchor. Because a single discount factor `d` multiplies BOTH the
// input and output price, we can only equalize ONE number — so we collapse each
// model's two-axis pricing into the project's standard "blended basket" cost
// (100K input + 1K output tokens; see research/token-economics/types.ts) and make
// THAT equal to the anchor's blended cost. The factor then re-applies to input and
// output alike, so the adjusted blended cost lands exactly on the target.
//
// Rule (threshold = DeepSeek V4 Pro):
//   blended >= Pro          → target = V4 Pro,   factor = pro / blended   (< 1, a discount)
//   Flash < blended < Pro   → target = V4 Flash, factor = flash / blended (< 1, a discount)
//   blended <= Flash        → already cheaper than Flash → leave untouched, factor = 1.0
//
// Reads the latest scraped models-api.json snapshot; writes a CSV. No network, no
// page changes.

import fs from "node:fs";
import path from "node:path";

// ---- blended-basket cost (mirrors types.ts BASKET / blendedCost) -------------
const IN_TOK = 100_000;
const OUT_TOK = 1_000;
const UNIT = 1_000_000;
const blended = (inP, outP) => (inP * IN_TOK) / UNIT + (outP * OUT_TOK) / UNIT;

// ---- locate the newest scrape snapshot --------------------------------------
const baseDir = path.resolve("results/token-economics");
const stamp = fs
  .readdirSync(baseDir)
  .filter((d) => fs.statSync(path.join(baseDir, d)).isDirectory())
  .sort()
  .at(-1);
const snapshot = path.join(baseDir, stamp, "models-api.json");
const raw = JSON.parse(fs.readFileSync(snapshot, "utf8"));
const rows = Array.isArray(raw) ? raw : raw.data || raw.models || [];
const bySlug = new Map(rows.map((m) => [m.slug, m]));
const num = (v) => (v == null || v === "" ? null : Number(v));

// ---- anchors -----------------------------------------------------------------
const proRow = bySlug.get("deepseek/deepseek-v4-pro");
const flashRow = bySlug.get("deepseek/deepseek-v4-flash");
const PRO = { in: num(proRow.pricing_prompt), out: num(proRow.pricing_completion) };
const FLASH = { in: num(flashRow.pricing_prompt), out: num(flashRow.pricing_completion) };
PRO.blended = blended(PRO.in, PRO.out);
FLASH.blended = blended(FLASH.in, FLASH.out);

// ---- the requested set (label as the user wrote it → resolved slug) ----------
const TARGETS = [
  ["GLM 5.2", "z-ai/glm-5.2"],
  ["Kimi K2.7 Code", "moonshotai/kimi-k2.7-code"],
  ["Qwen3.7-Plus", "qwen/qwen3.7-plus"],
  ["MiniMax M3", "minimax/minimax-m3"],
  ["Step 3.7 Flash", "stepfun/step-3.7-flash"],
  ["Qwen3.7-Max", "qwen/qwen3.7-max"],
  ["Agnes-2.0-Flash", "sapiens-ai/agnes-2.0-flash"],
  ["ERNIE 5.1", "baidu/ernie-5.1"],
  ["Ring-2.6-1T", "inclusionai/ring-2.6-1t"],
  ["Ling-2.6-1T", "inclusionai/ling-2.6-1t"],
  ["Hy3 preview", "tencent/hy3-preview"],
  ["MiMo-V2.5", "xiaomi/mimo-v2.5"],
  ["MiMo-V2.5-Pro", "xiaomi/mimo-v2.5-pro"],
  ["Ling-2.6-flash", "inclusionai/ling-2.6-flash"],
  ["KAT-Coder-Pro-V2", "kuaishou/kat-coder-pro-v2"],
  ["Qwen3.6 Flash", "qwen/qwen3.6-flash"],
  ["Doubao-Seed-2.0-pro", "bytedance/doubao-seed-2.0-pro"],
  ["Doubao-Seed-2.0-mini", "bytedance/doubao-seed-2.0-mini"],
];

const r6 = (n) => Math.round(n * 1e6) / 1e6; // 6-dp rounding for display

const out = [];
for (const [label, slug] of TARGETS) {
  const m = bySlug.get(slug);
  if (!m) {
    console.error(`!! not found in snapshot: ${slug} (${label})`);
    continue;
  }
  const inP = num(m.pricing_prompt);
  const outP = num(m.pricing_completion);
  const cost = blended(inP, outP);

  let target, factor, anchorIn, anchorOut, anchorName;
  if (cost <= FLASH.blended) {
    // already cheaper than V4 Flash → leave untouched
    target = "(none — already ≤ Flash)";
    anchorName = "—";
    factor = 1;
    anchorIn = inP;
    anchorOut = outP;
  } else {
    const usePro = cost >= PRO.blended;
    const A = usePro ? PRO : FLASH;
    anchorName = usePro ? "DeepSeek V4 Pro" : "DeepSeek V4 Flash";
    target = anchorName;
    factor = A.blended / cost;
    anchorIn = A.in;
    anchorOut = A.out;
  }

  out.push({
    label,
    slug,
    origIn: inP,
    origOut: outP,
    origBlended: r6(cost),
    anchor: anchorName,
    factor: r6(factor),
    newIn: r6(inP * factor),
    newOut: r6(outP * factor),
    newBlended: r6(cost * factor),
  });
}

// ---- write CSV ---------------------------------------------------------------
const headers = [
  "Model",
  "Slug",
  "Orig Input ($/1M)",
  "Orig Output ($/1M)",
  "Orig Blended ($)",
  "Anchor",
  "Discount Factor",
  "New Input ($/1M)",
  "New Output ($/1M)",
  "New Blended ($)",
];
const csv = [
  headers.join(","),
  ...out.map((r) =>
    [
      `"${r.label}"`,
      r.slug,
      r.origIn,
      r.origOut,
      r.origBlended,
      `"${r.anchor}"`,
      r.factor,
      r.newIn,
      r.newOut,
      r.newBlended,
    ].join(","),
  ),
].join("\n");

const outPath = path.resolve("results/token-economics/discount-to-deepseek.csv");
fs.writeFileSync(outPath, csv + "\n");

// ---- console summary ---------------------------------------------------------
console.log(`Snapshot: ${snapshot}`);
console.log(
  `Anchors → V4 Pro blended=$${r6(PRO.blended)} (in ${PRO.in}/out ${PRO.out}) | ` +
    `V4 Flash blended=$${r6(FLASH.blended)} (in ${FLASH.in}/out ${FLASH.out})`,
);
console.table(
  out.map((r) => ({
    Model: r.label,
    "in→": `${r.origIn}→${r.newIn}`,
    "out→": `${r.origOut}→${r.newOut}`,
    factor: r.factor,
    anchor: r.anchor,
  })),
);
console.log(`\nCSV written: ${outPath}`);
