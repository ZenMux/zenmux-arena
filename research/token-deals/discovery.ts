// Token Deals（让利账本）— DB-driven deal discovery (SERVER-ONLY).
//
// The billing DB is the single source of truth for deal facts:
//   · model_discount — which models were EVER discounted, on which providers,
//     at what factor, and when. A row's life is its window: gmt_create starts
//     it; status!=active / deleted=1 ends it at gmt_modified (the revert
//     instant). expected_end_date is advisory ("预期") and never used as fact.
//   · model — display names + visibility for those slugs, plus the `-free`
//     suffixed models (100% off, usually absent from model_discount entirely).
//
// Everything is clamped to TOKEN_ECON_LIVE_START_ISO: rows fully reverted
// before the live window opened (e.g. the 2026-06-18 测试 batch, reverted
// 2026-06-23 05:39) never surface, and free-model ledgers start at the window
// start, not the model's listing date.
//
// Display prices come from the PUBLIC models API (https://zenmux.ai/api/v1/
// models): pricings.prompt / pricings.completion are $/1M and reflect the
// CURRENT charged (post-discount) price of the display endpoint. The list
// price is restored as net ÷ the shallowest provider factor (verified: the
// display endpoint carries the shallowest discount — e.g. mimo-v2.5 API
// 0.1401 = 0.15 × the xiaomi 0.9339 factor, not the kingsoftcloud 0.34).
// Free models price at 0; their struck-through list price is the paid
// sibling's (slug minus `-free`). The money math never uses these prices —
// a failed API fetch just hides the card's price rows.

import type { RowDataPacket } from "mysql2/promise";
import { VENDORS } from "@research/lib/vendors";
import { shortName, vendorForSlug } from "@research/token-economics/normalize";
import { liveStartMs, parseSqlUtc, queryRows, toNumber, utcDateOf } from "./db";
import type { DealPeriod, DealProvider } from "./types";

const FREE_SUFFIX = "-free";

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

/** Fetch (with in-memory TTL cache) the public per-model prompt/completion
    prices. NEVER throws — prices are display garnish; on failure the last
    good map (or an empty one) is returned and cards hide their price rows. */
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
    for (const model of body.data ?? []) {
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
      "[token-deals] models API price fetch failed, price rows will be hidden:",
      err instanceof Error ? err.message : err,
    );
    return priceCache?.prices ?? new Map();
  }
}

// ---------------------------------------------------------------------------
// model_discount windows
// ---------------------------------------------------------------------------

interface DiscountRow extends RowDataPacket {
  model_slug: string;
  model_name: string | null;
  provider_slug: string;
  provider_name: string | null;
  new_discount: string;
  status: string;
  deleted: number;
  gmt_create: string;
  gmt_modified: string;
}

interface ModelRow extends RowDataPacket {
  slug: string;
  name: string;
  short_name: string | null;
  visible: number;
  deleted: number;
  gmt_create: string;
  publish_time: string | null;
}

interface ProviderWindow {
  providerSlug: string;
  providerName: string;
  discount: number;
  startMs: number;
  /** null = still active. */
  endMs: number | null;
  createdMs: number;
}

/** One merged discount period of a model (provider windows unioned). */
interface MergedPeriod {
  startMs: number;
  endMs: number | null;
  providers: ProviderWindow[];
}

function overlapsOrTouches(a: MergedPeriod, w: ProviderWindow): boolean {
  // Day-granular union: windows on the same or adjacent calendar days merge
  // into one period (the ledger's period unit is the UTC day).
  const gap = 86_400_000;
  const aEnd = a.endMs ?? Infinity;
  return w.startMs <= aEnd + gap;
}

/** Union a slug's provider windows into disjoint periods (sorted by start). */
function mergeWindows(windows: ProviderWindow[]): MergedPeriod[] {
  const sorted = [...windows].sort((a, b) => a.startMs - b.startMs);
  const periods: MergedPeriod[] = [];
  for (const w of sorted) {
    const last = periods[periods.length - 1];
    if (last && overlapsOrTouches(last, w)) {
      last.providers.push(w);
      if (last.endMs != null) {
        last.endMs = w.endMs == null ? null : Math.max(last.endMs, w.endMs);
      }
    } else {
      periods.push({ startMs: w.startMs, endMs: w.endMs, providers: [w] });
    }
  }
  return periods;
}

/** Latest row per provider inside a period → the card's provider detail. */
function providerDetail(period: MergedPeriod): DealProvider[] {
  const byProvider = new Map<string, ProviderWindow>();
  for (const w of period.providers) {
    const prev = byProvider.get(w.providerSlug);
    if (!prev || w.createdMs > prev.createdMs) byProvider.set(w.providerSlug, w);
  }
  return [...byProvider.values()]
    .map((w) => ({ slug: w.providerSlug, name: w.providerName, discount: w.discount }))
    .sort((a, b) => a.discount - b.discount || a.slug.localeCompare(b.slug));
}

function displayName(model: ModelRow | undefined, fallbackName: string | null, slug: string): string {
  if (model?.short_name?.trim()) return model.short_name.trim();
  if (model?.name) return shortName(model.name, slug);
  if (fallbackName) return shortName(fallbackName, slug);
  return shortName(slug, slug);
}

