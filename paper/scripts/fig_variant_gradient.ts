// Figure: the stimulus-variant gradient. Three grouped stacked bars (bare /
// probed / debrand), each showing self / cross / refused / unknown composition.
// This is the paper's central causal-ish result: as the prompt pushes harder on
// "true underlying identity", self-report drops and cross-vendor + refusal rise.
//
// Run:  npx tsx paper/scripts/fig_variant_gradient.ts

import fs from "node:fs";
import path from "node:path";
import { esc, FIG_DIR, L, LANG, r2, svgRoot, writePng, writeSvg } from "./figlib";

interface Stats {
  byVariant: Record<string, { n: number; self: number; cross: number; refused: number; unknown: number }>;
}

const COL = { self: "#2f6fb0", cross: "#c0392b", refused: "#9aa0a6", unknown: "#d8dbe0" };

// The group label printed under each bar. In the Chinese build it is a two-line
// pair (Chinese title + English subtitle); in the English build we collapse to a
// single English title and a one-word subtitle so the bar group stays uncluttered.
const VARIANTS: { key: string; zh: string; en: string; enSub: string }[] = [
  { key: "bare", zh: "变体一 · 裸问", en: "V1 · Bare", enSub: "“Who are you?”" },
  { key: "probed", zh: "变体二 · 追问", en: "V2 · Probed", enSub: "name model + maker" },
  { key: "debrand", zh: "变体三 · 去品牌越狱", en: "V3 · De-brand", enSub: "jailbreak" },
];

function main() {
  const stats = JSON.parse(fs.readFileSync(path.join(FIG_DIR, "stats.json"), "utf8")) as Stats;

  const width = 900;
  const height = 540;
  const padL = 70;
  const padR = 40;
  const padTop = 110;
  const plotH = 300;
  const baseY = padTop + plotH;
  const groupW = (width - padL - padR) / VARIANTS.length;
  const barW = 150;

  const parts: string[] = [];
  parts.push(`<text x="${padL}" y="46" font-size="30" font-weight="700" fill="#16161a">${esc(L("提问变体的身份梯度", "Identity gradient across stimulus variants"))}</text>`);
  parts.push(
    `<text x="${padL}" y="76" font-size="16" fill="#6b7280">${esc(L("Outcome composition by stimulus variant · 提问越强，自指越低、混淆与拒答越高", "Outcome composition by stimulus variant · harder prompt → lower self-ID, higher confusion + refusal"))}</text>`,
  );

  // y gridlines (0,25,50,75,100%)
  for (let p = 0; p <= 100; p += 25) {
    const y = baseY - (p / 100) * plotH;
    parts.push(`<line x1="${padL}" y1="${r2(y)}" x2="${width - padR}" y2="${r2(y)}" stroke="#e5e7eb" stroke-width="1"/>`);
    parts.push(`<text x="${padL - 12}" y="${r2(y + 4)}" text-anchor="end" font-size="13" fill="#9ca3af">${p}%</text>`);
  }

  VARIANTS.forEach((v, i) => {
    const r = stats.byVariant[v.key];
    const cx = padL + i * groupW + groupW / 2;
    const x = cx - barW / 2;
    let yTop = baseY;
    const segs: [number, string, string][] = [
      [r.self, COL.self, "self"],
      [r.cross, COL.cross, "cross"],
      [r.refused, COL.refused, "refused"],
      [r.unknown, COL.unknown, "unknown"],
    ];
    for (const [frac, color, name] of segs) {
      const h = frac * plotH;
      if (h > 0.5) {
        parts.push(`<rect x="${r2(x)}" y="${r2(yTop - h)}" width="${barW}" height="${r2(h)}" fill="${color}"/>`);
        if (h > 22) {
          const label = `${(frac * 100).toFixed(1)}%`;
          const textColor = name === "unknown" ? "#374151" : "#ffffff";
          parts.push(
            `<text x="${r2(cx)}" y="${r2(yTop - h / 2 + 5)}" text-anchor="middle" font-size="15" font-weight="700" fill="${textColor}">${label}</text>`,
          );
        }
      }
      yTop -= h;
    }
    // group label (title line + subtitle line, language-forked)
    parts.push(`<text x="${r2(cx)}" y="${baseY + 28}" text-anchor="middle" font-size="17" font-weight="700" fill="#16161a">${esc(L(v.zh, v.en))}</text>`);
    parts.push(`<text x="${r2(cx)}" y="${baseY + 50}" text-anchor="middle" font-size="13" fill="#6b7280">${esc(L(v.en, v.enSub))}</text>`);
    parts.push(`<text x="${r2(cx)}" y="${baseY + 70}" text-anchor="middle" font-size="12" fill="#9ca3af">n = ${r.n}</text>`);
  });

  // legend
  const ly = height - 24;
  const legend: [string, string][] = [
    [L("自指 self", "self"), COL.self],
    [L("跨厂混淆 cross", "cross-vendor"), COL.cross],
    [L("拒答 refused", "refused"), COL.refused],
    [L("无身份 unknown", "unknown"), COL.unknown],
  ];
  let lx = padL;
  for (const [t, c] of legend) {
    parts.push(`<rect x="${lx}" y="${ly - 12}" width="15" height="15" fill="${c}" rx="2"/>`);
    parts.push(`<text x="${lx + 21}" y="${ly}" font-size="14" fill="#374151">${esc(t)}</text>`);
    // Per-entry advance. ZH formula kept verbatim from the original (CJK + Latin
    // mix); EN uses a tighter all-Latin estimate so the row doesn't sprawl.
    lx += LANG === "en" ? 30 + t.length * 8 : 60 + t.length * 9;
  }

  const svg = svgRoot(width, height, parts.join("\n"));
  writeSvg(svg, "fig_variant_gradient.svg");
  writePng(svg, "fig_variant_gradient.png", width * 2);
}

main();
