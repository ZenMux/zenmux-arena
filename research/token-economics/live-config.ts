import type { VendorId } from "@research/lib/types";

export const UNANCHORED_ANCHOR_ID = "unanchored";

export type LiveAnchorId = string;
export type LiveBoardAnchorId = string;
export type LiveMetricKey = "live" | "cumulative";
export type LiveYAxisKey = "tokens" | "cost";

export class LiveConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveConfigError";
  }
}

export interface LiveAnchorPrice {
  input: number;
  output: number;
}

export interface LiveAnchorConfig {
  id: LiveBoardAnchorId;
  label: string;
  slug: string | null;
  price: LiveAnchorPrice;
  targetBlended: number;
}

export interface LiveModelPrice {
  model: string;
  slug: string;
  origInput: number;
  origOutput: number;
  origBlended: number;
  anchorId: LiveAnchorId;
  anchor: string | null;
  isAnchor: boolean;
  discountFactor: number;
  newInput: number;
  newOutput: number;
  newBlended: number;
  /** Campaign window — UTC calendar dates, endDate INCLUSIVE (same convention
      as config/token-deals.json). Null when the model has no dated campaign
      (anchors, unanchored curiosities). Ended-ness is derived at RENDER time
      from these dates, never baked into cached payloads. */
  startDate: string | null;
  endDate: string | null;
}

// ── Campaign window helpers ──────────────────────────────────────────────────
// endDate is an inclusive UTC calendar day, so the campaign actually ends at
// the START of the following day. Callers pass "now" explicitly (usually the
// payload's generatedAt) so cached payloads and clients agree on the clock.
export const DAY_MS = 86_400_000;

export function dealWindowEndMs(endDate: string): number {
  return Date.parse(`${endDate}T00:00:00.000Z`) + DAY_MS;
}

export function isDealEnded(endDate: string | null | undefined, atMs: number): boolean {
  if (!endDate) return false;
  const end = dealWindowEndMs(endDate);
  return Number.isFinite(end) && atMs >= end;
}

export interface LiveModelConfig {
  anchors: LiveAnchorConfig[];
  models: LiveModelPrice[];
}

export const LIVE_RANGE_OPTIONS = [
  { key: "all", label: "ALL", hours: null },
  { key: "72h", label: "72H", hours: 72 },
] as const;

export type LiveRangeKey = (typeof LIVE_RANGE_OPTIONS)[number]["key"];

export const DEFAULT_LIVE_RANGE: LiveRangeKey = "all";
export const DEFAULT_LIVE_START_ISO = "2026-06-22T00:00:00.000Z";
export const DEFAULT_LIVE_BUCKET_SECONDS = 300;
export const DEFAULT_LIVE_REFRESH_INTERVAL_SECONDS = 300;

export function liveRangeOption(key: string | null | undefined) {
  return LIVE_RANGE_OPTIONS.find((r) => r.key === key) ?? LIVE_RANGE_OPTIONS[1];
}

export interface LiveUsagePoint {
  t: string;
  tokens: number;
  cost: number;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
}

export interface LiveModelSeries extends LiveModelPrice {
  vendor: VendorId;
  vendorName: string;
  totalTokens: number;
  totalCost: number;
  totalRequests: number;
  latestTokens: number;
  latestCost: number;
  peakTokens: number;
  peakCost: number;
  points: LiveUsagePoint[];
}

export interface LiveAnchorSeries {
  id: LiveBoardAnchorId;
  label: string;
  price: LiveAnchorPrice;
  targetBlended: number;
  totalTokens: number;
  totalCost: number;
  totalRequests: number;
  peakTokens: number;
  peakCost: number;
  models: LiveModelSeries[];
}

export interface LiveTokenEconomicsPayload {
  generatedAt: string;
  dataLagSeconds: number;
  refreshIntervalSeconds: number;
  range: LiveRangeKey;
  bucket: string;
  bucketSeconds: number;
  from: string;
  to: string;
  anchors: LiveAnchorSeries[];
  unanchored: LiveModelSeries[];
  stale?: boolean;
}