function basePeriod(slug: string, model: ModelRow | undefined, fallbackName: string | null) {
  const vendor = vendorForSlug(slug);
  return {
    model: displayName(model, fallbackName, slug),
    slug,
    vendor,
    vendorName: VENDORS[vendor]?.name ?? vendor,
    // No model row at all = removed from the catalog; visible!=1 = hidden.
    delisted: model == null || model.visible !== 1 || model.deleted !== 0,
    publishTime: model?.publish_time?.trim() || null,
  };
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
function freePrices(prices: PriceMap, slug: string) {
  const sibling = prices.get(slug.slice(0, -FREE_SUFFIX.length)) ?? null;
  return {
    netInput: 0,
    netOutput: 0,
    origInput: sibling?.prompt ?? null,
    origOutput: sibling?.completion ?? null,
  };
}

/** Model rows for a slug set, deduped (prefer the live row over deleted copies). */
async function queryModels(slugs: string[]): Promise<Map<string, ModelRow>> {
  if (slugs.length === 0) return new Map();
  const placeholders = slugs.map(() => "?").join(",");
  const rows = await queryRows<ModelRow>(
    `SELECT slug, name, short_name, visible, deleted, gmt_create, publish_time
     FROM model WHERE slug IN (${placeholders})`,
    slugs,
  );
  const bySlug = new Map<string, ModelRow>();
  for (const row of rows) {
    const prev = bySlug.get(row.slug);
    if (!prev || (prev.deleted !== 0 && row.deleted === 0)) bySlug.set(row.slug, row);
  }
  return bySlug;
}

/**
 * Discover every deal period from the DB. Historical (reverted) discounts are
 * included as ended periods as long as their window intersects the live start;
 * `-free` models are included as open 100%-off periods.
 */
export async function discoverDeals(): Promise<DealPeriod[]> {
  const startMs = liveStartMs();

  const [discountRows, freeModelRows, prices] = await Promise.all([
    queryRows<DiscountRow>(
      `SELECT model_slug, model_name, provider_slug, provider_name,
              new_discount, status, deleted, gmt_create, gmt_modified
       FROM model_discount`,
      [],
    ),
    queryRows<ModelRow>(
      `SELECT slug, name, short_name, visible, deleted, gmt_create, publish_time
       FROM model WHERE slug LIKE ?`,
      [`%${FREE_SUFFIX}`],
    ),
    fetchNetPrices(),
  ]);

  // ── Discounted models: window per row, clamp + drop pre-window history ──
  const windowsBySlug = new Map<string, ProviderWindow[]>();
  for (const row of discountRows) {
    const createdMs = parseSqlUtc(row.gmt_create);
    if (createdMs == null) continue;
    const discount = toNumber(row.new_discount);
    // x1.0 rows are no-op configs (original_discount restores), not deals.
    if (!(discount > 0) || discount >= 1) continue;
    const active = row.status === "active" && row.deleted === 0;
    const endMs = active ? null : parseSqlUtc(row.gmt_modified);
    // Reverted before the live window opened → never surfaces (测试 rows).
    if (endMs != null && endMs <= startMs) continue;
    const list = windowsBySlug.get(row.model_slug) ?? [];
    list.push({
      providerSlug: row.provider_slug,
      providerName: row.provider_name?.trim() || row.provider_slug,
      discount,
      startMs: Math.max(createdMs, startMs),
      endMs,
      createdMs,
    });
    windowsBySlug.set(row.model_slug, list);
  }

  const discountSlugs = [...windowsBySlug.keys()];
  const models = await queryModels(discountSlugs);

  const deals: DealPeriod[] = [];
  for (const [slug, windows] of windowsBySlug) {
    const nameFallback = discountRows.find((r) => r.model_slug === slug)?.model_name ?? null;
    const base = basePeriod(slug, models.get(slug), nameFallback);
    for (const period of mergeWindows(windows)) {
      const providers = providerDetail(period);
      const discount = Math.min(...providers.map((p) => p.discount));
      const startDate = utcDateOf(period.startMs);
      deals.push({
        id: `${slug}@${startDate}`,
        dealType: "discount",
        ...base,
        discount,
        providers,
        ...discountPrices(prices, slug, providers),
        startDate,
        endDate: period.endMs == null ? null : utcDateOf(period.endMs),
      });
    }
  }

  // ── Free models: 100% off, ledger opens at the live window start (or the
  //    model's listing instant if it launched later). Deduped against any slug
  //    that already carries a discount period. ──
  const freeBySlug = new Map<string, ModelRow>();
  for (const row of freeModelRows) {
    const prev = freeBySlug.get(row.slug);
    if (!prev || (prev.deleted !== 0 && row.deleted === 0)) freeBySlug.set(row.slug, row);
  }
  for (const [slug, row] of freeBySlug) {
    if (windowsBySlug.has(slug)) continue;
    const createdMs = parseSqlUtc(row.gmt_create) ?? startMs;
    const startDate = utcDateOf(Math.max(createdMs, startMs));
    deals.push({
      id: `${slug}@${startDate}`,
      dealType: "free",
      ...basePeriod(slug, row, null),
      discount: 0,
      providers: [],
      ...freePrices(prices, slug),
      startDate,
      endDate: null,
    });
  }

  deals.sort((a, b) => a.slug.localeCompare(b.slug) || a.startDate.localeCompare(b.startDate));
  return deals;
}
