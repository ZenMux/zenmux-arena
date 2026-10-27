import { API_URL, fetchModelsApi, parseModels } from "@research/token-economics/scrape";
import { fetchAllUsage, MANAGEMENT_KEY_ENV } from "@research/token-economics/usage";
import { compute } from "@research/token-economics/compute";
import type { EconomicsResponse } from "../types";

// Keep identical source, parsing, concurrency, window and computation policies
// to token-economics/page.tsx. In particular, force-dynamic would disable the
// expensive per-model fetch cache; the route uses revalidate=0 instead.
export const USAGE_CACHE_SECONDS = 86400;

export async function loadEconomicsData(): Promise<EconomicsResponse> {
  const apiModels = await fetchModelsApi(undefined, { revalidate: 0 });
  const rows = parseModels(apiModels);
  const now = new Date();
  const key = process.env[MANAGEMENT_KEY_ENV];
  const usage = await fetchAllUsage(
    rows.map((r) => ({ slug: r.slug, publishTime: r.publishTime })),
    key,
    { cache: { revalidate: USAGE_CACHE_SECONDS }, now },
  );
  const { data } = compute(rows, now.toISOString(), usage);
  if (data.models.length === 0) throw new Error("Empty model listing");

  const observed = [...usage.values()].filter((entry) => entry.series.length > 0);
  const dates = observed.flatMap((entry) => entry.series.map((point) => point.date)).sort();
  return {
    data,
    provenance: {
      listingSource: API_URL,
      listingRetrievedAt: now.toISOString(),
      usageSource: "ZenMux Management · model daily usage",
      usageCacheSeconds: USAGE_CACHE_SECONDS,
      latestObservedUsageDate: dates.at(-1) ?? null,
      observedModels: observed.length,
      requestedModels: usage.size,
      managementConfigured: Boolean(key),
    },
  };
}
