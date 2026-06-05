// Figure: the manufacturer-level "identity creditor vs. debtor" balance. One
// diverging horizontal bar per tested vendor — the RIGHT (positive) arm is how
// often the vendor is *imitated* (other vendors' models claim to be it), the LEFT
// (negative) arm is how often it *imitates* (its own models claim a different real
// vendor, including one-off `other:<brand>` targets). Rows sort by net = imitated
// − imitates, so the "gravity centers" (Anthropic, OpenAI, Google) rise to the top
// and the heaviest imitators (Tencent, Doubao/ByteDance, z-ai) sink to the bottom.
//
// This is the paper twin of the web Data Explorer's ImitationBalanceCard, and the
// single clearest picture of the study's headline: confusion is directional.
//
// Run:  npx tsx paper/scripts/fig_imitation_balance.ts

import fs from "node:fs";
import path from "node:path";
import { esc, FIG_DIR, L, loadGraph, r2, svgRoot, vendorColor, vendorNames, writePng, writeSvg } from "./figlib";

interface Stats {
  imitationBalance: { vendor: string; imitated: number; imitates: number; net: number }[];
}

const IMITATED = "#2f6fb0"; // calm blue — "others look up to you" (right / positive)
const IMITATES = "#c0392b"; // confusion red — "you borrow an identity" (left / negative)

function main() {
  const g = loadGraph();
  const names = vendorNames(g);
  const stats = JSON.parse(fs.readFileSync(path.join(FIG_DIR, "stats.json"), "utf8")) as Stats;

  // Keep vendors that participate in cross-vendor flow at all (drop pure zeros so
  // the chart isn't padded with flat rows that say nothing).
  const rows = stats.imitationBalance.filter((r) => r.imitated > 0 || r.imitates > 0);

  // Symmetric scale: the longest single arm sets the half-width, so + and − are
  // directly comparable across rows.
  const maxArm = Math.max(1, ...rows.map((r) => Math.max(r.imitated, r.imitates)));

  // Layout
  const rowH = 40;
  const gap = 12;
  const labelW = 150; // vendor name gutter (left of the diverging axis)
  const halfW = 360; // each arm's max pixel length
  const valW = 70; // net-value gutter (right)
  const padX = 40;
  const padTop = 116;
  const padBottom = 96;
  const axisX = padX + labelW + halfW; // the zero line
  const width = padX * 2 + labelW + halfW * 2 + valW;
  const height = padTop + rows.length * (rowH + gap) + padBottom;

  const parts: string[] = [];
  parts.push(`<text x="${padX}" y="46" font-size="30" font-weight="700" fill="#16161a">${esc(L("谁被模仿，谁在模仿", "Who imitates whom"))}</text>`);
  parts.push(
    `<text x="${padX}" y="76" font-size="16" fill="#6b7280">${esc(L("Identity creditors vs. debtors · 厂商被冒认（右）与冒认他人（左）· 按净值排序", "Identity creditors vs. debtors · imitated (right) vs. imitates others (left) · sorted by net"))}</text>`,
  );

  // Axis line + side captions
  const plotTop = padTop - 10;
  const plotBot = padTop + rows.length * (rowH + gap) - gap + 10;
  parts.push(`<line x1="${axisX}" y1="${plotTop}" x2="${axisX}" y2="${plotBot}" stroke="#9aa0a6" stroke-width="1.5"/>`);
  parts.push(
    `<text x="${axisX - 8}" y="${padTop - 22}" text-anchor="end" font-size="14" font-weight="700" fill="${IMITATES}">${esc(L("◀ 冒认他人 imitates", "◀ imitates others"))}</text>`,
  );
  parts.push(
    `<text x="${axisX + 8}" y="${padTop - 22}" text-anchor="start" font-size="14" font-weight="700" fill="${IMITATED}">${esc(L("被冒认 imitated ▶", "imitated ▶"))}</text>`,
  );

  rows.forEach((row, i) => {
    const y = padTop + i * (rowH + gap);
    const cy = y + rowH / 2;
    const color = vendorColor(row.vendor);

    // vendor name (left gutter, its own brand ink so the row is identifiable)
    parts.push(
      `<text x="${padX + labelW - 14}" y="${r2(cy)}" text-anchor="end" dominant-baseline="middle" font-size="16" font-weight="600" fill="${color}">${esc(names[row.vendor] ?? row.vendor)}</text>`,
    );

    // left arm: imitates (red), grows leftward from the axis. The count sits just
    // INSIDE the bar near the axis (white), so even a near-full-width bar like
    // Tencent's never collides with the vendor-name gutter on the far left.
    const lW = (row.imitates / maxArm) * halfW;
    if (lW > 0.5) {
      parts.push(`<rect x="${r2(axisX - lW)}" y="${y + 6}" width="${r2(lW)}" height="${rowH - 12}" fill="${IMITATES}" rx="2"/>`);
      if (lW > 26) {
        parts.push(
          `<text x="${r2(axisX - 8)}" y="${r2(cy)}" text-anchor="end" dominant-baseline="middle" font-size="13" font-weight="700" fill="#ffffff">${row.imitates}</text>`,
        );
      } else {
        parts.push(
          `<text x="${r2(axisX - lW - 8)}" y="${r2(cy)}" text-anchor="end" dominant-baseline="middle" font-size="13" font-weight="700" fill="${IMITATES}">${row.imitates}</text>`,
        );
      }
    }
    // right arm: imitated (blue), grows rightward from the axis
    const rW = (row.imitated / maxArm) * halfW;
    if (rW > 0.5) {
      parts.push(`<rect x="${axisX}" y="${y + 6}" width="${r2(rW)}" height="${rowH - 12}" fill="${IMITATED}" rx="2"/>`);
      if (rW > 30) {
        parts.push(
          `<text x="${r2(axisX + rW + 8)}" y="${r2(cy)}" dominant-baseline="middle" font-size="13" font-weight="700" fill="${IMITATED}">${row.imitated}</text>`,
        );
      }
    }

    // net value at the far right, signed and colored by sign
    const netColor = row.net >= 0 ? IMITATED : IMITATES;
    const netStr = row.net > 0 ? `+${row.net}` : `${row.net}`;
    parts.push(
      `<text x="${r2(width - padX)}" y="${r2(cy)}" text-anchor="end" dominant-baseline="middle" font-size="15" font-weight="700" fill="${netColor}">${netStr}</text>`,
    );
  });

  // footer note + legend
  const ly = padTop + rows.length * (rowH + gap) + 48;
  parts.push(
    `<text x="${padX}" y="${ly}" font-size="13" fill="#6b7280">${esc(L("净值 net = 被冒认次数 − 冒认他人次数；正=身份“被借用”的引力中心，负=频繁借用他人身份。", "net = times imitated − times imitating others; positive = a gravity center whose identity is “borrowed”, negative = a frequent borrower."))}</text>`,
  );
  parts.push(
    `<text x="${padX}" y="${ly + 22}" font-size="13" fill="#9ca3af">${esc(L("“冒认他人”含被提取器记为 other 的外部品牌（如 Microsoft、Yandex）；仅真实厂商可作为“被冒认”目标。", "“imitates others” includes external brands the extractor logged as other (e.g. Microsoft, Yandex); only real tested vendors can be an “imitated” target."))}</text>`,
  );

  const svg = svgRoot(width, height, parts.join("\n"));
  fs.mkdirSync(FIG_DIR, { recursive: true });
  writeSvg(svg, "fig_imitation_balance.svg");
  writePng(svg, "fig_imitation_balance.png", width * 2);
}

main();
