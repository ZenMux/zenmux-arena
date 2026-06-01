// Figure: per-MODEL self-identification, 27 models as horizontal lollipops grouped
// and colored by ground-truth vendor, sorted by self-rate. Exposes WITHIN-vendor
// spread the vendor-level view hides — e.g. ByteDance's Doubao-Code is an outlier
// far below its three siblings; the two inclusionAI models sit together at the floor.
//
// Run:  npx tsx paper/scripts/fig_model_scatter.ts

import fs from "node:fs";
import path from "node:path";
import { esc, FIG_DIR, loadGraph, modelLabels, modelVendors, r2, svgRoot, vendorColor, vendorNames, writePng, writeSvg } from "./figlib";

interface Stats {
  byModel: Record<string, { n: number; self: number; cross: number; refused: number; unknown: number }>;
}

function main() {
  const g = loadGraph();
  const labels = modelLabels(g);
  const gtVendor = modelVendors(g);
  const vnames = vendorNames(g);
  const stats = JSON.parse(fs.readFileSync(path.join(FIG_DIR, "stats.json"), "utf8")) as Stats;

  const rows = Object.entries(stats.byModel)
    .map(([id, r]) => ({ id, vendor: gtVendor[id], label: labels[id] ?? id, ...r }))
    .sort((a, b) => a.self - b.self);

  const rowH = 30;
  const gap = 8;
  const labelW = 200;
  const plotW = 560;
  const padX = 36;
  const padTop = 100;
  const padBottom = 60;
  const width = padX * 2 + labelW + plotW + 90;
  const height = padTop + rows.length * (rowH + gap) + padBottom;
  const x0 = padX + labelW;

  const parts: string[] = [];
  parts.push(`<text x="${padX}" y="44" font-size="30" font-weight="700" fill="#16161a">每个模型的自指率</text>`);
  parts.push(
    `<text x="${padX}" y="74" font-size="16" fill="#6b7280">Per-model self-identification rate (27 models) · 颜色=真实厂商 · 同厂模型差异显著</text>`,
  );

  // x gridlines
  for (let p = 0; p <= 100; p += 25) {
    const x = x0 + (p / 100) * plotW;
    parts.push(`<line x1="${r2(x)}" y1="${padTop - 8}" x2="${r2(x)}" y2="${padTop + rows.length * (rowH + gap) - gap}" stroke="#eceef1" stroke-width="1"/>`);
    parts.push(`<text x="${r2(x)}" y="${padTop - 16}" text-anchor="middle" font-size="12" fill="#9ca3af">${p}%</text>`);
  }

  rows.forEach((row, i) => {
    const y = padTop + i * (rowH + gap) + rowH / 2;
    const color = vendorColor(row.vendor);
    // model label + (vendor)
    parts.push(
      `<text x="${x0 - 14}" y="${r2(y + 5)}" text-anchor="end" font-size="14" font-weight="600" fill="#16161a">${esc(row.label)}</text>`,
    );
    parts.push(
      `<text x="${x0 - 14}" y="${r2(y + 19)}" text-anchor="end" font-size="10.5" fill="#9ca3af">${esc(vnames[row.vendor] ?? row.vendor)}</text>`,
    );
    // lollipop stem from 0 to value
    const xv = x0 + row.self * plotW;
    parts.push(`<line x1="${r2(x0)}" y1="${r2(y)}" x2="${r2(xv)}" y2="${r2(y)}" stroke="${color}" stroke-width="3" stroke-opacity="0.45"/>`);
    parts.push(`<circle cx="${r2(xv)}" cy="${r2(y)}" r="7" fill="${color}"/>`);
    parts.push(
      `<text x="${r2(xv + 14)}" y="${r2(y + 5)}" font-size="13" font-weight="700" fill="${color}">${(row.self * 100).toFixed(1)}%</text>`,
    );
  });

  const svg = svgRoot(width, height, parts.join("\n"));
  writeSvg(svg, "fig_model_scatter.svg");
  writePng(svg, "fig_model_scatter.png", width * 2);
}

main();
