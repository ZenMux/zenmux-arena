// Token Deals（让利账本）— pure types, constants, and date math.
//
// CLIENT-SAFE ON PURPOSE: this module must import nothing with a Node.js
// runtime footprint (fs, mysql, the vendors registry…), because the client
// components under src/app/token-deals/ import their wire types and range
// constants from here. Everything that touches the DB (deal discovery, usage
// aggregation) lives in ./discovery.ts and ./query.ts.

import type { VendorId } from "@research/lib/types";

/** Payload schema version. Bumped when the money口径 or deal shape changes so
    an old packaged baseline is never incrementally extended with mismatched
    semantics. v2: deals discovered from model_discount/model tables, SAVED =
    Σ valid_usage.discount_amount. v3: subscription traffic included (origin ×
    same-period per-provider factor), PAYG/subscription split carried on every
    point, prices from the public models API instead of a config file. v4: deal
    facts come from the human-curated config/token-deals.json roster, the
    ledger window opens at ZenMux's launch (2025-09-29), and free models carry
    a manual `online` flag. */
export const DEALS_SCHEMA_VERSION = 4;

export type DealType = "discount" | "free";

/** Per-provider discount detail (one model may run different factors across
    providers, e.g. MiMo-V2.5 at x0.34 on KingsoftCloud vs x0.93 on Xiaomi). */
export interface DealProvider {
  slug: string;
  name: string;
  /** User-pays fraction on this provider. */
  discount: number;
}

/** One deal period, discovered from the billing DB (model_discount + model
    tables) and enriched with optional display prices from the overlay file. */
export interface DealPeriod {
  /** Stable id: `<slug>@<startDate>` — unique because windows can't overlap. */
  id: string;
  /** "discount" = model_discount row(s); "free" = a `-free` suffixed model
      (100% off — usually absent from model_discount, discovered from `model`). */
  dealType: DealType;
  model: string;
  slug: string;
  vendor: VendorId;
  vendorName: string;
  /** User-pays fraction, e.g. 0.31 = pay 31% (3.1 折). 0 for free models.
      When providers disagree this is the deepest (minimum) factor. */
  discount: number;
  /** Per-provider factors backing `discount`. Empty for free models. */
  providers: DealProvider[];
  /** Net (post-discount) $/1M display prices from the public models API
      (prompt/completion); null when the model isn't listed there (the card
      hides the price ledger). Free models get 0/0. The money math never uses
      these — SAVED comes from the DB. */
  netInput: number | null;
  netOutput: number | null;
  /** List (pre-discount) $/1M display prices: net ÷ the SHALLOWEST provider
      factor (the API's net price reflects the display endpoint, which carries
      the shallowest discount). For free models these come from the paid
      sibling model (slug minus `-free`); null when unknown. */
  origInput: number | null;
  origOutput: number | null;
  /** UTC date window. endDate null = still running. */
  startDate: string; // YYYY-MM-DD, inclusive (00:00 UTC)
  endDate: string | null; // YYYY-MM-DD, inclusive (window closes at endDate 24:00 UTC)
  /** Model listing date from the `model` table (publish_time, YYYY-MM-DD);
      null when unknown (or on legacy packaged baselines). Display-only. */
  publishTime: string | null;
  /** Model hidden or removed on the main site — keep the card, drop the link. */
  delisted: boolean;
  /** Free models only: manually maintained "claimable right now" flag from the
      config roster. false forces the deal to read as ended (the stats window
      stays open — usage simply goes to zero after the model is pulled).
      Absent/true for discount deals and legacy baselines. */
  online?: boolean;
}

export type DealStatus = "scheduled" | "active" | "ended";

// ---------------------------------------------------------------------------
// Wire types (discovery + live aggregation → API route → client)
// ---------------------------------------------------------------------------

export const DEAL_RANGE_OPTIONS = [
  { key: "all", label: "ALL", hours: null },
  { key: "72h", label: "72H", hours: 72 },
] as const;

