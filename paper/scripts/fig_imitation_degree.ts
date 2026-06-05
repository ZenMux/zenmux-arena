// Figure: the manufacturer-level imitation balance, BINARIZED to edge degree.
// Companion to fig_imitation_balance — same diverging-bar idiom, but instead of
// "how many times" it counts "how many DISTINCT vendors". Every (from→to) pair
// that occurs at least once is one edge, regardless of how often it fired. This is
// literally "count the arrows in the relationship graph": a vendor's right (blue)
// arm = its IN-degree (how many distinct vendors ever claimed to be it); its left
// (red) arm = its OUT-degree (how many distinct real vendors it ever claimed to
// be). Restricted to canonical real↔real ring edges (no `other:*` phantoms).
//
// Why both charts: volume says "how LOUD" (Tencent→Anthropic 321×), degree says
// "how SCATTERED" (Tencent wore 13 different identities). A vendor can be a heavy
// imitator through one giant edge, or through many small ones — only the degree
// view distinguishes them.
//
// Run:  npx tsx paper/scripts/fig_imitation_degree.ts

import fs from "node:fs";
import path from "node:path";
import { esc, FIG_DIR, loadGraph, r2, svgRoot, vendorColor, vendorNames, writePng, writeSvg } from "./figlib";

interface Stats {
  imitationDegree: { vendor: string; inDeg: number; outDeg: number; net: number }[];
}

const IN_DEG = "#2f6fb0"; // blue — distinct vendors that point AT you (in-degree)
const OUT_DEG = "#c0392b"; // red — distinct vendors YOU point at (out-degree)

