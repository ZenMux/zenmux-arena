import type { VendorId } from "@research/lib/types";

export type LiveAnchorLabel = "DeepSeek V4 Pro" | "DeepSeek V4 Flash" | "—";
export type LiveAnchorId = "deepseek-v4-pro" | "deepseek-v4-flash" | "unanchored";
export type LiveBoardAnchorId = Exclude<LiveAnchorId, "unanchored">;
export type LiveMetricKey = "live" | "cumulative";
export type LiveYAxisKey = "tokens" | "cost";

export interface LiveModelPrice {
  model: string;
  slug: string;
  origInput: number;
  origOutput: number;
  origBlended: number;
  anchor: LiveAnchorLabel;
  discountFactor: number;
  newInput: number;
  newOutput: number;
  newBlended: number;
}

export const LIVE_DEEPSEEK_ANCHOR_PRICES = {
  "DeepSeek V4 Pro": { input: 0.45, output: 0.87 },
  "DeepSeek V4 Flash": { input: 0.14, output: 0.28 },
} as const satisfies Record<Exclude<LiveAnchorLabel, "—">, { input: number; output: number }>;

export const LIVE_MODEL_PRICES = [
  {
    model: "DeepSeek V4 Pro",
    slug: "deepseek/deepseek-v4-pro",
    origInput: 0.435,
    origOutput: 0.87,
    origBlended: 0.04437,
    anchor: "DeepSeek V4 Pro",
    discountFactor: 1,
    newInput: 0.435,
    newOutput: 0.87,
    newBlended: 0.04437,
  },
  {
    model: "DeepSeek V4 Flash",
    slug: "deepseek/deepseek-v4-flash",
    origInput: 0.14,
    origOutput: 0.28,
    origBlended: 0.01428,
    anchor: "DeepSeek V4 Flash",
    discountFactor: 1,
    newInput: 0.14,
    newOutput: 0.28,
    newBlended: 0.01428,
  },
  {
    model: "GLM 5.2",
    slug: "z-ai/glm-5.2",
    origInput: 1.4,
    origOutput: 4.4,
    origBlended: 0.1444,
    anchor: "DeepSeek V4 Pro",
    discountFactor: 0.307271,
    newInput: 0.43018,
    newOutput: 1.351994,
    newBlended: 0.04437,
  },
  {
    model: "Kimi K2.7 Code",
    slug: "moonshotai/kimi-k2.7-code",
    origInput: 0.95,
    origOutput: 4,
    origBlended: 0.099,
    anchor: "DeepSeek V4 Pro",
    discountFactor: 0.448182,
    newInput: 0.425773,
    newOutput: 1.792727,
    newBlended: 0.04437,
  },
  {
    model: "Qwen3.7-Plus",
    slug: "qwen/qwen3.7-plus",
    origInput: 0.4,
    origOutput: 1.6,
    origBlended: 0.0416,
    anchor: "DeepSeek V4 Flash",
    discountFactor: 0.343269,
    newInput: 0.137308,
    newOutput: 0.549231,
    newBlended: 0.01428,
  },
  {
    model: "MiniMax M3",
    slug: "minimax/minimax-m3",
    origInput: 0.3,
    origOutput: 1.2,
    origBlended: 0.0312,
    anchor: "DeepSeek V4 Flash",
    discountFactor: 0.457692,
    newInput: 0.137308,
    newOutput: 0.549231,
    newBlended: 0.01428,
  },
  {
    model: "Step 3.7 Flash",
    slug: "stepfun/step-3.7-flash",
    origInput: 0.2,
    origOutput: 1.15,
    origBlended: 0.02115,
    anchor: "DeepSeek V4 Flash",
    discountFactor: 0.675177,
    newInput: 0.135035,
    newOutput: 0.776454,
    newBlended: 0.01428,
  },
  {
    model: "Qwen3.7-Max",
    slug: "qwen/qwen3.7-max",
    origInput: 2.5,
    origOutput: 7.5,
    origBlended: 0.2575,
    anchor: "DeepSeek V4 Pro",
    discountFactor: 0.172311,
    newInput: 0.430777,
    newOutput: 1.29233,
    newBlended: 0.04437,
  },
  {
    model: "Agnes-2.0-Flash",
    slug: "sapiens-ai/agnes-2.0-flash",
    origInput: 0.1,
    origOutput: 0.2,
    origBlended: 0.0102,
    anchor: "—",
    discountFactor: 1,
    newInput: 0.1,
    newOutput: 0.2,
    newBlended: 0.0102,
  },
  {
    model: "ERNIE 5.1",
    slug: "baidu/ernie-5.1",
    origInput: 0.588,
    origOutput: 2.646,
    origBlended: 0.061446,
    anchor: "DeepSeek V4 Pro",
    discountFactor: 0.722097,
    newInput: 0.424593,
    newOutput: 1.91067,
    newBlended: 0.04437,
  },
  {
    model: "Ring-2.6-1T",
    slug: "inclusionai/ring-2.6-1t",
    origInput: 0.3,
    origOutput: 2.5,
    origBlended: 0.0325,
    anchor: "DeepSeek V4 Flash",
    discountFactor: 0.439385,
    newInput: 0.131815,
    newOutput: 1.098462,
    newBlended: 0.01428,
  },
  {
    model: "Ling-2.6-1T",
    slug: "inclusionai/ling-2.6-1t",
    origInput: 0.3,
    origOutput: 2.5,
    origBlended: 0.0325,
    anchor: "DeepSeek V4 Flash",
    discountFactor: 0.439385,
    newInput: 0.131815,
    newOutput: 1.098462,
    newBlended: 0.01428,
  },
  {
    model: "Hy3 preview",
    slug: "tencent/hy3-preview",
    origInput: 0.172,
    origOutput: 0.572,
    origBlended: 0.017772,
    anchor: "DeepSeek V4 Flash",
    discountFactor: 0.803511,
    newInput: 0.138204,
    newOutput: 0.459608,
    newBlended: 0.01428,
  },
  {
    model: "MiMo-V2.5",
    slug: "xiaomi/mimo-v2.5",
    origInput: 0.15,
    origOutput: 0.29,
    origBlended: 0.01529,
    anchor: "DeepSeek V4 Flash",
    discountFactor: 0.933944,
    newInput: 0.140092,
    newOutput: 0.270844,
    newBlended: 0.01428,
  },
  {
    model: "MiMo-V2.5-Pro",
    slug: "xiaomi/mimo-v2.5-pro",
    origInput: 0.44,
    origOutput: 0.88,
    origBlended: 0.04488,
    anchor: "DeepSeek V4 Pro",
    discountFactor: 0.988636,
    newInput: 0.435,
    newOutput: 0.87,
    newBlended: 0.04437,
  },
  {
    model: "Ling-2.6-flash",
    slug: "inclusionai/ling-2.6-flash",
    origInput: 0.1,
    origOutput: 0.3,
    origBlended: 0.0103,
    anchor: "—",
    discountFactor: 1,
    newInput: 0.1,
    newOutput: 0.3,
    newBlended: 0.0103,
  },
  {
    model: "KAT-Coder-Pro-V2",
    slug: "kuaishou/kat-coder-pro-v2",
    origInput: 0.3,
    origOutput: 1.2,
    origBlended: 0.0312,
    anchor: "DeepSeek V4 Flash",
    discountFactor: 0.457692,
    newInput: 0.137308,
    newOutput: 0.549231,
    newBlended: 0.01428,
  },
  {
    model: "Qwen3.6 Flash",
    slug: "qwen/qwen3.6-flash",
    origInput: 0.25,
    origOutput: 1.5,
    origBlended: 0.0265,
    anchor: "DeepSeek V4 Flash",
    discountFactor: 0.538868,
    newInput: 0.134717,
    newOutput: 0.808302,
    newBlended: 0.01428,
  },
  {
    model: "Doubao-Seed-2.0-pro",
    slug: "bytedance/doubao-seed-2.0-pro",
    origInput: 0.45,
    origOutput: 2.24,
    origBlended: 0.04724,
    anchor: "DeepSeek V4 Pro",
    discountFactor: 0.939246,
    newInput: 0.422661,
    newOutput: 2.103912,
    newBlended: 0.04437,
  },
  {
    model: "Doubao-Seed-2.0-mini",
    slug: "bytedance/doubao-seed-2.0-mini",
    origInput: 0.03,
    origOutput: 0.28,
    origBlended: 0.00328,
    anchor: "—",
    discountFactor: 1,
    newInput: 0.03,
    newOutput: 0.28,
    newBlended: 0.00328,
  },
] as const satisfies readonly LiveModelPrice[];

export const LIVE_BOARD_ANCHORS = [
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
] as const satisfies readonly { id: LiveBoardAnchorId; label: Exclude<LiveAnchorLabel, "—"> }[];

export type LiveRangeKey = "all" | "72h";

export const LIVE_RANGE_OPTIONS = [
  { key: "all", label: "ALL", hours: null },
  { key: "72h", label: "72H", hours: 72 },
] as const;

export const DEFAULT_LIVE_RANGE: LiveRangeKey = "all";
export const DEFAULT_LIVE_START_ISO = "2026-06-22T00:00:00.000Z";
export const DEFAULT_LIVE_BUCKET_SECONDS = 300;
export const DEFAULT_LIVE_REFRESH_INTERVAL_SECONDS = 300;

export function liveAnchorId(anchor: LiveAnchorLabel): LiveAnchorId {
  if (anchor === "DeepSeek V4 Pro") return "deepseek-v4-pro";
  if (anchor === "DeepSeek V4 Flash") return "deepseek-v4-flash";
  return "unanchored";
}

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
  anchorId: LiveAnchorId;
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
  label: Exclude<LiveAnchorLabel, "—">;
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
}
