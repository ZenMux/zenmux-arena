// Token Deals（让利账本）— config-driven deal discovery (INTERNAL-ONLY).
//
// v4: the human-curated roster in config/token-deals.json is the single source
// of deal FACTS (windows, factors, online/display switches) — produced by
// `pnpm tokendeals:sync` (see ./deal-sync.ts) and confirmed by hand. Scheduled
// aggregation reads valid_usage in ./deals.ts. The website reads Supabase only.
//
// Display prices still come from the PUBLIC models API (https://zenmux.ai/api/
// v1/models): pricings.prompt / pricings.completion are $/1M and reflect the
// CURRENT charged (post-discount) price of the display endpoint. The list
// price is restored as net ÷ the shallowest provider factor (verified: the
// display endpoint carries the shallowest discount — e.g. mimo-v2.5 API
// 0.1401 = 0.15 × the xiaomi 0.9339 factor, not the kingsoftcloud 0.34).
// Free models price at 0; their struck-through list price is the paid
// sibling's (config `sourceSlug`). The money math never uses these prices —
// an unavailable price API preserves the previous publication.

import { VENDORS } from "@research/lib/vendors";
import { vendorForSlug } from "@research/token-economics/normalize";
import { dealsStartMs, utcDateOf } from "./billing-db";
import { loadDealsConfig, type DiscountEntry, type FreeEntry } from "@research/token-deals/deals-config";
import type { DealPeriod, DealProvider } from "@research/token-deals/types";
import { safeFailure } from "./job";

// ---------------------------------------------------------------------------
// Display prices from the public models API
// ---------------------------------------------------------------------------

const MODELS_API_URL = "https://zenmux.ai/api/v1/models";
const MODELS_API_TIMEOUT_MS = 15_000;
const PRICES_TTL_MS = 5 * 60_000; // one refresh boundary

/** slug → current charged (net) $/1M prices. */
type PriceMap = Map<string, { prompt: number; completion: number }>;

interface ModelsApiModel {
  id: string;
  pricings?: Record<string, { value?: number; unit?: string }[] | undefined>;
}

let priceCache: { at: number; prices: PriceMap } | null = null;

function pricingValue(model: ModelsApiModel, key: string): number | null {
  const entry = model.pricings?.[key]?.[0];
  return typeof entry?.value === "number" && Number.isFinite(entry.value) ? entry.value : null;
}

/** Fetch prices for publication; retain a good process memo on transient failure.
    Without a memo, reject publication so good persisted prices are preserved. */