function main() {
  const g = loadGraph();
  const names = vendorNames(g);
  const stats = JSON.parse(fs.readFileSync(path.join(FIG_DIR, "stats.json"), "utf8")) as Stats;

  const rows = stats.imitationDegree.filter((r) => r.inDeg > 0 || r.outDeg > 0);
  const maxArm = Math.max(1, ...rows.map((r) => Math.max(r.inDeg, r.outDeg)));

  // Layout — integer arms are small, so a tick grid keeps them legible.
  const rowH = 38;
  const gap = 12;
  const labelW = 150;
  const halfW = 320;
  const valW = 64;
  const padX = 40;
  const padTop = 120;
  const padBottom = 86;
  const axisX = padX + labelW + halfW;
  const width = padX * 2 + labelW + halfW * 2 + valW;
  const height = padTop + rows.length * (rowH + gap) + padBottom;

  const parts: string[] = [];
  parts.push(`<text x="${padX}" y="46" font-size="30" font-weight="700" fill="#16161a">关系图里的入边与出边</text>`);
  parts.push(
    `<text x="${padX}" y="76" font-size="16" fill="#6b7280">In- vs. out-degree · 数关系图里的箭头：不论冒认多少次，每对厂商只记 1 条边 · 按净边数排序</text>`,
  );

  const plotTop = padTop - 10;
  const plotBot = padTop + rows.length * (rowH + gap) - gap + 10;

  // integer tick grid (every 2 edges), behind the bars
  const ticks = Math.ceil(maxArm / 2) * 2;
  for (let t = 0; t <= ticks; t += 2) {
    const dx = (t / maxArm) * halfW;
    for (const sx of [axisX - dx, axisX + dx]) {
      if (t === 0 && sx === axisX) continue;
      parts.push(`<line x1="${r2(sx)}" y1="${plotTop}" x2="${r2(sx)}" y2="${plotBot}" stroke="#f0f1f3" stroke-width="1"/>`);
      parts.push(`<text x="${r2(sx)}" y="${plotTop - 6}" text-anchor="middle" font-size="10.5" fill="#b8bdc4">${t}</text>`);
    }
  }

  parts.push(`<line x1="${axisX}" y1="${plotTop}" x2="${axisX}" y2="${plotBot}" stroke="#9aa0a6" stroke-width="1.5"/>`);
  parts.push(
    `<text x="${axisX - 8}" y="${padTop - 26}" text-anchor="end" font-size="14" font-weight="700" fill="${OUT_DEG}">◀ 出边 出度 out-degree</text>`,
  );
  parts.push(
    `<text x="${axisX + 8}" y="${padTop - 26}" text-anchor="start" font-size="14" font-weight="700" fill="${IN_DEG}">入边 入度 in-degree ▶</text>`,
  );

  rows.forEach((row, i) => {
    const y = padTop + i * (rowH + gap);
    const cy = y + rowH / 2;
    const color = vendorColor(row.vendor);

    parts.push(
      `<text x="${padX + labelW - 14}" y="${r2(cy)}" text-anchor="end" dominant-baseline="middle" font-size="16" font-weight="600" fill="${color}">${esc(names[row.vendor] ?? row.vendor)}</text>`,
    );

    // left arm: out-degree
    const lW = (row.outDeg / maxArm) * halfW;
    if (lW > 0.5) {
      parts.push(`<rect x="${r2(axisX - lW)}" y="${y + 6}" width="${r2(lW)}" height="${rowH - 12}" fill="${OUT_DEG}" rx="2"/>`);
      if (lW > 22) {
        parts.push(
          `<text x="${r2(axisX - 8)}" y="${r2(cy)}" text-anchor="end" dominant-baseline="middle" font-size="13" font-weight="700" fill="#ffffff">${row.outDeg}</text>`,
        );
      } else {
        parts.push(
          `<text x="${r2(axisX - lW - 7)}" y="${r2(cy)}" text-anchor="end" dominant-baseline="middle" font-size="13" font-weight="700" fill="${OUT_DEG}">${row.outDeg}</text>`,
        );
      }
    }
    // right arm: in-degree
    const rW = (row.inDeg / maxArm) * halfW;
    if (rW > 0.5) {
      parts.push(`<rect x="${axisX}" y="${y + 6}" width="${r2(rW)}" height="${rowH - 12}" fill="${IN_DEG}" rx="2"/>`);
      if (rW > 22) {
        parts.push(
          `<text x="${r2(axisX + 8)}" y="${r2(cy)}" dominant-baseline="middle" font-size="13" font-weight="700" fill="#ffffff">${row.inDeg}</text>`,
        );
      } else {
        parts.push(
          `<text x="${r2(axisX + rW + 7)}" y="${r2(cy)}" dominant-baseline="middle" font-size="13" font-weight="700" fill="${IN_DEG}">${row.inDeg}</text>`,
        );
      }
    }

    // net value
    const netColor = row.net >= 0 ? IN_DEG : OUT_DEG;
    const netStr = row.net > 0 ? `+${row.net}` : `${row.net}`;
    parts.push(
      `<text x="${r2(width - padX)}" y="${r2(cy)}" text-anchor="end" dominant-baseline="middle" font-size="15" font-weight="700" fill="${netColor}">${netStr}</text>`,
    );
  });

  const ly = padTop + rows.length * (rowH + gap) + 34;
  parts.push(
    `<text x="${padX}" y="${ly}" font-size="13" fill="#6b7280">入度 = 有多少个不同厂商曾自称为它；出度 = 它的模型曾自称为多少个不同的真实厂商。每对厂商至多计 1 条边。</text>`,
  );
  parts.push(
    `<text x="${padX}" y="${ly + 22}" font-size="13" fill="#9ca3af">仅统计关系图中的规范厂商节点之间的有向边（不含被记为 other 的一次性外部品牌）。与上一张“按次数”图对照：次数看“多响”，边数看“多散”。</text>`,
  );

  const svg = svgRoot(width, height, parts.join("\n"));
  fs.mkdirSync(FIG_DIR, { recursive: true });
  writeSvg(svg, "fig_imitation_degree.svg");
  writePng(svg, "fig_imitation_degree.png", width * 2);
}

main();
