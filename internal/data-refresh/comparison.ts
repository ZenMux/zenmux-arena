import { API_URL, fetchModelsApi, parseModels } from "@research/token-economics/scrape";
import { fetchAllUsage, MANAGEMENT_API_KEY_ENV } from "@research/token-economics/usage";
import { compute } from "@research/token-economics/compute";
import { COMPARISON_REFRESH_SECONDS, type ComparisonSnapshot } from "@research/token-economics/comparison-snapshot";

export async function buildComparison(now = new Date()): Promise<ComparisonSnapshot> {
  const key = process.env[MANAGEMENT_API_KEY_ENV]?.trim();
  if (!key) throw new Error(`Missing ${MANAGEMENT_API_KEY_ENV}.`);
  const rows = parseModels(await fetchModelsApi());
  if (!rows.length) throw new Error("Model listing returned no priced models.");
  const usage = await fetchAllUsage(rows.map(r => ({ slug: r.slug, publishTime: r.publishTime })), key, { now, strict: true });
  const { data } = compute(rows, now.toISOString(), usage);
  if (!data.models.length) throw new Error("Comparison aggregation returned no models.");
  const observed = [...usage.values()].filter(entry => entry.series.length > 0);
  const dates = observed.flatMap(entry => entry.series.map(point => point.date)).sort();
  return {
    range: "all", from: now.toISOString(), to: now.toISOString(), generatedAt: now.toISOString(),
    bucketSeconds: COMPARISON_REFRESH_SECONDS, refreshIntervalSeconds: COMPARISON_REFRESH_SECONDS,
    data,
    provenance: {
      listingSource: API_URL, listingRetrievedAt: now.toISOString(),
      usageSource: "ZenMux model daily usage", usageCacheSeconds: COMPARISON_REFRESH_SECONDS,
      latestObservedUsageDate: dates.at(-1) ?? null,
      observedModels: observed.length, requestedModels: usage.size, usageAvailable: true,
    },
  };
}
