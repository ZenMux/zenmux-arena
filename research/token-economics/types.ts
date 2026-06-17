// Token Economics — single source of truth for the data structures shared by the
// scraper (scrape.ts), the compute step (compute.ts), the CLI (scripts/tokenecon.ts),
// and the Next.js viewer (src/app/token-economics/**).
//
// The study scrapes ZenMux's models listing and asks a simple economic question:
// across every text model ZenMux serves, how does PRICE relate to real-world
// TOKEN CONSUMPTION? Cheap models that nobody uses, premium models that everyone
// reaches for, and the value frontier in between.

import type { VendorId } from "@research/lib/types";

// ---------------------------------------------------------------------------
// The price basket — the headline ranking metric
// ---------------------------------------------------------------------------

/**
 * The standardized request basket used to collapse a model's two-axis pricing
 * (input $/1M, output $/1M) into ONE comparable dollar figure for ranking:
 *
 *   100,000 input tokens  +  1,000 output tokens
 *
 * This is a deliberately input-heavy basket (≈ a long-context, short-answer call —
 * RAG, summarization, classification), so it rewards cheap *input* pricing without
 * ignoring output. `blendedCost` below is computed against it.
 */
export const BASKET = {
  inputTokens: 100_000,
  outputTokens: 1_000,
} as const;

/** Prices on the page are quoted per 1,000,000 tokens. */
export const PRICE_UNIT = 1_000_000;

// ---------------------------------------------------------------------------
// The launch-window usage metric — average tokens per working day at launch
// ---------------------------------------------------------------------------

/**
 * The launch window is the first N **working days** (Mon–Fri) on or after a
 * model's `publishTime`. We sum the model_usage daily series over that span and
 * divide by the working days that actually carried data → `avgDailyTokens`,
 * a per-working-day consumption RATE that's comparable across release dates
 * (unlike all-time `usageTokens`, which mechanically favors older listings).
 */
export const LAUNCH_WINDOW_WORKING_DAYS = 14;

/** One day of the ZenMux model_usage series ("YYYY-MM-DD" → token count). */
export interface DailyUsagePoint {
  date: string;
  value: number;
}

/** Per-model daily token series (from GET …/statistics/model_usage), keyed by
 *  slug downstream. `series` is date-ascending; days with no usage are absent. */
export interface ModelUsageSeries {
  slug: string;
  /** Total tokens across the whole requested span (echoes the API's `value`). */
  total: number;
  series: DailyUsagePoint[];
}

/** Provenance for a model's `avgDailyTokens` — what window it was measured over. */
export interface AvgDailyWindow {
  /** First working day of the window (inclusive, "YYYY-MM-DD"). */
  from: string;
  /** Last *elapsed* working day of the window (inclusive, "YYYY-MM-DD"). */
  to: string;
  /** Target working-day count (= LAUNCH_WINDOW_WORKING_DAYS). */
  targetWorkingDays: number;
  /** Working days of the window that have ELAPSED (≥ data-start, ≤ yesterday) —
   *  this is the DIVISOR for the average. A working day with zero usage still
   *  counts here (zero demand is real signal), so it drags the average down. */
  elapsedWorkingDays: number;
  /** Of the elapsed working days, how many actually carried a usage data point
   *  (for the "N of M days had usage" tooltip; NOT the divisor). */
  workingDaysWithData: number;
  /** True when fewer than `targetWorkingDays` working days have elapsed — a
   *  partial window: the model is younger than 14 working days, or its launch
   *  window runs past yesterday / began before the 2025-09-29 data-start. */
  partial: boolean;
  /** True when the window had to start later than the publish date because the
   *  launch predates the 2025-09-29 data-start (the figure is then a first-
   *  observable rate, not a true launch rate). */
  shifted: boolean;
}

/** blendedCost ($) for one model given its per-1M input/output prices. */
export function blendedCost(inputPrice: number, outputPrice: number): number {
  return (
    (inputPrice * BASKET.inputTokens) / PRICE_UNIT +
    (outputPrice * BASKET.outputTokens) / PRICE_UNIT
  );
}

// ---------------------------------------------------------------------------
// Per-model economics row
// ---------------------------------------------------------------------------

export interface ModelEconomics {
  /** ZenMux slug, e.g. "openai/gpt-4.1" — stable id + React key. */
  slug: string;
  /** Display name as listed, e.g. "OpenAI: GPT-4.1". */
  name: string;
  /** Shortened display name (vendor prefix stripped), e.g. "GPT-4.1". */
  shortName: string;
  /** Canonical vendor id (mapped onto research/lib/vendors.ts). */
  vendor: VendorId;
  /** Vendor display name, e.g. "OpenAI". */
  vendorName: string;
  /** Logo filename under public/maker-logo/ (may be ""). */
  logo: string;

  /** Input price, USD per 1M tokens. */
  inputPrice: number;
  /** Output price, USD per 1M tokens. */
  outputPrice: number;
  /** Total USD for the standardized BASKET (100K in + 1K out) — the ranking key. */
  blendedCost: number;
  /** outputPrice / inputPrice — the "output premium" (∞-safe: null when input is 0). */
  outputInputRatio: number | null;

