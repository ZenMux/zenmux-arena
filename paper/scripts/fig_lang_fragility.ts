// Figure: language fragility of self-identity. One dumbbell per model — a track
// from its WORST-language self-rate (left dot) to its BEST-language self-rate
// (right dot), with a small tick at the cross-language mean. A long dumbbell means
// the model "knows who it is" in one tongue but loses it in another; a single dot
// means rock-steady identity across all 10 languages. Rows sort by span (widest at
// top), colored by ground-truth vendor.
//
// This is the cross-linguistic counterpart to fig_model_scatter (which shows the
// mean only) and the paper twin of the web Data Explorer's LanguageFragilityCard.
// Headline: tencent/hy3-preview swings 1% (French) → 98% (Simplified Chinese).
//
// Run:  npx tsx paper/scripts/fig_lang_fragility.ts

import fs from "node:fs";
import path from "node:path";
import { esc, FIG_DIR, L, loadGraph, modelLabels, r2, svgRoot, vendorColor, vendorNames, writePng, writeSvg } from "./figlib";

interface Stats {
  langFragility: {
    modelId: string;
    vendor: string;
    min: number;
    minLang: number | string;
    max: number;
    maxLang: number | string;
    mean: number;
    range: number;
  }[];
}

// A model whose self-rate barely moves across languages (span < 0.5pp) is "flat":
// we draw a single dot rather than a misleading hairline dumbbell.
const FLAT_EPS = 0.005;

function main() {
  const g = loadGraph();
  const labels = modelLabels(g);
  const vnames = vendorNames(g);
  const stats = JSON.parse(fs.readFileSync(path.join(FIG_DIR, "stats.json"), "utf8")) as Stats;

  const rows = stats.langFragility; // already sorted by range desc in stats.ts

  const rowH = 30;
  const gap = 8;
  const labelW = 210;
  const plotW = 540;
  const padX = 40;
  const padTop = 110;
  const padBottom = 78;
  const x0 = padX + labelW;
  const width = padX * 2 + labelW + plotW + 110;
  const height = padTop + rows.length * (rowH + gap) + padBottom;

  const parts: string[] = [];
  parts.push(`<text x="${padX}" y="46" font-size="30" font-weight="700" fill="#16161a">${esc(L("身份的语言脆弱性", "Language fragility of self-identity"))}</text>`);
  parts.push(
    `<text x="${padX}" y="76" font-size="16" fill="#6b7280">${esc(L("Per-model self-ID span across 10 languages · 哑铃越长，身份越随语言摇摆 · 颜色=真实厂商", "Per-model self-ID span across 10 languages · longer dumbbell = identity swings more with language · color = true vendor"))}</text>`,
  );

  // x gridlines
  for (let p = 0; p <= 100; p += 25) {
    const x = x0 + (p / 100) * plotW;
    parts.push(
      `<line x1="${r2(x)}" y1="${padTop - 8}" x2="${r2(x)}" y2="${padTop + rows.length * (rowH + gap) - gap}" stroke="#eceef1" stroke-width="1"/>`,
    );
    parts.push(`<text x="${r2(x)}" y="${padTop - 16}" text-anchor="middle" font-size="12" fill="#9ca3af">${p}%</text>`);
  }

  rows.forEach((row, i) => {
    const y = padTop + i * (rowH + gap) + rowH / 2;
    const color = vendorColor(row.vendor);
    const flat = row.range < FLAT_EPS;

    // model label + vendor sublabel (right-aligned to the plot)
    parts.push(
      `<text x="${x0 - 14}" y="${r2(y + 4)}" text-anchor="end" font-size="13.5" font-weight="600" fill="#16161a">${esc(labels[row.modelId] ?? row.modelId)}</text>`,
    );
    parts.push(
      `<text x="${x0 - 14}" y="${r2(y + 18)}" text-anchor="end" font-size="10" fill="#9ca3af">${esc(vnames[row.vendor] ?? row.vendor)}</text>`,
    );

    const xMin = x0 + row.min * plotW;
    const xMax = x0 + row.max * plotW;

    if (!flat) {
      // connecting track min -> max
      parts.push(`<line x1="${r2(xMin)}" y1="${r2(y)}" x2="${r2(xMax)}" y2="${r2(y)}" stroke="${color}" stroke-width="3" stroke-opacity="0.35"/>`);
      // mean tick
      const xMean = x0 + row.mean * plotW;
      parts.push(`<line x1="${r2(xMean)}" y1="${r2(y - 6)}" x2="${r2(xMean)}" y2="${r2(y + 6)}" stroke="${color}" stroke-width="1.5" stroke-opacity="0.6"/>`);
      // min dot (hollow) + label below-left
      parts.push(`<circle cx="${r2(xMin)}" cy="${r2(y)}" r="5.5" fill="#ffffff" stroke="${color}" stroke-width="2"/>`);
      parts.push(
        `<text x="${r2(xMin - 9)}" y="${r2(y + 4)}" text-anchor="end" font-size="11.5" font-weight="700" fill="${color}">${(row.min * 100).toFixed(0)}%</text>`,
      );
      parts.push(
        `<text x="${r2(xMin - 9)}" y="${r2(y + 16)}" text-anchor="end" font-size="9" fill="#9ca3af">${esc(String(row.minLang))}</text>`,
      );
    }
    // max dot (filled) — always shown
    parts.push(`<circle cx="${r2(xMax)}" cy="${r2(y)}" r="6" fill="${color}"/>`);
    parts.push(
      `<text x="${r2(xMax + 11)}" y="${r2(y + 4)}" font-size="11.5" font-weight="700" fill="${color}">${(row.max * 100).toFixed(0)}%</text>`,
    );
    parts.push(
      `<text x="${r2(xMax + 11)}" y="${r2(y + 16)}" font-size="9" fill="#9ca3af">${flat ? "all" : esc(String(row.maxLang))}</text>`,
    );
  });

  // legend
  const ly = padTop + rows.length * (rowH + gap) + 34;
  parts.push(`<circle cx="${padX + 6}" cy="${ly - 4}" r="5.5" fill="#ffffff" stroke="#6b7280" stroke-width="2"/>`);
  parts.push(`<text x="${padX + 18}" y="${ly}" font-size="13" fill="#374151">${esc(L("最弱语言 worst language", "worst language (hollow)"))}</text>`);
  parts.push(`<circle cx="${padX + 210}" cy="${ly - 4}" r="6" fill="#6b7280"/>`);
  parts.push(`<text x="${padX + 222}" y="${ly}" font-size="13" fill="#374151">${esc(L("最强语言 best language", "best language (filled)"))}</text>`);
  parts.push(`<line x1="${padX + 410}" y1="${ly - 10}" x2="${padX + 410}" y2="${ly + 2}" stroke="#6b7280" stroke-width="1.5"/>`);
  parts.push(`<text x="${padX + 420}" y="${ly}" font-size="13" fill="#374151">${esc(L("跨语言均值 mean", "cross-language mean"))}</text>`);

  const svg = svgRoot(width, height, parts.join("\n"));
  fs.mkdirSync(FIG_DIR, { recursive: true });
  writeSvg(svg, "fig_lang_fragility.svg");
  writePng(svg, "fig_lang_fragility.png", width * 2);
}

main();