export type DealRangeKey = (typeof DEAL_RANGE_OPTIONS)[number]["key"];

export const DEFAULT_DEAL_RANGE: DealRangeKey = "all";

export function dealRangeOption(key: string | null | undefined) {
  return DEAL_RANGE_OPTIONS.find((r) => r.key === key) ?? DEAL_RANGE_OPTIONS[0];
}

/** One time bucket of a deal's in-window usage, translated into money. Every
    field is additive (a DB sum, or origin × a fixed factor applied once at
    aggregation time), so a packaged baseline can be incrementally extended by
    unioning buckets — nothing is recomputed on merge.

    paid/saved are TOTALS across both billing families; subPaid/subSaved are the
    subscription share (PAYG share = paid − subPaid etc.):
      PAYG（按量）    paid += Σ bill_amount, saved += Σ discount_amount
      订阅            paid += Σ origin × factor, saved += Σ origin × (1 − factor)
    where factor is the same-period per-provider model_discount value (0 for
    free models). */
export interface DealUsagePoint {
  t: string; // bucket start, ISO UTC
  tokens: number; // prompt + completion + reasoning, both billing families
  promptTokens: number;
  outputTokens: number; // completion + reasoning (both billed at the output rate)
  requests: number;
  paid: number;
  saved: number;
  subPaid: number;
  subSaved: number;
}

/** Window totals for one deal period (same field semantics as the points). */
export interface DealStats {
  tokens: number;
  promptTokens: number;
  outputTokens: number;
  requests: number;
  paid: number;
  saved: number;
  subPaid: number;
  subSaved: number;
}

/** A deal period as served to the client — discovered facts + live aggregates. */
export interface DealSeries extends DealPeriod {
  status: DealStatus;
  /** null in degraded mode (billing DB unreachable). */
  stats: DealStats | null;
  /** In-window buckets clipped to the requested range; null when degraded. */
  points: DealUsagePoint[] | null;
}

export interface DealsTotals {
  saved: number;
  paid: number;
  tokens: number;
  /** Subscription share of saved/paid (PAYG share = total − sub). */
  subSaved: number;
  subPaid: number;
  /** Discount averaged over active deals, weighted by each deal's saved $ (falls
      back to a plain mean when nothing has been saved yet). */
  weightedDiscount: number | null;
}

export interface TokenDealsPayload {
  /** DEALS_SCHEMA_VERSION at generation time; absent on legacy baselines. */
  schema?: number;
  generatedAt: string;
  refreshIntervalSeconds: number;
  range: DealRangeKey;
  bucketSeconds: number;
  from: string;
  to: string;
  /** false = degraded: deal facts only, all money fields null. */
  live: boolean;
  /** Set when serving a stale packaged baseline after a DB blip. */
  stale?: boolean;
  /** Last time a live aggregation succeeded (for the degraded banner). */
  lastSuccessAt: string | null;
  activeCount: number;
  endedCount: number;
  totals: DealsTotals | null;
  deals: DealSeries[];
}

// ---------------------------------------------------------------------------
// Period lifecycle (pure date arithmetic — the only state transition is the
// UTC calendar crossing a boundary; there is no manual state)
// ---------------------------------------------------------------------------

/** Millisecond timestamp of a date's 00:00 UTC. */
export function dateStartMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/** Exclusive window end: endDate 24:00 UTC, or +∞ for open periods. */
export function windowEndMs(deal: Pick<DealPeriod, "endDate">): number {
  return deal.endDate == null ? Infinity : dateStartMs(deal.endDate) + 86_400_000;
}

export function dealStatus(
  deal: Pick<DealPeriod, "startDate" | "endDate" | "online">,
  now: Date,
): DealStatus {
  const t = now.getTime();
  if (t < dateStartMs(deal.startDate)) return "scheduled";
  // A free model manually flagged offline reads as ended even without an
  // endDate — its ledger window stays open, usage just stops arriving.
  if (deal.online === false) return "ended";
  if (t >= windowEndMs(deal)) return "ended";
  return "active";
}
