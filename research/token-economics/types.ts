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

  /** Observed consumption volume in absolute tokens (null if the card had none). */
  usageTokens: number | null;
  /** Verbatim usage string from the card, e.g. "896.98M tokens" (for display/audit). */
  usageRaw: string | null;
  /** Tokens served per dollar of blended cost — the headline "value" metric. */
  tokensPerDollar: number | null;

  /** Context window in tokens (null if unparsed). */
  contextWindow: number | null;
  /** Max output tokens (null if unparsed). */
  maxOutput: number | null;
  /** Number of upstream providers serving this model on ZenMux. */
  providers: number | null;
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
}

// ---------------------------------------------------------------------------
// The published artifact
// ---------------------------------------------------------------------------

export interface TokenEconomicsSummary {
  modelCount: number;
  vendorCount: number;
  /** Models that carried a usage volume (the price-vs-usage analysis subset). */
  withUsage: number;
  /** Sum of usageTokens across all models. */
  totalUsage: number;
  /** Median + mean blended basket cost across all priced models. */
  medianBlendedCost: number;
  meanBlendedCost: number;
  /** Cheapest / priciest priced models (slug + cost). */
  cheapest: { slug: string; name: string; blendedCost: number } | null;
  priciest: { slug: string; name: string; blendedCost: number } | null;
  /** Most-consumed model (slug + tokens). */
  mostUsed: { slug: string; name: string; usageTokens: number } | null;
  /** Best tokens-per-dollar model among those with usage. */
  bestValue: { slug: string; name: string; tokensPerDollar: number } | null;
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
