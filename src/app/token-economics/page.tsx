// Token Economics — the landing surface. Server component that fetches the
// ZenMux model-listing API at request time and derives the economics artifact
// on the fly (research/token-economics/{scrape,compute} are pure functions, no
// disk writes — safe on Vercel's read-only/immutable filesystem).
//
// FRESHNESS MODEL (two fetches, two cache policies — see loadData):
//   · The model LISTING (incl. all-time `all_tokens`) is a single cheap,
//     unauthenticated request → fetched LIVE on every page load, never cached.
//     So ALL-TIME token totals are always current the moment you open/refresh.
//   · The launch-window USAGE is ~131 authenticated, rate-limited management
//     calls → kept on the 24h Data Cache. A Vercel Cron (see vercel.json) pings
//     this route once a day to warm that cache even with zero organic traffic.
//
// `revalidate = 0` makes the route render per-request (so the live listing is
// re-pulled every time) while the docs guarantee a fetch with its OWN positive
// `revalidate` (the usage call) is "left as is" — i.e. still cached for 24h. Net
// per-visit cost over the old daily-ISR model: ONE extra listing round-trip, not
// 131, because the expensive usage fetch is served from the Data Cache.
//
// `pnpm tokenecon` still exists for local runs + audit snapshots under
// results/; it is no longer the source the deployed page reads.

import type { TokenEconomicsData } from "@research/token-economics/types";
import { fetchModelsApi, parseModels } from "@research/token-economics/scrape";
import { fetchAllUsage, MANAGEMENT_KEY_ENV } from "@research/token-economics/usage";
import { compute } from "@research/token-economics/compute";
import { TokenEconClient } from "./TokenEconClient";

/**
 * Render per-request (dynamic). This opts the route out of the Full Route Cache
 * so the live listing fetch below runs on every load; it does NOT force the
 * usage fetch off the Data Cache — a fetch's own positive `revalidate` survives
 * a route-level `revalidate = 0` (Next.js 16 caching model).
 */
export const revalidate = 0;

/** How long the per-model launch-window usage series stays in the Data Cache.
 *  Only this expensive, rate-limited fetch is cached (24h); the listing is live.
 *  The Vercel cron re-warms this window daily. */
const USAGE_CACHE_SECONDS = 86400;

/**
 * Fetch the live listing + per-model launch-window usage and compute the
 * economics artifact. Throws on a listing fetch/shape failure ON PURPOSE so the
 * error surfaces (and any error boundary catches it) rather than rendering an
 * empty "No data" page. Note: with the route now dynamic there is no Full Route
 * Cache to fall back on, so a listing outage shows an error instead of stale
 * HTML — the tradeoff for always-live all-time numbers.
 *
 * The launch-window usage comes from the AUTHENTICATED management endpoint
 * (one rate-limited request per model). It needs ZENMUX_MANAGEMENT_KEY in
 * the environment; if that's unset, fetchAllUsage returns an empty map and the
 * page still renders with all-time usage only (avg-daily columns show "—").
 */
async function loadData(): Promise<TokenEconomicsData> {
  // Listing (incl. all-time tokens): LIVE — `revalidate: 0` opts this single
  // request out of the Data Cache, so every page load re-pulls the latest.
  const apiModels = await fetchModelsApi(undefined, { revalidate: 0 });
  const rows = parseModels(apiModels);
  const now = new Date();
  // Usage (131 rate-limited calls): kept on the 24h Data Cache so a per-request
  // render still makes just ONE live call (the listing above).
  const usage = await fetchAllUsage(
    rows.map((r) => ({ slug: r.slug, publishTime: r.publishTime })),
    process.env[MANAGEMENT_KEY_ENV],
    { cache: { revalidate: USAGE_CACHE_SECONDS }, now },
  );
  const { data } = compute(rows, now.toISOString(), usage);
  return data;
}

export default async function TokenEconomicsPage() {
  const data = await loadData();

  // A successful fetch that yields zero priced models means the API shape
  // likely changed — surface the actionable hint rather than an empty table.
  if (data.models.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-2xl font-bold uppercase tracking-tight">
          Token Economics
        </h1>
        <p className="mt-4 text-sm text-[#6f6a5f]">
          The ZenMux listing returned no priced models. The API shape may have
          changed — inspect the response and update{" "}
          <code>research/token-economics/scrape.ts</code>.
        </p>
      </div>
    );
  }

  return <TokenEconClient data={data} />;
}
