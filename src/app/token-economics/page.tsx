// Token Economics — the landing surface. Server component that fetches the
// ZenMux model-listing API at request time and derives the economics artifact
// on the fly (research/token-economics/{scrape,compute} are pure functions, no
// disk writes — safe on Vercel's read-only/immutable filesystem).
//
// ISR: the rendered page is cached and revalidated daily, so a freshly listed
// model shows up within ~24h WITHOUT a redeploy or a manual `pnpm tokenecon`.
// A Vercel Cron (see vercel.json) pings this route once a day so the cache
// refreshes even with zero organic traffic. Daily cadence keeps it within the
// Hobby-plan cron limit (max once/day) and aligns cron with the ISR window.
//
// `pnpm tokenecon` still exists for local runs + audit snapshots under
// results/; it is no longer the source the deployed page reads.

import type { TokenEconomicsData } from "@research/token-economics/types";
import { fetchModelsApi, parseModels } from "@research/token-economics/scrape";
import { compute } from "@research/token-economics/compute";
import { TokenEconClient } from "./TokenEconClient";

/** Revalidate the cached render once a day (86400s). */
export const revalidate = 86400;

/**
 * Fetch the live listing and compute the economics artifact. Throws on a
 * fetch/shape failure ON PURPOSE: a thrown render lets Next.js keep serving the
 * last good ISR cache (stale-but-correct) instead of overwriting it with an
 * empty "No data" page. `fetchModelsApi` carries its own `next.revalidate` so
 * the underlying Data Cache stays in lockstep with this page's revalidate.
 */
async function loadData(): Promise<TokenEconomicsData> {
  const apiModels = await fetchModelsApi(undefined, { revalidate });
  const rows = parseModels(apiModels);
  const { data } = compute(rows, new Date().toISOString());
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
