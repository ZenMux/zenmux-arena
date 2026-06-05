// Shared helpers for the paper's figure scripts.
//
// These reuse the EXACT rendering primitives the live web export uses
// (research/lib/{geometry,vendors,svg}.ts) so the paper figures share the
// study's visual language — vendor colors, logos, CJK font — and regenerate
// deterministically from a single aggregate.json. Each chart is hand-built SVG
// (same idiom as svg.ts), then rasterized to PNG via @resvg/resvg-js with the
// repo's bundled Noto Sans SC font (same as src/app/api/export/route.ts).

import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { vendorColor } from "../../research/lib/geometry";
import type { GraphData } from "../../research/lib/types";

export const REPO_ROOT = path.resolve(__dirname, "..", "..");
export const AGG_PATH = path.join(
  REPO_ROOT,
  "results/who-are-you/mix-20260601T062425/aggregate.json",
);
export const RECORDS_PATH = path.join(
  REPO_ROOT,
  "results/who-are-you/mix-20260601T062425/records.jsonl",
);
export const EXTRACTIONS_PATH = path.join(
  REPO_ROOT,
  "results/who-are-you/mix-20260601T062425/extractions.jsonl",
);
export const FONT_PATH = path.join(REPO_ROOT, "research/assets/NotoSansSC-Regular.otf");

// `stats.json` is ALWAYS read/written here — it is language-independent (pure
// numbers + vendor/lang codes), so both the Chinese and English builds share the
// one canonical copy and no statistic can drift between the two language editions.
export const FIG_DIR = path.join(REPO_ROOT, "paper/figures");

// ---- Language fork (PAPER_LANG=en for the English edition) ------------------
// The Chinese build (default) renders figures into paper/figures/; the English
// build renders the SAME charts — same geometry, same data — into paper/figures_en/
// with every label translated. Only the rendering layer is language-aware; the
// stats layer above is not. `gen_tables.ts` mirrors this into tables/ vs tables_en/.
export type PaperLang = "zh" | "en";
export const LANG: PaperLang = process.env.PAPER_LANG === "en" ? "en" : "zh";

/** Pick the language-appropriate string: `L("中文", "English")`. */
export function L(zh: string, en: string): string {
  return LANG === "en" ? en : zh;
}

/** Where rendered figures (PNG/SVG) go — forked by language; stats.json stays in FIG_DIR. */
export const OUT_DIR = LANG === "en" ? path.join(REPO_ROOT, "paper/figures_en") : FIG_DIR;

// English display names for the 10 study languages, keyed by ISO code. The Chinese
// build prints native names (简体中文 / 日本語 / …) straight from the aggregate; the
// English build uses these instead so a heatmap column or a fragility sublabel reads
// naturally for an English audience. Figures are rasterized with Noto Sans SC (full
// Latin coverage), so these never tofu.
export const LANG_EN: Record<string, string> = {
  en: "English",
  "zh-Hans": "Chinese (Simpl.)",
  "zh-Hant": "Chinese (Trad.)",
  ja: "Japanese",
  ko: "Korean",
  ru: "Russian",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
};

export function loadGraph(): GraphData {
  return JSON.parse(fs.readFileSync(AGG_PATH, "utf8")) as GraphData;
}

/** Vendor id -> human display name, from the aggregate's vendor registry. */
export function vendorNames(g: GraphData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of g.vendors) out[v.id] = v.name;
  return out;
}

/**
 * Model id -> short label. The mix's merged study.yaml drops the friendly
 * `label` field, so aggregate.json falls back to using the raw id as the label.
 * Prefer the labels from the LIVE config/study.yaml (which keeps them), and fall
 * back to the aggregate's value only for ids the live config no longer lists.
 */
export function modelLabels(g: GraphData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of g.models) out[m.id] = m.label ?? m.id; // aggregate fallback
  try {
    const raw = fs.readFileSync(path.join(REPO_ROOT, "config/study.yaml"), "utf8");
    const cfg = parseYaml(raw) as { models?: { id: string; label?: string }[] };
    for (const m of cfg.models ?? []) {
      if (m.label) out[m.id] = m.label;
    }
  } catch {
    /* live config unreadable — keep aggregate labels */
  }
  return out;
}

/** Model id -> ground-truth vendor. */
export function modelVendors(g: GraphData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of g.models) out[m.id] = m.vendor;
  return out;
}

export { vendorColor };

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Map a 0..1 value to a sequential warm "confusion" color (white -> deep red). */
export function heatColor(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  // Interpolate white (#ffffff) -> brand red (#c0392b) through an orange midpoint.
  const stops: [number, [number, number, number]][] = [
    [0.0, [255, 255, 255]],
    [0.25, [254, 235, 200]],
    [0.5, [253, 187, 132]],
    [0.75, [227, 108, 60]],
    [1.0, [165, 30, 25]],
  ];
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (x >= stops[i][0] && x <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0] || 1;
  const f = (x - lo[0]) / span;
  const c = [0, 1, 2].map((k) => Math.round(lo[1][k] + f * (hi[1][k] - lo[1][k])));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Wrap an SVG body string with the standard root element + white background. */
export function svgRoot(width: number, height: number, body: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Noto Sans SC, Helvetica, Arial, sans-serif">`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    body,
    `</svg>`,
  ].join("\n");
}

/** Rasterize an SVG string to a PNG file under the active OUT_DIR, at the given pixel width. */
export function writePng(svg: string, filename: string, pxWidth: number): void {
  const fontFiles = fs.existsSync(FONT_PATH) ? [FONT_PATH] : [];
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: pxWidth },
    font: { fontFiles, loadSystemFonts: true, defaultFontFamily: "Noto Sans SC" },
    background: "#ffffff",
  });
  const png = resvg.render().asPng();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, filename);
  fs.writeFileSync(out, png);
  console.log(`  wrote ${path.relative(REPO_ROOT, out)} (${(png.length / 1024).toFixed(0)} KB)`);
}

/** Also drop the raw SVG next to the PNG (vector copy, handy for the studio look). */
export function writeSvg(svg: string, filename: string): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, filename);
  fs.writeFileSync(out, svg, "utf8");
  console.log(`  wrote ${path.relative(REPO_ROOT, out)}`);
}
