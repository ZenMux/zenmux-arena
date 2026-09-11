import type { LiveModelSeries, LiveTokenEconomicsPayload, LiveUsagePoint } from "@research/token-economics/live-config";

export const HISTORY_FROM = "2026-06-23T00:00:00.000Z";
export const HISTORY_TO = "2026-08-24T00:00:00.000Z";
export const HISTORY_END_DATE = "2026-08-23";
const DAY_MS = 86_400_000;
const METRICS = ["tokens", "cost", "requests", "promptTokens", "completionTokens", "reasoningTokens"] as const;

/** Strict interval selection. Missing/duplicate/unaligned observations fail;
 * source zeros survive unchanged, but this function never fills a gap. */
export function selectHistoricalWindow(
  source: LiveTokenEconomicsPayload,
  from = HISTORY_FROM,
  to = HISTORY_TO,
): { payload: LiveTokenEconomicsPayload; days: number; coverage: { slug: string; first: string; last: string; days: number }[] } {
  const start = Date.parse(from), end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || start % DAY_MS || end % DAY_MS) {
    throw new Error("History requires a non-empty UTC midnight interval [from, to).");
  }
  if (source.range !== "all" || source.bucketSeconds !== 86400) throw new Error("History requires the persisted ALL daily snapshot.");
  if (!Number.isFinite(Date.parse(source.from)) || !Number.isFinite(Date.parse(source.to))
    || Date.parse(source.from) > start || Date.parse(source.to) < end) {
    throw new Error("Source coverage does not contain the complete historical interval.");
  }
  const expected = Array.from({ length: (end - start) / DAY_MS }, (_, i) => start + i * DAY_MS);
  const coverage: { slug: string; first: string; last: string; days: number }[] = [];
  const seen = new Set<string>();

  const selectModel = (model: LiveModelSeries): LiveModelSeries => {
    if (seen.has(model.slug)) throw new Error(`Duplicate model: ${model.slug}`);
    seen.add(model.slug);
    if (model.points.some((point) => !Number.isFinite(Date.parse(point.t)))) throw new Error(`Invalid timestamp: ${model.slug}`);
    const points = model.points.filter((point) => Date.parse(point.t) >= start && Date.parse(point.t) < end)
      .map((point) => ({ ...point })).sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
    if (points.length !== expected.length || points.some((point, i) => Date.parse(point.t) !== expected[i])) {
      throw new Error(`Missing, duplicate or unaligned daily observations: ${model.slug}`);
    }
    if (points.some((point) => METRICS.some((key) => !Number.isFinite(point[key])))) throw new Error(`Invalid metric: ${model.slug}`);
    const sum = (key: keyof Omit<LiveUsagePoint, "t">) => points.reduce((total, point) => total + point[key], 0);
    coverage.push({ slug: model.slug, first: points[0].t, last: points.at(-1)!.t, days: points.length });
    return {
      ...model, points,
      totalTokens: sum("tokens"), totalCost: sum("cost"), totalRequests: sum("requests"),
      latestTokens: points.at(-1)!.tokens, latestCost: points.at(-1)!.cost,
      peakTokens: Math.max(0, ...points.map((point) => point.tokens)),
      peakCost: Math.max(0, ...points.map((point) => point.cost)),
    };
  };

  const anchors = source.anchors.map((anchor) => {
    const models = anchor.models.map(selectModel).sort((a, b) => b.totalTokens - a.totalTokens || a.model.localeCompare(b.model));
    if (!models.length) throw new Error(`Empty anchor: ${anchor.id}`);
    return {
      ...anchor, models,
      totalTokens: models.reduce((sum, model) => sum + model.totalTokens, 0),
      totalCost: models.reduce((sum, model) => sum + model.totalCost, 0),
      totalRequests: models.reduce((sum, model) => sum + model.totalRequests, 0),
      // Preserve live-query's peak-of-one-model bucket definition.
      peakTokens: Math.max(0, ...models.map((model) => model.peakTokens)),
      peakCost: Math.max(0, ...models.map((model) => model.peakCost)),
    };
  });
  const unanchored = source.unanchored.map(selectModel);
  if (!anchors.length || !coverage.length) throw new Error("No historical observations.");
  return { payload: { ...source, from, to, anchors, unanchored }, days: expected.length, coverage };
}
