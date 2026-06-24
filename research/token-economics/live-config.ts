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
