// Figure: per-vendor outcome composition (self / cross-vendor / refused / unknown),
// one horizontal stacked bar per ground-truth vendor, sorted by self-rate ascending
// so the most identity-confused vendors sit at the top. Vendor brand colors mark the
// "self" segment; the confusion/refusal/unknown segments use a fixed legend palette.
//
// Run:  npx tsx paper/scripts/fig_vendor_bars.ts

import fs from "node:fs";
import path from "node:path";
import { esc, FIG_DIR, loadGraph, r2, svgRoot, vendorColor, vendorNames, writePng, writeSvg } from "./figlib";

interface Stats {
  byVendor: Record<string, { n: number; self: number; cross: number; refused: number; unknown: number }>;
}

const SEG = {
  self: (id: string) => vendorColor(id),
  cross: "#c0392b", // brand-ish red — the confusion signal
  refused: "#9aa0a6", // gray
  unknown: "#d8dbe0", // light gray
};

function main() {
  const g = loadGraph();
  const names = vendorNames(g);
  const stats = JSON.parse(fs.readFileSync(path.join(FIG_DIR, "stats.json"), "utf8")) as Stats;

  const rows = Object.entries(stats.byVendor)
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => a.self - b.self);

  // Layout
  const rowH = 46;
  const gap = 14;
  const labelW = 150;
  const barW = 760;
  const padX = 40;
  const padTop = 96;
  const padBottom = 90;
  const width = padX * 2 + labelW + barW + 70;
  const height = padTop + rows.length * (rowH + gap) + padBottom;

  const parts: string[] = [];
  // Title
  parts.push(
    `<text x="${padX}" y="44" font-size="30" font-weight="700" fill="#16161a">每个厂商的身份自指构成</text>`,
  );
  parts.push(
    `<text x="${padX}" y="74" font-size="16" fill="#6b7280">Per-vendor outcome composition · 按自指率升序 · n=${g.summary.totalAnswers} answers</text>`,
  );

  const x0 = padX + labelW;
  rows.forEach((row, i) => {
    const y = padTop + i * (rowH + gap);
    // vendor name (right-aligned to the bar)
    parts.push(
      `<text x="${x0 - 14}" y="${y + rowH / 2}" text-anchor="end" dominant-baseline="middle" font-size="17" font-weight="600" fill="#16161a">${esc(names[row.id] ?? row.id)}</text>`,
    );
    // stacked segments
    let cx = x0;
    const segs: [number, string][] = [
      [row.self, SEG.self(row.id)],
      [row.cross, SEG.cross],
      [row.refused, SEG.refused],
      [row.unknown, SEG.unknown],
    ];
    for (const [frac, color] of segs) {
      const w = frac * barW;
      if (w > 0.5) {
        parts.push(`<rect x="${r2(cx)}" y="${y}" width="${r2(w)}" height="${rowH}" fill="${color}" rx="2"/>`);
      }
      cx += w;
    }
    // self-rate number at the right end
    parts.push(
      `<text x="${r2(x0 + barW + 12)}" y="${y + rowH / 2}" dominant-baseline="middle" font-size="16" font-weight="700" fill="${vendorColor(row.id)}">${(row.self * 100).toFixed(1)}%</text>`,
    );
    // overlay cross-rate label inside the cross segment if wide enough
    const crossX = x0 + row.self * barW;
    const crossW = row.cross * barW;
    if (crossW > 42) {
      parts.push(
        `<text x="${r2(crossX + crossW / 2)}" y="${y + rowH / 2}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="700" fill="#ffffff">${(row.cross * 100).toFixed(0)}%</text>`,
      );
    }
    const refX = x0 + (row.self + row.cross) * barW;
    const refW = row.refused * barW;
    if (refW > 42) {
      parts.push(
        `<text x="${r2(refX + refW / 2)}" y="${y + rowH / 2}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="700" fill="#ffffff">${(row.refused * 100).toFixed(0)}%</text>`,
      );
    }
  });

  // Legend
  const ly = padTop + rows.length * (rowH + gap) + 28;
  const legend: [string, string][] = [
    ["自指 self (claims its own vendor)", "#3b6fb0"],
    ["跨厂混淆 cross-vendor", SEG.cross],
    ["拒答 refused", SEG.refused],
    ["无身份 unknown", SEG.unknown],
  ];
  let lx = padX;
  for (const [text, color] of legend) {
    parts.push(`<rect x="${lx}" y="${ly - 12}" width="16" height="16" fill="${color}" rx="2"/>`);
    parts.push(`<text x="${lx + 22}" y="${ly}" font-size="14" fill="#374151">${esc(text)}</text>`);
    lx += 46 + text.length * 7.6;
  }

  const svg = svgRoot(width, height, parts.join("\n"));
  fs.mkdirSync(FIG_DIR, { recursive: true });
  writeSvg(svg, "fig_vendor_bars.svg");
  writePng(svg, "fig_vendor_bars.png", width * 2);
}

main();
