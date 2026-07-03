// Token Deals（让利账本）— local formatters + the deal-specific money math.
//
// The base palette / generic formatters are re-exported from the
// token-economics lib (read-only import: the PRD mandates identical visuals and
// forbids MODIFYING that module — importing shares the tokens without touching
// it). Everything deal-specific (discount semantics, subsidy rate, outbound
// links) lives here so the whole "what does 0.31 mean" question has exactly one
// home — if the backend ever flips the pricing_discount semantics, this file is
// the only place to update (PRD §9 risk table).

export {
  INK,
  PAPER,
  CARD,
  MUTED,
  POS,
  NEG,
  BOX,
  BAND,
  usd,
  perM,
  tokens,
  logoPath,
} from "../token-economics/lib";

// ---------------------------------------------------------------------------
// Discount semantics — pricing_discount is the USER-PAYS fraction
// (0.31 = you pay 31%, ZenMux covers 69%). Confirmed direction per PRD §2.3.
// ---------------------------------------------------------------------------

/** `x0.31` — the mono discount badge figure. */
export function discountFactor(d: number): string {
  return `x${d.toFixed(2)}`;
}

/** `3.1 折` — the Chinese-habit reading (payment fraction × 10). */
export function discountZhe(d: number): string {
  const zhe = d * 10;
  const text = zhe.toFixed(1).replace(/\.0$/, "");
  return `${text} 折`;
}

/** Subsidy rate `69%`. Guards the 0.99x edge: a real-but-tiny subsidy must
    show `<1%`, never a lying `0%` (PRD §7 boundary case). */
export function subsidyPct(d: number): string {
  const rate = (1 - d) * 100;
  if (rate <= 0) return "0%";
  if (rate < 1) return "<1%";
  return `${Math.round(rate)}%`;
}

/** Deep deals (≤ x0.5) get the loud green treatment; shallow ones stay ink —
    all shown, only the emphasis is thresholded (PRD rule 6). */
export function isDeepDiscount(d: number): boolean {
  return d <= 0.5;
}

// ---------------------------------------------------------------------------
// Money / token formatting for the ledger surfaces
// ---------------------------------------------------------------------------

/** Hero + card money: full grouped dollars ("$1,284,530"), because the whole
    point of the page is a big believable number, not an abbreviation. Small
    amounts keep cents so a young deal doesn't flatten to "$0". */
export function usdGrouped(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (Math.abs(n) < 1) return `$${n.toFixed(4)}`;
  if (Math.abs(n) < 100) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** Compact money for chart axis ticks / tooltips ("$27.9K", "$1.28M"). */
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

/** Model detail page + UTM attribution. Null for delisted models: the card
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
