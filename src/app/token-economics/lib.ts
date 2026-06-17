// Shared formatters + the brutalist palette for the Token Economics module.
//
// This route deliberately departs from the site-wide shadcn `radix-nova` theme:
// it replicates the "Alpha Arena by nof1" terminal-brutalist look (cream paper,
// hard black borders, no radius, monospace, green/red status numerals). Rather
// than thread those colors through globals.css (which would leak into /research),
// they live HERE as constants + arbitrary Tailwind classes scoped to this route.

import type { ModelEconomics } from "@research/token-economics/types";
import type { VendorId } from "@research/lib/types";

// ---------------------------------------------------------------------------
// Palette — the nof1 brutalist tokens
// ---------------------------------------------------------------------------

export const INK = "#141414"; // near-black: text + every border
export const PAPER = "#f4f1ea"; // page background (cream)
export const CARD = "#fbf9f4"; // raised surface (slightly lighter cream)
export const MUTED = "#6f6a5f"; // secondary text
export const POS = "#1a8a4a"; // positive / cheap / good (green)
export const NEG = "#cf3636"; // negative / expensive / bad (red)

/**
 * Bar/series palette, cycled by index for the consumption ranking. Lifted from
 * the reference screenshots (pink / emerald / indigo / violet / amber / cyan),
 * which use saturated mid-tones on the cream paper.
 */
export const SERIES = [
  "#ec4899", // pink
  "#10b981", // emerald
  "#4f6ef7", // indigo
  "#9b5de5", // violet
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#ef4444", // red
  "#8b5cf6", // purple
] as const;

/**
 * Stable per-vendor color so a vendor reads as the same hue across every chart
 * (more legible than coloring by rank). Falls back to a hash for unmapped ids.
 */
const VENDOR_COLOR: Record<string, string> = {
  anthropic: "#d97757", // Anthropic clay
  openai: "#10a37f", // OpenAI green
  google: "#4285f4", // Google blue
  deepseek: "#4f6ef7",
  qwen: "#7b3fe4",
  "x-ai": "#111111",
  "z-ai": "#2f6df6",
  moonshot: "#1d1d1f",
  minimax: "#ee4d5f",
  bytedance: "#325ab4",
  baidu: "#2932e1",
  xiaomi: "#ff6900",
  stepfun: "#0a84ff",
  inclusionai: "#3b6fe0",
  kwai: "#ff5000",
  tencent: "#1aad19",
  meta: "#0668e1",
  mistral: "#fa520f",
  agnes: "#8b5cf6",
};

export function vendorColor(vendor: string): string {
  if (VENDOR_COLOR[vendor]) return VENDOR_COLOR[vendor];
  let h = 0;
  for (const c of vendor) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SERIES[h % SERIES.length];
}

/**
 * Canonical vendor id → brand-colored SVG under public/model-logo/.
 *
 * We key off the canonical `vendor` id (from research/lib/vendors.ts), NOT the
 * legacy white-on-transparent PNG filename, so there's a single source of truth
 * and the file name choice (e.g. "chatgpt" vs "openai", "kimi" vs "moonshot")
 * stays explicit here. These SVGs are already in full brand color, so callers
 * must NOT invert them (the old maker-logo PNGs were white and needed invert).
 */
const VENDOR_LOGO_SVG: Partial<Record<VendorId, string>> = {
  anthropic: "claude_color.svg",
  openai: "chatgpt_color.svg",
  google: "gemini_color.svg",
  deepseek: "deepeek_color.svg",
  qwen: "qwen_color.svg",
  baidu: "wenxin_color.svg",
  bytedance: "doubao_color.svg",
  moonshot: "kimi_color.svg",
  "z-ai": "zai_color.svg",
  stepfun: "stepfun_color.svg",
  "x-ai": "grok_color.svg",
  minimax: "minimax_color.svg",
  kwai: "kwai_color.svg",
  xiaomi: "xiaomi_color.svg",
  tencent: "hunyuan_color.svg",
  inclusionai: "inclusionai_color.svg",
  meta: "meta_color.svg",
  mistral: "mistral_color.svg",
  agnes: "sapiens-al_color.svg",
};

/** Brand-colored SVG web path for a vendor, or null if unmapped (pseudo-vendor). */
export function logoPath(vendor: VendorId): string | null {
  const file = VENDOR_LOGO_SVG[vendor];
  return file ? `/model-logo/${file}` : null;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/** $2.2680 / $0.00210 — adaptive precision; tiny values keep more digits. */
export function usd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(5)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

/** Per-1M price label, e.g. "$2.00". */
export function perM(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(n < 1 ? 3 : 2)}`;
}

/** 14_485_890_000 → "14.49B" ; 896_980_000 → "896.98M". */
export function tokens(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return String(Math.round(n));
}

/** Tokens-per-dollar → "209.89B/$" style. */
export function perDollar(n: number | null): string {
  return n == null ? "—" : `${tokens(n)}/$`;
}

/** Listing date "2026-06-15" → "2026-06-15" (ISO is already tabular/mono-friendly). */
export function date(s: string | null): string {
  return s ?? "—";
}

/** Context window like 1_050_000 → "1.05M", 256_000 → "256K". */
export function ctx(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Tailwind class fragments — the repeated brutalist primitives
// ---------------------------------------------------------------------------

/** Hard 1px black border, no radius — the box everything is built from. */
export const BOX = "border border-[#141414] rounded-none";
/** A header/label cell tint band. */
export const BAND = "bg-[#ece8dd]";

/** Green for cheap/good, red for expensive/bad — the status numeral color. */
export function costClass(cost: number, median: number): string {
  return cost <= median ? "text-[#1a8a4a]" : "text-[#cf3636]";
}

// ---------------------------------------------------------------------------
// Sorting helpers shared by the surfaces
// ---------------------------------------------------------------------------

export type SortKey =
  | "blendedCost"
  | "inputPrice"
  | "outputPrice"
  | "usageTokens"
  | "tokensPerDollar"
  | "contextWindow"
  | "publishTime";

export function sortModels(
  models: ModelEconomics[],
  key: SortKey,
  dir: "asc" | "desc",
): ModelEconomics[] {
  // publishTime is an ISO "YYYY-MM-DD" string — lexical order IS chronological,
  // so compare as strings (numeric subtraction would yield NaN). Nulls sink to
  // the bottom regardless of direction by mapping them to "".
  if (key === "publishTime") {
    return [...models].sort((a, b) => {
      const av = a.publishTime ?? "";
      const bv = b.publishTime ?? "";
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return dir === "asc" ? cmp : -cmp;
    });
  }
  const m = [...models].sort((a, b) => {
    const av = (a[key] ?? -Infinity) as number;
    const bv = (b[key] ?? -Infinity) as number;
    return dir === "asc" ? av - bv : bv - av;
  });
  return m;
}
