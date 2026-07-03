// Token Deals — local formatters, the deal-specific money math, and the
// scoreboard band theming (vendor brand color → readable ink, worldcup-style).
//
// Generic formatters + the vendor SVG logo path are re-exported from the
// token-economics lib (read-only import: that module must not be modified;
// importing shares the tokens without touching it). Everything deal-specific
// (discount semantics, subsidy rate, outbound links) lives here so the whole
// "what does 0.31 mean" question has exactly one home.

import type { VendorId } from "@research/lib/types";
import { vendorColor } from "../token-economics/lib";

export { usd, perM, tokens, logoPath, vendorColor } from "../token-economics/lib";

// ---------------------------------------------------------------------------
// Discount semantics — pricing_discount is the USER-PAYS fraction
// (0.31 = you pay 31%, ZenMux covers 69%). Confirmed direction per PRD §2.3.
// ---------------------------------------------------------------------------

/** `x0.31` — the mono discount factor figure. */
export function discountFactor(d: number): string {
  return `x${d.toFixed(2)}`;
}

/** Subsidy rate `69%`. Guards the 0.99x edge: a real-but-tiny subsidy must
    show `<1%`, never a lying `0%` (PRD §7 boundary case). */
export function subsidyPct(d: number): string {
  const rate = (1 - d) * 100;
  if (rate <= 0) return "0%";
  if (rate < 1) return "<1%";
  return `${Math.round(rate)}%`;
}

/** Inline off-label: `69% OFF` (free deals render "FREE" instead). The board
    bands render the number and the OFF word separately for the poster scale. */
export function percentOff(d: number): string {
  return `${subsidyPct(d)} OFF`;
}

/** Deep deals (≤ x0.5) get the loud treatment; shallow ones stay quiet —
    all shown, only the emphasis is thresholded (PRD rule 6). */
export function isDeepDiscount(d: number): boolean {
  return d <= 0.5;
}

// ---------------------------------------------------------------------------
// Band theming — vendor brand color as a full-bleed background, with ink
// picked by relative luminance (dark brands get pale tinted type, light
// brands get deep tinted type — the worldcup flag-band treatment).
// ---------------------------------------------------------------------------

export interface BandTheme {
  /** Band background — the vendor's brand color, verbatim. */
  bg: string;
  /** Headline ink: a deep/pale shade of the SAME hue, high contrast. */
  title: string;
  /** Secondary ink for meta lines (translucent black/white). */
  meta: string;
  /** Whether the band reads as light (drives neutral overlays). */
  isLight: boolean;
}

function hexChannel(hex: string, i: number): number {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
}

function relLuminance(hex: string): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * lin(hexChannel(hex, 0)) +
    0.7152 * lin(hexChannel(hex, 1)) +
    0.0722 * lin(hexChannel(hex, 2))
  );
}

/** Mix `hex` toward pure black (t<0) or pure white (t>0) by |t|. */
function shade(hex: string, t: number): string {
  const target = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  const mixed = [0, 1, 2].map((i) =>
    Math.round(hexChannel(hex, i) * (1 - k) + target * k),
  );
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function bandTheme(vendor: VendorId | string): BandTheme {
  const bg = vendorColor(vendor);
  const isLight = relLuminance(bg) > 0.4;
  return isLight
    ? { bg, title: shade(bg, -0.68), meta: "rgba(0,0,0,0.62)", isLight }
    : { bg, title: shade(bg, 0.82), meta: "rgba(255,255,255,0.72)", isLight };
}

// ---------------------------------------------------------------------------
// Money / token formatting for the ledger surfaces
// ---------------------------------------------------------------------------

/** Hero + band money: full grouped dollars ("$1,284,530"), because the whole
    point of the page is a big believable number, not an abbreviation. Small
    amounts keep cents so a young deal doesn't flatten to "$0". */
export function usdGrouped(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (Math.abs(n) < 1) return `$${n.toFixed(4)}`;
  if (Math.abs(n) < 100) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** Compact money for chart axis ticks / bar labels ("$27.9K", "$1.28M"). */
export function usdCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  if (n === 0) return "$0";
  return `$${n.toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// Outbound links — every model mention funnels to the main site (rule 8)
// ---------------------------------------------------------------------------

/** Model detail page + UTM attribution. Null for delisted models: the band
    stays (the ledger is complete), only the funnel link is dropped. */
export function dealHref(slug: string, delisted: boolean): string | null {
  if (delisted) return null;
  return `https://zenmux.ai/${slug}?utm_source=arena&utm_medium=token-deals&utm_content=${encodeURIComponent(slug)}`;
}

/** "2026-06-22" → "Jun 22, 2026" for since/range lines. */
export function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