  /** Observed all-time consumption volume in absolute tokens (null if the API had none). */
  usageTokens: number | null;
  /** Verbatim usage string, e.g. "896.98M tokens" (for display/audit). */
  usageRaw: string | null;
  /** Trailing-7-day token volume — a recency signal distinct from all-time usage. */
  tokenWeek: number | null;
  /** Tokens served per dollar of blended cost — the all-time "value" metric. */
  tokensPerDollar: number | null;

  /**
   * The model's TYPICAL single-day token consumption over its launch window —
   * the MEDIAN of the active days (value > 0) among the first
   * {@link LAUNCH_WINDOW_WORKING_DAYS} *working days* (Mon–Fri) on or after
   * `publishTime`. Median, not mean, so a launch-day spike can't distort it: it
   * answers "what does a normal active day look like", normalizing the all-time
   * `usageTokens` (which unfairly rewards older models) into a launch-velocity
   * figure comparable across release dates. Null when the model has no publish
   * date or its window hasn't opened; a real 0 when the window had no active day.
   * (Field name kept `avgDaily*` for stability; the statistic is a median.) */
  avgDailyTokens: number | null;
  /** Provenance for `avgDailyTokens`: the window it was measured over and how many
   *  working days carried usage (< target elapsed ⇒ a partial window, flagged in
   *  the UI). */
  avgDailyWindow: AvgDailyWindow | null;
  /** Typical daily tokens served per dollar of blended cost — the headline "value"
   *  metric the Value Map + Value Ladder rank by (median daily volume ÷ price). */
  avgDailyPerDollar: number | null;

  /** Context window in tokens (null if absent). */
  contextWindow: number | null;
  /** Max output tokens (null if absent). */
  maxOutput: number | null;
  /** Number of upstream providers serving this model on ZenMux. */
  providers: number | null;
  /** Listing publish date, "YYYY-MM-DD" (null if absent). */
  publishTime: string | null;
  /** Whether ZenMux flags this model as free. */
  isFree: boolean;
}

// ---------------------------------------------------------------------------
// Per-vendor rollup
// ---------------------------------------------------------------------------

export interface VendorEconomics {
  vendor: VendorId;
  name: string;
  logo: string;
  /** Models this vendor has on the listing (text models with a price). */
  modelCount: number;
  /** Median blended basket cost across the vendor's models. */
  medianBlendedCost: number;
  /** Cheapest / priciest blended cost in the vendor's lineup. */
  minBlendedCost: number;
  maxBlendedCost: number;
  /** Sum of observed token consumption across the vendor's models. */
  totalUsage: number;
  /** Share of the whole study's total usage (0..1). */
  usageShare: number;
  /** Sum of avg-daily launch-window consumption across the vendor's models
   *  (only those that carry an `avgDailyTokens`). The recency-fair counterpart
   *  to `totalUsage`. */
  totalAvgDaily: number;
  /** Share of the study's total avg-daily consumption (0..1). */
  avgDailyShare: number;
}

// ---------------------------------------------------------------------------
// The published artifact
// ---------------------------------------------------------------------------

export interface TokenEconomicsSummary {
  modelCount: number;
  vendorCount: number;
  /** Models that carried a usage volume (the price-vs-usage analysis subset). */
  withUsage: number;
  /** Models that carried a launch-window avg-daily figure. */
  withAvgDaily: number;
  /** Sum of usageTokens across all models. */
  totalUsage: number;
  /** Sum of avgDailyTokens across all models that have it. */
  totalAvgDaily: number;
  /** Median + mean blended basket cost across all priced models. */
  medianBlendedCost: number;
  meanBlendedCost: number;
  /** Cheapest / priciest priced models (slug + cost). */
  cheapest: { slug: string; name: string; blendedCost: number } | null;
  priciest: { slug: string; name: string; blendedCost: number } | null;
  /** Most-consumed model by all-time tokens (slug + tokens). */
  mostUsed: { slug: string; name: string; usageTokens: number } | null;
  /** Highest avg-daily-tokens model at launch (slug + avg daily tokens). */
  busiestDaily: { slug: string; name: string; avgDailyTokens: number } | null;
  /** Best value: highest avg-daily tokens per dollar (the headline value metric). */
  bestValue: { slug: string; name: string; avgDailyPerDollar: number } | null;
  /** Most recently listed model (slug + date) and the listing's date span. */
  newest: { slug: string; name: string; publishTime: string } | null;
  /** Earliest / latest publish dates across all models ("YYYY-MM-DD"). */
  publishRange: { earliest: string; latest: string } | null;
  /** Count of models published per "YYYY-MM" bucket, oldest-first. */
  publishByMonth: { month: string; count: number }[];
}

export interface TokenEconomicsData {
  /** ISO8601 generation timestamp. */
  generatedAt: string;
  /** Source URL the data was scraped from (for attribution / reproducibility). */
  source: string;
  /** The price basket used for blendedCost (echoed for the UI footnote). */
  basket: { inputTokens: number; outputTokens: number };
  /** Every priced text model, unsorted (the client sorts per active view). */
  models: ModelEconomics[];
  /** Per-vendor rollups, sorted by model count desc. */
  vendors: VendorEconomics[];
  summary: TokenEconomicsSummary;
}
