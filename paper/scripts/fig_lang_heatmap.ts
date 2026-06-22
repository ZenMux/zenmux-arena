// Figure: language × vendor cross-vendor-confusion heatmap. Rows = ground-truth
// vendors (sorted by overall confusion), columns = the 10 languages (sorted by
// overall confusion). Cell color = that vendor's cross-vendor rate in that
// language. Surfaces the cross-linguistic axis: which tongues destabilize which
// vendors, and that Simplified Chinese is the most robust column.
//
// Run:  npx tsx paper/scripts/fig_lang_heatmap.ts

import fs from "node:fs";
import {
  EXTRACTIONS_PATH,
  esc,
  heatColor,
  L,
  LANG,
  LANG_EN,
  loadGraph,
  r2,
  RECORDS_PATH,
  svgRoot,
  vendorNames,
  writePng,
  writeSvg,
} from "./figlib";

const PSEUDO = new Set(["self", "unknown", "refused"]);

function main() {
  const g = loadGraph();
  const names = vendorNames(g);
  const langOrder = g.languages.map((l) => l.code);
  // Column header per language: native name (简体中文 / 日本語 / Русский …) in the
  // Chinese build, English name (Chinese (Simpl.) / Japanese / Russian …) in the
  // English build — so an EN reader never meets a CJK/Cyrillic column header.
  const langName: Record<string, string> = {};
  for (const l of g.languages) langName[l.code] = LANG === "en" ? (LANG_EN[l.code] ?? l.name) : l.name;

  // gid -> (vendor, lang)
  const rec = new Map<string, { vendor: string; lang: string }>();
  for (const line of fs.readFileSync(RECORDS_PATH, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    rec.set(r.generationId, { vendor: r.modelVendor, lang: r.langCode });
  }

  // counts[vendor][lang] = { cross, n }
  const counts: Record<string, Record<string, { cross: number; n: number }>> = {};
  for (const line of fs.readFileSync(EXTRACTIONS_PATH, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const e = JSON.parse(line);
    const m = rec.get(e.sourceGenerationId);
    if (!m) continue;
    const claimed: string = e.claimedVendor;
    const effective = claimed === m.vendor ? "self" : claimed;
    const isCross = !PSEUDO.has(effective); // real different vendor or other:* brand
    const cell = ((counts[m.vendor] ??= {})[m.lang] ??= { cross: 0, n: 0 });
    cell.n++;
    if (isCross) cell.cross++;
  }

  // vendor rows sorted by overall cross-rate desc
  const vendorRows = Object.keys(counts)
    .map((v) => {
      let cross = 0,
        n = 0;
      for (const lc of langOrder) {
        const c = counts[v]?.[lc];
        if (c) {
          cross += c.cross;
          n += c.n;
        }
      }
      return { v, rate: n ? cross / n : 0 };
    })
    .sort((a, b) => b.rate - a.rate)
    .map((x) => x.v);

  // language columns sorted by overall cross-rate desc
  const langCols = [...langOrder]
    .map((lc) => {
      let cross = 0,
        n = 0;
      for (const v of vendorRows) {
        const c = counts[v]?.[lc];
        if (c) {
          cross += c.cross;
          n += c.n;
        }
      }
      return { lc, rate: n ? cross / n : 0 };
    })
    .sort((a, b) => b.rate - a.rate)
    .map((x) => x.lc);

  // Layout. English language names (e.g. "Portuguese", "Chinese (Simpl.)") are far
  // wider than the native CJK headers that fit a 56px column, so the English build
  // rotates the column headers diagonally and needs extra header height to clear them.
  const cell = 56;
  const labelW = 150;
  const headH = LANG === "en" ? 168 : 132;
  const padX = 36;
  const padBottom = 80;
  const width = padX * 2 + labelW + langCols.length * cell + 40;
  const height = headH + vendorRows.length * cell + padBottom;

  const parts: string[] = [];
  parts.push(`<text x="${padX}" y="44" font-size="30" font-weight="700" fill="#16161a">${esc(L("语言 × 厂商 的跨厂混淆率", "Cross-vendor confusion rate, vendor × language"))}</text>`);
  parts.push(
    `<text x="${padX}" y="74" font-size="16" fill="#6b7280">${esc(L("Cross-vendor confusion rate, vendor × language · 颜色越深越易混淆", "Rows = true vendor, columns = language · darker = more confusion"))}</text>`,
  );

  const gx = padX + labelW;
  // column headers — centered native names (ZH) or diagonally rotated English names
  // so the wider Latin labels don't overrun the 56px columns.
  langCols.forEach((lc, j) => {
    const x = gx + j * cell + cell / 2;
    if (LANG === "en") {
      const anchorX = r2(x);
      const anchorY = headH - 10;
      parts.push(
        `<text x="${anchorX}" y="${anchorY}" transform="rotate(-35 ${anchorX} ${anchorY})" text-anchor="start" font-size="13" font-weight="600" fill="#374151">${esc(langName[lc])}</text>`,
      );
    } else {
      parts.push(
        `<text x="${r2(x)}" y="${headH - 12}" text-anchor="middle" font-size="14" font-weight="600" fill="#374151">${esc(langName[lc])}</text>`,
      );
    }
  });

  // rows
  vendorRows.forEach((v, i) => {
    const y = headH + i * cell;
    parts.push(
      `<text x="${gx - 12}" y="${r2(y + cell / 2 + 5)}" text-anchor="end" font-size="15" font-weight="600" fill="#16161a">${esc(names[v] ?? v)}</text>`,
    );
    langCols.forEach((lc, j) => {
      const x = gx + j * cell;
      const c = counts[v]?.[lc];
      const rate = c && c.n ? c.cross / c.n : 0;
      // scale: emphasize low rates too — sqrt makes small confusion visible
      const t = Math.sqrt(rate);
      parts.push(`<rect x="${r2(x)}" y="${r2(y)}" width="${cell - 3}" height="${cell - 3}" fill="${heatColor(t)}" rx="3" stroke="#eceef1" stroke-width="1"/>`);
      if (rate >= 0.01) {
        const textColor = t > 0.55 ? "#ffffff" : "#5b3a36";
        parts.push(
          `<text x="${r2(x + (cell - 3) / 2)}" y="${r2(y + cell / 2 + 4)}" text-anchor="middle" font-size="12.5" font-weight="700" fill="${textColor}">${(rate * 100).toFixed(0)}</text>`,
        );
      }
    });
  });

  // colorbar legend
  const ly = headH + vendorRows.length * cell + 34;
  parts.push(`<text x="${padX}" y="${ly + 4}" font-size="13" fill="#6b7280">${esc(L("混淆率 %:", "confusion %:"))}</text>`);
  const barX = padX + 90;
  const barW = 240;
  const steps = 40;
  for (let s = 0; s < steps; s++) {
    const t = s / (steps - 1);
    parts.push(`<rect x="${r2(barX + (s / steps) * barW)}" y="${ly - 10}" width="${barW / steps + 1}" height="14" fill="${heatColor(t)}"/>`);
  }
  for (const [t, lbl] of [[0, "0"], [0.5, "25"], [0.71, "50"], [1, "100"]] as [number, string][]) {
    parts.push(`<text x="${r2(barX + t * barW)}" y="${ly + 22}" text-anchor="middle" font-size="11" fill="#9ca3af">${lbl}</text>`);
  }
  parts.push(`<text x="${barX + barW + 30}" y="${ly + 4}" font-size="12" fill="#9ca3af">${esc(L("(颜色按 √ 标度，放大低值)", "(color on a √ scale to amplify low values)"))}</text>`);

  const svg = svgRoot(width, height, parts.join("\n"));
  writeSvg(svg, "fig_lang_heatmap.svg");
  writePng(svg, "fig_lang_heatmap.png", width * 2);
}

main();
