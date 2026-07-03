// Token Deals（让利账本）— pure types, constants, and date/money math.
//
// CLIENT-SAFE ON PURPOSE: this module must import nothing with a Node.js
// runtime footprint (fs, mysql, the vendors registry…), because the client
// components under src/app/token-deals/ import their wire types and range
// constants from here. The registry LOADER (which needs node:fs) lives in
// ./deals-config.ts and re-exports everything below for server-side callers.

import type { VendorId } from "@research/lib/types";

export class DealsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DealsConfigError";
  }
}

/** One registered deal period, fully resolved (orig prices restored). */
export interface DealPeriod {
  /** Stable id: `<slug>@<startDate>` — unique because windows can't overlap. */
  id: string;
  model: string;
  slug: string;
  vendor: VendorId;
  vendorName: string;
  /** User-pays fraction, e.g. 0.31 = pay 31% (3.1 折). */
  discount: number;
  /** Net (post-discount) $/1M prices — what developers actually pay. */
  netInput: number;
  netOutput: number;
  /** List (pre-discount) $/1M prices, restored as net ÷ discount at load time. */
  origInput: number;
  origOutput: number;
  /** UTC date window. endDate null = still running. */
  startDate: string; // YYYY-MM-DD, inclusive (00:00 UTC)
  endDate: string | null; // YYYY-MM-DD, inclusive (window closes at endDate 24:00 UTC)
  /** Model pulled from the main site — keep the card, drop the outbound link. */
  delisted: boolean;
}

export type DealStatus = "scheduled" | "active" | "ended";

// ---------------------------------------------------------------------------
// Wire types (registry + live aggregation → API route → client)
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

/** One time bucket of a deal's in-window usage, translated into money.
    The prompt/output token split rides along so a packaged baseline can be
    incrementally extended losslessly (saved is recomputable from the splits). */
export interface DealUsagePoint {
  t: string; // bucket start, ISO UTC
  tokens: number; // prompt + completion + reasoning
  promptTokens: number;
  outputTokens: number; // completion + reasoning (both billed at the output rate)
  requests: number;
  paid: number; // Σ bill_amount
  saved: number; // per rule 3: token-wise (orig − net) price gap
}

/** Window totals for one deal period. */
export interface DealStats {
  tokens: number;
  promptTokens: number;
  outputTokens: number;
  requests: number;
  paid: number;
  saved: number;
}

/** A deal period as served to the client — registry facts + live aggregates. */
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
  /** Discount averaged over active deals, weighted by each deal's saved $ (falls
      back to a plain mean when nothing has been saved yet). */
  weightedDiscount: number | null;
}

export interface TokenDealsPayload {
  generatedAt: string;
  refreshIntervalSeconds: number;
  range: DealRangeKey;
  bucketSeconds: number;
  from: string;
  to: string;
  /** false = degraded: registry prices only, all money fields null. */
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

/** Millisecond timestamp of a registry date's 00:00 UTC. */
export function dateStartMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/** Exclusive window end: endDate 24:00 UTC, or +∞ for open periods. */
export function windowEndMs(deal: DealPeriod): number {
  return deal.endDate == null ? Infinity : dateStartMs(deal.endDate) + 86_400_000;
}

export function dealStatus(deal: DealPeriod, now: Date): DealStatus {
  const t = now.getTime();
  if (t < dateStartMs(deal.startDate)) return "scheduled";
  if (t >= windowEndMs(deal)) return "ended";
  return "active";
}

/** SAVED for one bucket, per rule 3: token-wise price gap. Reasoning tokens are
    billed at the output rate, so they ride the output-side gap. */
export function savedForTokens(
  deal: Pick<DealPeriod, "origInput" | "netInput" | "origOutput" | "netOutput">,
  promptTokens: number,
  outputTokens: number,
): number {
  return (
    (promptTokens * (deal.origInput - deal.netInput) +
      outputTokens * (deal.origOutput - deal.netOutput)) /
    1e6
  );
}
