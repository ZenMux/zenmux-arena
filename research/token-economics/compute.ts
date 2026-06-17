// Compute step: normalized models → the published TokenEconomicsData artifact.
// Pure functions of the scraped rows (no I/O), mirroring research/lib/aggregate.ts
// in the sibling study. Deterministic: same input HTML ⇒ same JSON (modulo the
// generatedAt stamp, which the CLI passes in).

import { VENDORS, isPseudoVendor } from "@research/lib/vendors";
import type { VendorId } from "@research/lib/types";
import { MODELS_URL } from "./scrape";
import { normalizeModel, type ScrapedModel } from "./normalize";
import {
  BASKET,
  type ModelEconomics,
  type TokenEconomicsData,
  type TokenEconomicsSummary,
  type VendorEconomics,
} from "./types";

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Build per-vendor rollups, sorted by model count desc then name. */
function rollupVendors(
  models: ModelEconomics[],
  totalUsage: number,
): VendorEconomics[] {
  const byVendor = new Map<VendorId, ModelEconomics[]>();
  for (const m of models) {
    const list = byVendor.get(m.vendor) ?? [];
    list.push(m);
    byVendor.set(m.vendor, list);
  }

  const rows: VendorEconomics[] = [];
  for (const [vendor, list] of byVendor) {
    const costs = list.map((m) => m.blendedCost);
    const usage = list.reduce((s, m) => s + (m.usageTokens ?? 0), 0);
    const meta = VENDORS[vendor];
    rows.push({
      vendor,
      name: meta?.name ?? vendor,
      logo: meta && !isPseudoVendor(vendor) ? meta.logo : "",
      modelCount: list.length,
      medianBlendedCost: median(costs),
      minBlendedCost: Math.min(...costs),
      maxBlendedCost: Math.max(...costs),
      totalUsage: usage,
      usageShare: totalUsage > 0 ? usage / totalUsage : 0,
    });
  }
  rows.sort((a, b) => b.modelCount - a.modelCount || a.name.localeCompare(b.name));
  return rows;
}

function buildSummary(models: ModelEconomics[]): TokenEconomicsSummary {
  const costs = models.map((m) => m.blendedCost);
  const withUsage = models.filter((m) => m.usageTokens != null);
  const totalUsage = withUsage.reduce((s, m) => s + (m.usageTokens ?? 0), 0);

  const byCostAsc = [...models].sort((a, b) => a.blendedCost - b.blendedCost);
  const cheapest = byCostAsc.find((m) => m.blendedCost > 0) ?? byCostAsc[0] ?? null;
  const priciest = byCostAsc[byCostAsc.length - 1] ?? null;

  const mostUsed =
    [...withUsage].sort((a, b) => (b.usageTokens ?? 0) - (a.usageTokens ?? 0))[0] ??
    null;
  const bestValue =
    [...withUsage]
      .filter((m) => m.tokensPerDollar != null)
      .sort((a, b) => (b.tokensPerDollar ?? 0) - (a.tokensPerDollar ?? 0))[0] ??
    null;

  const vendorIds = new Set(models.map((m) => m.vendor));

  // Recency: newest listing, full date span, and a per-month publish histogram.
  const dated = models.filter((m) => m.publishTime);
  const newest =
    [...dated].sort((a, b) => (b.publishTime! < a.publishTime! ? -1 : 1))[0] ?? null;
  const publishDates = dated.map((m) => m.publishTime!).sort();
  const publishRange =
    publishDates.length > 0
      ? { earliest: publishDates[0], latest: publishDates[publishDates.length - 1] }
      : null;
  const monthCounts = new Map<string, number>();
  for (const m of dated) {
    const key = m.publishTime!.slice(0, 7); // "YYYY-MM"
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const publishByMonth = [...monthCounts.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, count]) => ({ month, count }));

  return {
    modelCount: models.length,
    vendorCount: vendorIds.size,
    withUsage: withUsage.length,
    totalUsage,
    medianBlendedCost: median(costs),
    meanBlendedCost: mean(costs),
    cheapest: cheapest
      ? { slug: cheapest.slug, name: cheapest.shortName, blendedCost: cheapest.blendedCost }
      : null,
    priciest: priciest
      ? { slug: priciest.slug, name: priciest.shortName, blendedCost: priciest.blendedCost }
      : null,
    mostUsed: mostUsed
      ? { slug: mostUsed.slug, name: mostUsed.shortName, usageTokens: mostUsed.usageTokens! }
      : null,
    bestValue: bestValue
      ? { slug: bestValue.slug, name: bestValue.shortName, tokensPerDollar: bestValue.tokensPerDollar! }
      : null,
    newest: newest
      ? { slug: newest.slug, name: newest.shortName, publishTime: newest.publishTime! }
      : null,
    publishRange,
    publishByMonth,
  };
}

export interface ComputeResult {
  data: TokenEconomicsData;
  /** Raw rows that had no usable price and were dropped (slug list, for logging). */
  dropped: string[];
}

/** Turn raw scraped rows into the full published artifact. */
export function compute(rows: ScrapedModel[], generatedAt: string): ComputeResult {
  const models: ModelEconomics[] = [];
  const dropped: string[] = [];
  // De-dup by slug (the listing can repeat a card); first occurrence wins.
  const seen = new Set<string>();
  for (const raw of rows) {
    if (raw.slug === "zenmux/auto") continue; // the router meta-model, not a real model
    if (seen.has(raw.slug)) continue;
    seen.add(raw.slug);
    const m = normalizeModel(raw);
    if (m) models.push(m);
    else dropped.push(raw.slug);
  }

  const summary = buildSummary(models);
  const vendors = rollupVendors(models, summary.totalUsage);

  return {
    data: {
      generatedAt,
      source: MODELS_URL,
      basket: { inputTokens: BASKET.inputTokens, outputTokens: BASKET.outputTokens },
      models,
      vendors,
      summary,
    },
    dropped,
  };
}