async function fetchNetPrices(): Promise<PriceMap> {
  if (priceCache && Date.now() - priceCache.at < PRICES_TTL_MS) return priceCache.prices;
  try {
    const res = await fetch(MODELS_API_URL, {
      signal: AbortSignal.timeout(MODELS_API_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { data?: ModelsApiModel[] };
    const prices: PriceMap = new Map();
    if (!Array.isArray(body.data)) throw new Error("Model listing returned an invalid envelope.");
    for (const model of body.data) {
      const prompt = pricingValue(model, "prompt");
      const completion = pricingValue(model, "completion");
      if (model.id && prompt != null && completion != null) {
        prices.set(model.id, { prompt, completion });
      }
    }
    if (prices.size === 0) throw new Error("empty model list");
    priceCache = { at: Date.now(), prices };
    return prices;
  } catch (err) {
    console.warn(
      "[token-deals] models API price fetch failed:", safeFailure(err),
    );
    if (priceCache) return priceCache.prices;
    throw new Error("Model listing prices unavailable; previous publication retained.", { cause: err });
  }
}

/** Discount-deal prices: net straight from the API, list restored with the
    SHALLOWEST factor (see module header). */
function discountPrices(prices: PriceMap, slug: string, providers: DealProvider[]) {
  const net = prices.get(slug);
  if (!net) return { netInput: null, netOutput: null, origInput: null, origOutput: null };
  const shallowest = Math.max(...providers.map((p) => p.discount));
  const restore = (n: number) => (shallowest > 0 ? Number((n / shallowest).toFixed(6)) : null);
  return {
    netInput: net.prompt,
    netOutput: net.completion,
    origInput: restore(net.prompt),
    origOutput: restore(net.completion),
  };
}

/** Free-deal prices: $0 net; list price borrowed from the paid sibling. */
function freePrices(prices: PriceMap, sourceSlug: string) {
  const sibling = prices.get(sourceSlug) ?? null;
  return {
    netInput: 0,
    netOutput: 0,
    origInput: sibling?.prompt ?? null,
    origOutput: sibling?.completion ?? null,
  };
}

// ---------------------------------------------------------------------------
// Roster → DealPeriod
// ---------------------------------------------------------------------------

function vendorFields(slug: string) {
  const vendor = vendorForSlug(slug);
  return { vendor, vendorName: VENDORS[vendor]?.name ?? vendor };
}

function fromDiscountEntry(entry: DiscountEntry, prices: PriceMap): DealPeriod {
  const providers: DealProvider[] =
    entry.providers.length > 0
      ? entry.providers
      : [{ slug: "default", name: "default", discount: entry.discount }];
  return {
    id: `${entry.slug}@${entry.startDate}`,
    dealType: "discount",
    model: entry.model,
    slug: entry.slug,
    ...vendorFields(entry.slug),
    discount: entry.discount,
    providers,
    ...discountPrices(prices, entry.slug, providers),
    startDate: entry.startDate,
    endDate: entry.endDate,
    publishTime: entry.publishDate,
    delisted: entry.delisted,
  };
}

function fromFreeEntry(entry: FreeEntry, prices: PriceMap, startMs: number): DealPeriod {
  // The ledger opens at launch or the model's listing date, whichever is later.
  const publishMs = entry.publishDate ? Date.parse(`${entry.publishDate}T00:00:00Z`) : NaN;
  const startDate = utcDateOf(Number.isNaN(publishMs) ? startMs : Math.max(publishMs, startMs));
  return {
    id: `${entry.slug}@${startDate}`,
    dealType: "free",
    model: entry.model,
    slug: entry.slug,
    ...vendorFields(entry.slug),
    discount: 0,
    providers: [],
    ...freePrices(prices, entry.sourceSlug),
    startDate,
    endDate: null,
    publishTime: entry.publishDate,
    // Offline free models keep their card (the ledger is complete) but lose
    // the outbound link, exactly like a delisted paid model.
    delisted: !entry.online,
    online: entry.online,
  };
}

/**
 * Load every displayed deal period from the config roster. Entries with
 * display=false are the human's "not on the board" switch — they're excluded
 * here, which also excludes their money from every aggregate downstream.
 */
export async function discoverDeals(): Promise<DealPeriod[]> {
  const config = await loadDealsConfig();
  if (!config) {
    console.warn(
      "[token-deals] config/token-deals.json missing — empty roster. Run `pnpm tokendeals:sync`.",
    );
    return [];
  }
  const prices = await fetchNetPrices();
  const startMs = dealsStartMs();

  const deals: DealPeriod[] = [];
  const discountSlugs = new Set<string>();
  for (const entry of config.discounts) {
    if (!entry.display) continue;
    discountSlugs.add(entry.slug);
    deals.push(fromDiscountEntry(entry, prices));
  }
  for (const entry of config.freeModels) {
    if (!entry.display) continue;
    // A slug can't be both a discount deal and a free deal (sync skips these
    // too, but the roster is hand-editable — guard again here).
    if (discountSlugs.has(entry.slug)) continue;
    deals.push(fromFreeEntry(entry, prices, startMs));
  }

  deals.sort((a, b) => a.slug.localeCompare(b.slug) || a.startDate.localeCompare(b.startDate));
  return deals;
}
