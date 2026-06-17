// Data source for the token-economics study: ZenMux's models listing.
//
// The listing page (https://zenmux.ai/models) is a client-rendered Next.js app —
// the server HTML only ships ~90 of the cards (the rest lazy-load on scroll) and
// its usage numbers live in positional DOM nodes that are fragile to parse. So we
// DON'T scrape the HTML; we hit the same JSON API the page itself calls:
//
//   GET https://zenmux.ai/api/frontend/model/listByFilter?context_length=&sort=newest&keyword=
//   → { success: true, data: [ … ~160 model objects … ] }
//
// It needs no auth and no cookies (the `ctoken` the browser sends is just a
// cache-buster), returns EVERY model in one shot, and gives each model its own
// flat, typed fields — no regex, no cross-card misalignment. We keep only the
// text models (output_modalities contains "text"), which is exactly the set the
// page's ?output_modalities=text filter shows (138 at time of writing).
//
// Field mapping (API → our ScrapedModel), verified against the live page:
//   all_tokens          → usageTokens   (the "341.42M tokens" figure on each card)
//   token_week          → tokenWeek     (trailing-7-day volume; recency signal)
//   pricing_prompt      → inputPrice    ($/1M in — already the net, post-discount price)
//   pricing_completion  → outputPrice   ($/1M out)
//   context_length      → contextWindow
//   max_completion_tokens → maxOutput
//   providerIcons.length  → providers
//   publish_time        → publishTime   (YYYY-MM-DD listing date)

import type { ScrapedModel } from "./normalize";

/** The public page — kept as the human-facing `source` for attribution. */
export const MODELS_URL =
  "https://zenmux.ai/models?sort=newest&output_modalities=text";

/** The JSON API the page calls. `keyword`/`context_length` empty = no filter. */
export const API_URL =
  "https://zenmux.ai/api/frontend/model/listByFilter?context_length=&sort=newest&keyword=";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// The raw API envelope (only the fields we actually read are typed; the API
// returns many more — uptime histograms, aliases, latency, etc.).
// ---------------------------------------------------------------------------

export interface ApiModel {
  slug: string;
  name: string;
  author?: string;
  provider_slug?: string;
  output_modalities?: string;
  input_modalities?: string;
  pricing_prompt?: string | number;
  pricing_completion?: string | number;
  pricing_discount?: string | number;
  all_tokens?: number;
  token_week?: number;
  context_length?: number;
  max_completion_tokens?: number;
  publish_time?: string;
  isFree?: boolean;
  iconUrl?: string;
  providerIcons?: unknown[];
}

interface ApiEnvelope {
  success?: boolean;
  data?: ApiModel[];
}

/** Fetch the model list JSON from the API. Throws on a non-2xx / bad envelope. */
export async function fetchModelsApi(url = API_URL): Promise<ApiModel[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`GET ${url} → HTTP ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as ApiEnvelope;
  if (!json || !Array.isArray(json.data)) {
    throw new Error(
      `GET ${url} → unexpected envelope (no .data array). The API shape may have changed.`,
    );
  }
  return json.data;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/** Coerce a price-ish value ("15" | 15 | null) to a number, or null if absent/NaN. */
function num(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** A model is "text" if its output modalities include text (matches the page filter). */
function isTextModel(m: ApiModel): boolean {
  return (m.output_modalities ?? "").split(",").some((s) => s.trim() === "text");
}

/** Format an absolute token count the way the listing card does: "341.42M tokens". */
export function formatUsage(n: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B tokens`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M tokens`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K tokens`;
  return `${Math.round(n)} tokens`;
}

// ---------------------------------------------------------------------------
// Public entry: API rows → our ScrapedModel rows (text models only)
// ---------------------------------------------------------------------------

/**
 * Map the API's model objects into our raw rows, keeping only text models. Prices
 * default to 0 (the API uses 0 for genuinely-free models) rather than null, so a
 * free model still appears in the leaderboard at $0 instead of being dropped.
 */
export function parseModels(apiModels: ApiModel[]): ScrapedModel[] {
  const rows: ScrapedModel[] = [];
  for (const m of apiModels) {
    if (!m.slug || !isTextModel(m)) continue;

    const usageTokens = typeof m.all_tokens === "number" ? m.all_tokens : null;
    rows.push({
      slug: m.slug,
      name: m.name ?? m.slug,
      inputPrice: num(m.pricing_prompt) ?? 0,
      outputPrice: num(m.pricing_completion) ?? 0,
      usageRaw: formatUsage(usageTokens),
      usageTokens,
      tokenWeek: typeof m.token_week === "number" ? m.token_week : null,
      contextWindow: typeof m.context_length === "number" ? m.context_length : null,
      maxOutput:
        typeof m.max_completion_tokens === "number" ? m.max_completion_tokens : null,
      providers: Array.isArray(m.providerIcons) ? m.providerIcons.length : null,
      publishTime: m.publish_time ?? null,
      isFree: m.isFree === true,
    });
  }
  return rows;
}
