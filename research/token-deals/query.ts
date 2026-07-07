// Token Deals（让利账本）— live aggregation over the billing DB.
//
// Mirrors the token-economics live pipeline's architecture (same DB, same env
// vars, same read-only-runtime rules) but is a fully independent copy: the PRD
// forbids touching token-economics code, and the aggregation itself is different
// (per-deal-window money math instead of anchor boards).
//
// Sources (v3): deal FACTS come from model_discount + model (./discovery.ts);
// usage/cost/subsidy come from valid_usage. Two billing families, one ledger:
//
//   PAYG（metered / fallbackMetered）— discount_amount is EXACTLY the model
//   deal on these rows (ratio = configured factor; 0 on non-deal models; full
//   list price on -free models; verified against production 2026-07-03):
//     paid += Σ bill_amount        saved += Σ discount_amount
//
//   订阅（subscription）— these rows carry no usable discount split
//   (discount_amount = full origin on EVERY model = plan coverage), and
//   per-user flow rates differ so flow_quota can't price them either. The
//   deal share is therefore computed as origin × the SAME-PERIOD per-provider
//   model_discount factor (0 for free models):
//     subPaid += Σ origin × factor  subSaved += Σ origin × (1 − factor)
//
//   point.paid / point.saved are the TOTALS of both families; subPaid/subSaved
//   ride along so the UI can split PAYG vs 订阅.
//
// Layers, cheapest first (see getTokenDealsWithMeta):
//   1. L1 in-memory cache — held until the next refresh boundary closes.
//   2. Single-flight — concurrent callers share one in-progress merge.
//   3. Packaged JSON baseline (.cache/token-deals/<range>.json, written by the
//      precompute script on a writable machine) + an incremental DB query for
//      just the tail buckets, merged in memory.
//   4. Full DB aggregation as the cold fallback; stale baseline on DB blips.
//
// Bucketing: range "all" uses 1-day buckets (a deal can run for months), range
// "72h" uses 1-hour buckets. In both cases the window's upper bound is the
// 5-minute refresh boundary — NOT a bucket boundary — so the trailing partial
// bucket grows with every poll and the hero total actually ticks live.

import fs from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import {
  DAY,
  HOUR,
  REFRESH_INTERVAL_SECONDS,
  dealsStartMs,
  floorTo,
  queryRows,
  sqlDate,
  toNumber,
} from "./db";
import { discoverDeals } from "./discovery";
import {
  DEALS_SCHEMA_VERSION,
  DEFAULT_DEAL_RANGE,
  dateStartMs,
  dealRangeOption,
  dealStatus,
  windowEndMs,
  type DealPeriod,
  type DealRangeKey,
  type DealSeries,
  type DealStats,
  type DealUsagePoint,
  type DealsTotals,
  type TokenDealsPayload,
} from "./types";

export { DealsDbConfigError, closeDealsDbPool } from "./db";

const TABLE = "valid_usage";
// Re-fetch this many trailing buckets on incremental merges so late-arriving
// billing rows (backfills) still land. 3 days / 12 hours of overlap. This deep
// sweep is for the WRITABLE scripts (precompute/backfill), which run once per
// deploy and can afford it.
const OVERLAP_BUCKETS: Record<number, number> = { [DAY]: 3, [HOUR]: 12 };
// The runtime refreshes every 5 minutes, so re-querying 3 extra days of DAY
// buckets on every poll is what pushed the healthy-path query to ~100s and
// made it timeout-prone. One trailing day is enough for rows that arrive
// minutes-to-hours late; anything later is swept up by the next deploy's
// precompute (which keeps the deep overlap above).
const RUNTIME_OVERLAP_BUCKETS: Record<number, number> = { [DAY]: 1, [HOUR]: 12 };

const CACHE_DIR_ENV = "TOKEN_DEALS_CACHE_DIR";

export function cacheDir(): string {
  return (
    process.env[CACHE_DIR_ENV]?.trim() ||
    path.join(process.cwd(), ".cache", "token-deals")
  );
}

function cachePath(range: DealRangeKey): string {
  return path.join(cacheDir(), `${range}.json`);
}

export async function readJsonCache(range: DealRangeKey): Promise<TokenDealsPayload | null> {
  try {
    const content = await fs.readFile(cachePath(range), "utf-8");
    return JSON.parse(content) as TokenDealsPayload;
  } catch {
    return null;
  }
}

let _tmpSeq = 0;

/** Atomic write (tmp → rename); only the precompute script calls this. */
export async function writeJsonCache(range: DealRangeKey, data: TokenDealsPayload): Promise<void> {
  const dir = cacheDir();
  const file = cachePath(range);
  const tmp = path.join(dir, `${range}.${process.pid}.${_tmpSeq++}.tmp`);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.writeFile(tmp, JSON.stringify(data), "utf-8");
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.unlink(tmp).catch(() => {});
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

function bucketIso(bucket: string | Date): string {
  if (bucket instanceof Date) return bucket.toISOString();
  return `${bucket.replace(" ", "T")}.000Z`;
}

/** The instant the live data should currently be advanced to: the last closed
    5-minute refresh boundary. Pure arithmetic, no IO. */
function currentDataAsOf(now: Date): number {
  return floorTo(now.getTime(), REFRESH_INTERVAL_SECONDS);
}

function msUntilNextBoundary(now: Date): number {
  const step = REFRESH_INTERVAL_SECONDS * 1000;
  return Math.max(1_000, floorTo(now.getTime(), REFRESH_INTERVAL_SECONDS) + step - now.getTime());
}

function bucketSecondsFor(range: DealRangeKey): number {
  return range === "72h" ? HOUR : DAY;
}

function bucketExpression(bucketSeconds: number): string {
  return bucketSeconds === HOUR
    ? "DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00')"
    : "DATE_FORMAT(created_at, '%Y-%m-%d 00:00:00')";
}

// ---------------------------------------------------------------------------
// DB queries — one per billing family
// ---------------------------------------------------------------------------

interface UsageRow extends RowDataPacket {
  model_slug: string;
  bucket: string | Date;
  requests: number | string;
  paid: number | string | null;
  saved: number | string | null;
  prompt_tokens: number | string | null;
  completion_tokens: number | string | null;
  reasoning_tokens: number | string | null;
}

async function queryPaygRows(params: {
  slugs: string[];
  fromMs: number;
  toMs: number;
  bucketSeconds: number;
}): Promise<UsageRow[]> {
  if (params.slugs.length === 0 || params.fromMs >= params.toMs) return [];
  const placeholders = params.slugs.map(() => "?").join(",");
  const sql = `
    SELECT
      model_slug,
      ${bucketExpression(params.bucketSeconds)} AS bucket,
      COUNT(*) AS requests,
      SUM(COALESCE(bill_amount, 0)) AS paid,
      SUM(COALESCE(discount_amount, 0)) AS saved,
      SUM(COALESCE(tokens_prompt, 0)) AS prompt_tokens,
      SUM(COALESCE(tokens_completion, 0)) AS completion_tokens,
      SUM(COALESCE(tokens_reasoning, 0)) AS reasoning_tokens
    FROM ${TABLE}
    WHERE deleted = 0
      AND billing_type IN ('metered', 'fallbackMetered')
      AND model_slug IN (${placeholders})
      AND created_at >= ?
      AND created_at < ?
    GROUP BY model_slug, bucket
    ORDER BY bucket ASC, model_slug ASC
  `;
  return queryRows<UsageRow>(sql, [...params.slugs, sqlDate(params.fromMs), sqlDate(params.toMs)]);
}

interface SubRow extends RowDataPacket {
  model_slug: string;
  provider_slug: string;
  bucket: string | Date;
  requests: number | string;
  origin: number | string | null;
  prompt_tokens: number | string | null;
  completion_tokens: number | string | null;
  reasoning_tokens: number | string | null;
}

/** Subscription usage, grouped per PROVIDER so the same-period per-provider
    factor can be applied (mimo-v2.5 runs x0.34 and x0.93 side by side). */
async function querySubRows(params: {
  slugs: string[];
  fromMs: number;
  toMs: number;
  bucketSeconds: number;
}): Promise<SubRow[]> {
  if (params.slugs.length === 0 || params.fromMs >= params.toMs) return [];
  const placeholders = params.slugs.map(() => "?").join(",");
  const sql = `
    SELECT
      model_slug,
      provider_slug,
      ${bucketExpression(params.bucketSeconds)} AS bucket,
      COUNT(*) AS requests,
      SUM(COALESCE(origin_amount, 0)) AS origin,
      SUM(COALESCE(tokens_prompt, 0)) AS prompt_tokens,
      SUM(COALESCE(tokens_completion, 0)) AS completion_tokens,
      SUM(COALESCE(tokens_reasoning, 0)) AS reasoning_tokens
    FROM ${TABLE}
    WHERE deleted = 0
      AND billing_type = 'subscription'
      AND model_slug IN (${placeholders})
      AND created_at >= ?
      AND created_at < ?
    GROUP BY model_slug, provider_slug, bucket
    ORDER BY bucket ASC, model_slug ASC
  `;
  return queryRows<SubRow>(sql, [...params.slugs, sqlDate(params.fromMs), sqlDate(params.toMs)]);
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** One (slug, bucket) of settled numbers. Baseline points reload into this
    shape as-is; fresh PAYG rows land with sub fields at 0 and get the fresh
    subscription contribution added during assembly. */
interface RawBucket {
  t: string;
  requests: number;
  paid: number;
  saved: number;
  subPaid: number;
  subSaved: number;
  promptTokens: number;
  outputTokens: number; // completion + reasoning
}

/** Fresh subscription sums per (slug, bucket, provider) — factors not yet
    applied (they depend on which deal period owns the bucket). */
interface SubBucket {
  requests: number;
  origin: number;
  promptTokens: number;
  outputTokens: number;
}
type SubRaw = Map<string, Map<string, Map<string, SubBucket>>>;

/** Buckets a deal owns within [fromMs, toMs): clipped to the deal's own window.
    Two periods of the same model never overlap (discovery merges them), so date
    clipping alone assigns every bucket to at most one period per slug. */
function dealBucketRange(deal: DealPeriod, fromMs: number, toMs: number, bucketSeconds: number) {
  const start = Math.max(dateStartMs(deal.startDate), fromMs);
  const end = Math.min(windowEndMs(deal), toMs);
  if (start >= end) return null;
  return { startMs: floorTo(start, bucketSeconds), endMs: end };
}

function assemble(params: {
  deals: DealPeriod[];
  rawBySlug: Map<string, Map<string, RawBucket>>;
  subRawBySlug: SubRaw;
  range: DealRangeKey;
  bucketSeconds: number;
  fromMs: number;
  toMs: number;
  now: Date;
  lastSuccessAt: string | null;
}): TokenDealsPayload {
  const { deals, rawBySlug, subRawBySlug, range, bucketSeconds, fromMs, toMs, now } = params;
  const stepMs = bucketSeconds * 1000;

  const series: DealSeries[] = [];
  for (const deal of deals) {
    const status = dealStatus(deal, now);
    if (status === "scheduled") continue; // registered but not shown yet (rule 1)

    const bounds = dealBucketRange(deal, fromMs, toMs, bucketSeconds);
    const byTime = rawBySlug.get(deal.slug) ?? new Map<string, RawBucket>();
    const subByTime = subRawBySlug.get(deal.slug) ?? new Map<string, Map<string, SubBucket>>();
    // Same-period per-provider factor; free deals subsidize 100% (factor 0).
    const factorFor = (provider: string): number => {
      if (deal.dealType === "free") return 0;
      return deal.providers.find((p) => p.slug === provider)?.discount ?? deal.discount;
    };

    const points: DealUsagePoint[] = [];
    const stats: DealStats = {
      tokens: 0,
      promptTokens: 0,
      outputTokens: 0,
      requests: 0,
      paid: 0,
      saved: 0,
      subPaid: 0,
      subSaved: 0,
    };

    if (bounds) {
      for (let t = bounds.startMs; t < bounds.endMs; t += stepMs) {
        const iso = new Date(t).toISOString();
        const raw = byTime.get(iso);
        let promptTokens = raw?.promptTokens ?? 0;
        let outputTokens = raw?.outputTokens ?? 0;
        let requests = raw?.requests ?? 0;
        let subPaid = raw?.subPaid ?? 0;
        let subSaved = raw?.subSaved ?? 0;

        const freshSub = subByTime.get(iso);
        if (freshSub) {
          for (const [provider, sub] of freshSub) {
            const factor = factorFor(provider);
            subPaid += sub.origin * factor;
            subSaved += sub.origin * (1 - factor);
            promptTokens += sub.promptTokens;
            outputTokens += sub.outputTokens;
            requests += sub.requests;
          }
        }

        // paid/saved are family totals. `raw` holds either a fresh PAYG bucket
        // (sub fields 0) or a settled baseline bucket (sub share included in
        // paid/saved AND recorded in subPaid/subSaved) — so the PAYG share is
        // always raw.paid − raw.subPaid, and the total re-adds the up-to-date
        // subscription share computed above.
        const paid = (raw?.paid ?? 0) - (raw?.subPaid ?? 0) + subPaid;
        const saved = (raw?.saved ?? 0) - (raw?.subSaved ?? 0) + subSaved;

        const tokens = promptTokens + outputTokens;
        points.push({ t: iso, tokens, promptTokens, outputTokens, requests, paid, saved, subPaid, subSaved });
        stats.tokens += tokens;
        stats.promptTokens += promptTokens;
        stats.outputTokens += outputTokens;
        stats.requests += requests;
        stats.paid += paid;
        stats.saved += saved;
        stats.subPaid += subPaid;
        stats.subSaved += subSaved;
      }
    }

    // A hidden/removed free model that never saw a request inside the window
    // is catalog noise, not a deal — drop it. (Visible free models stay even
    // at zero usage: they ARE claimable offers.)
    if (deal.dealType === "free" && deal.delisted && stats.requests === 0) continue;

    series.push({ ...deal, status, stats, points });
  }

  // Default order: SAVED desc, ties by deeper discount first (rule 6). The
  // client re-sorts for its toggles; this is the canonical baseline order.
  series.sort((a, b) => (b.stats?.saved ?? 0) - (a.stats?.saved ?? 0) || a.discount - b.discount);

  const active = series.filter((d) => d.status === "active");
  const totals: DealsTotals = {
    saved: series.reduce((sum, d) => sum + (d.stats?.saved ?? 0), 0),
    paid: series.reduce((sum, d) => sum + (d.stats?.paid ?? 0), 0),
    tokens: series.reduce((sum, d) => sum + (d.stats?.tokens ?? 0), 0),
    subSaved: series.reduce((sum, d) => sum + (d.stats?.subSaved ?? 0), 0),
    subPaid: series.reduce((sum, d) => sum + (d.stats?.subPaid ?? 0), 0),
    weightedDiscount: weightedDiscount(active),
  };

  return compactDealsPayload({
    schema: DEALS_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    refreshIntervalSeconds: REFRESH_INTERVAL_SECONDS,
    range,
    bucketSeconds,
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    live: true,
    lastSuccessAt: params.lastSuccessAt,
    activeCount: active.length,
    endedCount: series.filter((d) => d.status === "ended").length,
    totals,
    deals: series,
  });
}

// ---------------------------------------------------------------------------
// Payload compaction — the points arrays are ~95% of the JSON, and the money
// floats inside them carry 15+ digits of double noise ($0.023999999999999997).
// Sub-cent precision is far below anything the UI renders, but rounding is
// still capped at 4 decimals so a young deal's first fractions of a cent don't
// flatten to zero. Applied at assembly (so persisted baselines shrink too) and
// available standalone for legacy baselines read off disk.
// ---------------------------------------------------------------------------

const MONEY_DECIMALS = 4;

function roundMoney(n: number): number {
  return Number(n.toFixed(MONEY_DECIMALS));
}

function compactPoint(p: DealUsagePoint): DealUsagePoint {
  return {
    ...p,
    paid: roundMoney(p.paid),
    saved: roundMoney(p.saved),
    subPaid: roundMoney(p.subPaid),
    subSaved: roundMoney(p.subSaved),
  };
}

function compactStats(s: DealStats): DealStats {
  return {
    ...s,
    paid: roundMoney(s.paid),
    saved: roundMoney(s.saved),
    subPaid: roundMoney(s.subPaid),
    subSaved: roundMoney(s.subSaved),
  };
}

/** Round every money field in the payload to MONEY_DECIMALS. Idempotent. */
export function compactDealsPayload(payload: TokenDealsPayload): TokenDealsPayload {
  return {
    ...payload,
    totals: payload.totals
      ? {
          ...payload.totals,
          saved: roundMoney(payload.totals.saved),
          paid: roundMoney(payload.totals.paid),
          subSaved: roundMoney(payload.totals.subSaved),
          subPaid: roundMoney(payload.totals.subPaid),
        }
      : null,
    deals: payload.deals.map((deal) => ({
      ...deal,
      stats: deal.stats ? compactStats(deal.stats) : null,
      points: deal.points ? deal.points.map(compactPoint) : null,
    })),
  };
}

/** Saved-weighted mean discount across active PAID deals; plain mean before any
    usage lands (all weights zero). Free deals (discount 0) are excluded so they
    can't drag the "average discount" stat to a meaningless number. */
function weightedDiscount(active: DealSeries[]): number | null {
  const paid = active.filter((d) => d.dealType !== "free");
  if (paid.length === 0) return null;
  const totalSaved = paid.reduce((sum, d) => sum + (d.stats?.saved ?? 0), 0);
  if (totalSaved <= 0) {
    return paid.reduce((sum, d) => sum + d.discount, 0) / paid.length;
  }
  return paid.reduce((sum, d) => sum + d.discount * (d.stats?.saved ?? 0), 0) / totalSaved;
}

function rangeWindow(range: DealRangeKey, deals: DealPeriod[], dataAsOfMs: number) {
  const bucketSeconds = bucketSecondsFor(range);
  const earliest = Math.min(...deals.map((d) => dateStartMs(d.startDate)), dataAsOfMs);
  const hours = dealRangeOption(range).hours;
  const rawFrom = hours == null ? earliest : Math.max(earliest, dataAsOfMs - hours * 3_600_000);
  // Nothing before the ledger opened (ZenMux launch) is ever windowed in.
  const clampedFrom = Math.max(rawFrom, dealsStartMs());
  return { bucketSeconds, fromMs: floorTo(clampedFrom, bucketSeconds), toMs: dataAsOfMs };
}

/** Slugs whose deal windows actually intersect [fromMs, toMs) — the DB is only
    ever asked about registered deal periods (a discount model's history outside
    its window is deliberately never pulled). */
function slugsInWindow(deals: DealPeriod[], fromMs: number, toMs: number, bucketSeconds: number): string[] {
  return uniqueSlugs(deals.filter((d) => dealBucketRange(d, fromMs, toMs, bucketSeconds) != null));
}

function paygRowsToMap(rows: UsageRow[], into?: Map<string, Map<string, RawBucket>>): Map<string, Map<string, RawBucket>> {
  const bySlug = into ?? new Map<string, Map<string, RawBucket>>();
  for (const row of rows) {
    const t = bucketIso(row.bucket);
    const byTime = bySlug.get(row.model_slug) ?? new Map<string, RawBucket>();
    byTime.set(t, {
      t,
      requests: toNumber(row.requests),
      paid: toNumber(row.paid),
      saved: toNumber(row.saved),
      subPaid: 0,
      subSaved: 0,
      promptTokens: toNumber(row.prompt_tokens),
      outputTokens: toNumber(row.completion_tokens) + toNumber(row.reasoning_tokens),
    });
    bySlug.set(row.model_slug, byTime);
  }
  return bySlug;
}

function subRowsToMap(rows: SubRow[], into?: SubRaw): SubRaw {
  const bySlug = into ?? new Map();
  for (const row of rows) {
    const t = bucketIso(row.bucket);
    const byTime = bySlug.get(row.model_slug) ?? new Map<string, Map<string, SubBucket>>();
    const byProvider = byTime.get(t) ?? new Map<string, SubBucket>();
    const prev = byProvider.get(row.provider_slug) ?? {
      requests: 0,
      origin: 0,
      promptTokens: 0,
      outputTokens: 0,
    };
    prev.requests += toNumber(row.requests);
    prev.origin += toNumber(row.origin);
    prev.promptTokens += toNumber(row.prompt_tokens);
    prev.outputTokens += toNumber(row.completion_tokens) + toNumber(row.reasoning_tokens);
    byProvider.set(row.provider_slug, prev);
    byTime.set(t, byProvider);
    bySlug.set(row.model_slug, byTime);
  }
  return bySlug;
}

function uniqueSlugs(deals: DealPeriod[]): string[] {
  return [...new Set(deals.map((d) => d.slug))];
}

/** Full re-aggregation straight from the DB (cold path / precompute). */
export async function fetchTokenDeals(
  requestedRange: string | null | undefined,
  now = new Date(),
  options: { persist?: boolean } = {},
): Promise<TokenDealsPayload> {
  const range = dealRangeOption(requestedRange).key;
  const deals = await discoverDeals();
  const dataAsOfMs = currentDataAsOf(now);
  const { bucketSeconds, fromMs, toMs } = rangeWindow(range, deals, dataAsOfMs);
  const slugs = slugsInWindow(deals, fromMs, toMs, bucketSeconds);

  const [paygRows, subRows] = await Promise.all([
    queryPaygRows({ slugs, fromMs, toMs, bucketSeconds }),
    querySubRows({ slugs, fromMs, toMs, bucketSeconds }),
  ]);

  const payload = assemble({
    deals,
    rawBySlug: paygRowsToMap(paygRows),
    subRawBySlug: subRowsToMap(subRows),
    range,
    bucketSeconds,
    fromMs,
    toMs,
    now,
    lastSuccessAt: now.toISOString(),
  });

  if (options.persist) await writeJsonCache(range, payload);
  return payload;
}

export interface IncrementalOptions {
  persist?: boolean;
  /** Cap on how far back a deal that's missing from the baseline may be
      queried. The serverless runtime keeps the default (a long-history entry
      newly added to the config must be backfilled on a writable machine, not
      cold-queried in a request); scripts pass Infinity. */
  maxNewDealLookbackMs?: number;
  /** Skip the "tail > 50% of the window" bail-out. Only the backfill script
      sets this — it advances a young baseline chunk by chunk, where the tail
      legitimately dwarfs the window. */
  allowLargeTail?: boolean;
  /** Runtime self-healing: merge at most this much NEW tail per call. When the
      baseline has fallen further behind, the merge stops at the cap and returns
      a payload whose `to` is short of the current boundary — the caller marks
      it stale, the client re-polls, and the next call continues from there, so
      an arbitrarily old baseline converges in bounded steps instead of one
      monster query that times out and never advances (the 2026-07-05 lockup).
      Setting this also switches to RUNTIME_OVERLAP_BUCKETS (shallow overlap)
      and disables the 50% bail-out — a runtime "all" merge has no full-fetch
      alternative, so chunking must always proceed. */
  maxTailMs?: number;
}

/** Runtime default: a brand-new deal's cold query never reaches back more
    than ~5 weeks inside a serverless request. */
const DEFAULT_NEW_DEAL_LOOKBACK_MS = 35 * DAY * 1000;

/** Baseline + incremental merge: reuse the packaged payload's old buckets and
    query the DB only for the tail (baseline.to − overlap → now). Deals that
    appeared AFTER the baseline was packaged (new config entries) get their
    window fetched up to the lookback cap. Returns null when the baseline isn't
    usable. Exported for the precompute + backfill scripts. */
export async function incrementallyUpdate(
  range: DealRangeKey,
  baseline: TokenDealsPayload,
  now = new Date(),
  options: IncrementalOptions = {},
): Promise<TokenDealsPayload | null> {
  // Older-schema baselines carry different money semantics — not extendable.
  if (baseline.schema !== DEALS_SCHEMA_VERSION) return null;

  const deals = await discoverDeals();
  const dataAsOfMs = currentDataAsOf(now);
  const { bucketSeconds, fromMs, toMs } = rangeWindow(range, deals, dataAsOfMs);
  if (baseline.bucketSeconds !== bucketSeconds) return null;

  const baselineTo = Date.parse(baseline.to);
  if (Number.isNaN(baselineTo)) return null;
  if (baselineTo >= toMs) {
    const payload = { ...baseline, generatedAt: now.toISOString() };
    if (options.persist) await writeJsonCache(range, payload);
    return payload;
  }

  // Capped merges (runtime self-heal) stop the target short of the boundary
  // when the baseline is far behind — the DB is only ever asked for a bounded
  // span, and the caller loops/re-polls until `to` catches up. floorTo keeps
  // the intermediate `to` on a refresh boundary so the resulting payload obeys
  // the same invariants as an uncapped one.
  const capped = options.maxTailMs != null && toMs - baselineTo > options.maxTailMs;
  const effectiveToMs = capped
    ? floorTo(baselineTo + options.maxTailMs!, REFRESH_INTERVAL_SECONDS)
    : toMs;

  const overlapBuckets = options.maxTailMs != null ? RUNTIME_OVERLAP_BUCKETS : OVERLAP_BUCKETS;
  const overlapMs = (overlapBuckets[bucketSeconds] ?? 3) * bucketSeconds * 1000;
  const incFromMs = Math.max(fromMs, floorTo(baselineTo, bucketSeconds) - overlapMs);
  // A tail bigger than half the window buys nothing over a full fetch — but a
  // capped merge has no full-fetch alternative (the runtime must converge in
  // chunks), so the bail-out only applies to uncapped merges.
  if (
    !options.allowLargeTail &&
    options.maxTailMs == null &&
    toMs - incFromMs > (toMs - fromMs) * 0.5
  )
    return null;

  // Split slugs: ones the baseline has buckets for get a tail query; brand-new
  // ones (no baseline series) need their window (capped by the lookback).
  // Either way only slugs whose deal windows intersect the queried span are
  // sent to the DB — deal periods are the only spans ever pulled.
  const baselineSlugs = new Set(baseline.deals.map((d) => d.slug));
  const knownDeals: DealPeriod[] = [];
  const newDeals: DealPeriod[] = [];
  for (const deal of deals) {
    (baselineSlugs.has(deal.slug) ? knownDeals : newDeals).push(deal);
  }
  const knownSlugs = slugsInWindow(knownDeals, incFromMs, effectiveToMs, bucketSeconds);
  const lookbackMs = options.maxNewDealLookbackMs ?? DEFAULT_NEW_DEAL_LOOKBACK_MS;
  const newFromMs =
    newDeals.length > 0
      ? Math.max(
          fromMs,
          Number.isFinite(lookbackMs)
            ? floorTo(effectiveToMs - lookbackMs, bucketSeconds)
            : fromMs,
          floorTo(Math.min(...newDeals.map((d) => dateStartMs(d.startDate))), bucketSeconds),
        )
      : incFromMs;
  const newSlugs = slugsInWindow(newDeals, newFromMs, effectiveToMs, bucketSeconds);

  const [tailPayg, tailSub, newPayg, newSub] = await Promise.all([
    queryPaygRows({ slugs: knownSlugs, fromMs: incFromMs, toMs: effectiveToMs, bucketSeconds }),
    querySubRows({ slugs: knownSlugs, fromMs: incFromMs, toMs: effectiveToMs, bucketSeconds }),
    queryPaygRows({ slugs: newSlugs, fromMs: newFromMs, toMs: effectiveToMs, bucketSeconds }),
    querySubRows({ slugs: newSlugs, fromMs: newFromMs, toMs: effectiveToMs, bucketSeconds }),
  ]);

  // Rebuild the raw per-slug map: baseline buckets before the incremental
  // window (their subscription share is already settled into subPaid/subSaved)
  // + fresh buckets inside it. This is lossless — every point is additive, and
  // each (slug, bucket) belongs to exactly one period per slug.
  const rawBySlug = new Map<string, Map<string, RawBucket>>();
  for (const deal of baseline.deals) {
    if (!deal.points) return null; // degraded baseline → full fetch
    const byTime = rawBySlug.get(deal.slug) ?? new Map<string, RawBucket>();
    for (const p of deal.points) {
      if (Date.parse(p.t) >= incFromMs) continue;
      if (p.tokens === 0 && p.paid === 0 && p.requests === 0) continue;
      byTime.set(p.t, {
        t: p.t,
        requests: p.requests,
        paid: p.paid,
        saved: p.saved,
        subPaid: p.subPaid,
        subSaved: p.subSaved,
        promptTokens: p.promptTokens,
        outputTokens: p.outputTokens,
      });
    }
    rawBySlug.set(deal.slug, byTime);
  }
  paygRowsToMap(tailPayg, rawBySlug);
  paygRowsToMap(newPayg, rawBySlug);
  const subRawBySlug = subRowsToMap(tailSub);
  subRowsToMap(newSub, subRawBySlug);

  // A capped merge's payload honestly ends at effectiveToMs — its `to` is what
  // tells the caller (and the next merge) how far the ledger actually advanced.
  const payload = assemble({
    deals,
    rawBySlug,
    subRawBySlug,
    range,
    bucketSeconds,
    fromMs,
    toMs: effectiveToMs,
    now,
    lastSuccessAt: now.toISOString(),
  });
  if (options.persist) await writeJsonCache(range, payload);
  return payload;
}

// ---------------------------------------------------------------------------
// Degraded payload — deal facts from the freshest packaged baseline, no money
// numbers. (Deal discovery lives in the DB now, so when the DB is down the
// baseline is the only fact source left; with no baseline the page shows its
// error panel and retries.)
// ---------------------------------------------------------------------------

let lastSuccessAt: string | null = null;

export async function buildDegradedPayload(now = new Date()): Promise<TokenDealsPayload> {
  // Only a same-schema baseline is safe to surface — an older baseline's deals
  // lack fields the client relies on (dealType/providers/sub split).
  const candidates = [await readJsonCache("all"), await readJsonCache("72h")];
  const baseline = candidates.find((b) => b?.schema === DEALS_SCHEMA_VERSION) ?? null;
  const dataAsOfMs = currentDataAsOf(now);
  const visible: DealSeries[] = (baseline?.deals ?? [])
    .map(
      (deal): DealSeries => ({
        ...deal,
        status: dealStatus(deal, now),
        stats: null,
        points: null,
      }),
    )
    .filter((d) => d.status !== "scheduled");
  // Deepest discount first — with no SAVED to rank by, rule 6's tiebreak is the order.
  visible.sort((a, b) => a.discount - b.discount);
  return {
    schema: DEALS_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    refreshIntervalSeconds: REFRESH_INTERVAL_SECONDS,
    range: DEFAULT_DEAL_RANGE,
    bucketSeconds: DAY,
    from: new Date(dataAsOfMs).toISOString(),
    to: new Date(dataAsOfMs).toISOString(),
    live: false,
    lastSuccessAt: lastSuccessAt ?? baseline?.lastSuccessAt ?? null,
    activeCount: visible.filter((d) => d.status === "active").length,
    endedCount: visible.filter((d) => d.status === "ended").length,
    totals: null,
    deals: visible,
  };
}

// ---------------------------------------------------------------------------
// Runtime entry (read-only FS safe): L1 → baseline (stale-while-revalidate) →
// full fetch. An expired baseline is served IMMEDIATELY (marked `stale`) while
// a single-flight DB refresh runs; the request only waits SWR_WAIT_MS for it,
// so first-byte never blocks on the DB. On serverless the instance may freeze
// after responding — the unfinished refresh promise simply resumes on the next
// invocation (the client re-polls stale payloads after ~20s), so the refresh
// still lands without any background-execution guarantee.
// ---------------------------------------------------------------------------

export type DealsFetchSource =
  | "l1-memory"
  | "baseline-fresh"
  | "single-flight"
  | "incremental-db"
  | "stale-swr"
  | "stale-baseline"
  | "degraded-no-baseline"
  | "full-db";

const responseCache = new Map<string, { data: TokenDealsPayload; expiresAt: number }>();
const inFlight = new Map<string, Promise<{ payload: TokenDealsPayload; source: DealsFetchSource }>>();

/** How long a request waits for the in-flight refresh before answering with
    the stale baseline. Long enough for a warm incremental query to win the
    race; short enough that a cold DB connection never holds first-byte. */
const SWR_WAIT_MS = 1_200;
/** L1 TTL for stale/degraded payloads — short so recovery is retried quickly. */
const STALE_TTL_MS = 10_000;
/** Runtime merge cap: at most one day of NEW tail per refresh. Sized so the
    worst single query (1-day tail + 1-day runtime overlap, all slugs) stays
    well inside the DB timeout. A baseline that's further behind converges one
    capped chunk per client poll (stale → 20s re-poll) instead of attempting a
    monster query that times out forever. */
const RUNTIME_MAX_TAIL_MS = DAY * 1000;

export interface DealsFetchResult {
  payload: TokenDealsPayload;
  source: DealsFetchSource;
  elapsedMs: number;
}

function cachePayload(range: DealRangeKey, payload: TokenDealsPayload): void {
  const healthy = payload.live && !payload.stale;
  const ttlMs = healthy ? msUntilNextBoundary(new Date()) : STALE_TTL_MS;
  responseCache.set(range, { data: payload, expiresAt: Date.now() + ttlMs });
}

/** The actual refresh work — everything that may touch the DB lives here.
    Runs at most once per range at a time (single-flight via `inFlight`). */
async function refreshPayload(
  range: DealRangeKey,
  baseline: TokenDealsPayload | null,
  now: Date,
): Promise<{ payload: TokenDealsPayload; source: DealsFetchSource }> {
  if (baseline) {
    // Chunked self-heal applies to "all" only: its window start is fixed, so a
    // capped target always lands inside it, and it's the only range with no
    // full-fetch fallback. 72h keeps the plain merge — its window slides (a
    // capped target could fall before the window start) and its full fetch is
    // small enough to be the recovery path.
    const merged = await incrementallyUpdate(
      range,
      baseline,
      now,
      range === "all" ? { maxTailMs: RUNTIME_MAX_TAIL_MS } : {},
    );
    if (merged) {
      // A capped merge that stopped short of the current boundary is progress,
      // not the final answer — mark it stale so the client re-polls (~20s) and
      // the next refresh continues from the advanced `to`. The self-heal loop.
      if (Date.parse(merged.to) < currentDataAsOf(now)) {
        return { payload: { ...merged, stale: true }, source: "incremental-db" };
      }
      return { payload: merged, source: "incremental-db" };
    }
  }
  // The "all" window spans the whole ledger (2025-09-29 → now) — a full
  // aggregation of it must never run inside a serverless request. Keep the
  // stale baseline if there is one; otherwise degrade and let a writable
  // machine rebuild via tokendeals:backfill / the predeploy precompute.
  if (range === "all") {
    if (baseline) return { payload: { ...baseline, stale: true }, source: "stale-baseline" };
    console.warn(
      "[token-deals] No usable 'all' baseline — serving degraded payload. Run `pnpm tokendeals:backfill` on a writable machine.",
    );
    return { payload: await buildDegradedPayload(now), source: "degraded-no-baseline" };
  }
  return { payload: await fetchTokenDeals(range, now), source: "full-db" };
}

export async function getTokenDealsWithMeta(
  requestedRange: string | null | undefined,
  now = new Date(),
): Promise<DealsFetchResult> {
  const startedAt = Date.now();
  const range = dealRangeOption(requestedRange).key;

  const cached = responseCache.get(range);
  if (cached && Date.now() < cached.expiresAt) {
    return {
      payload: { ...cached.data, generatedAt: now.toISOString() },
      source: "l1-memory",
      elapsedMs: Date.now() - startedAt,
    };
  }

  const raw = await readJsonCache(range);
  // compact: a baseline written before money rounding carries full-precision
  // floats; rounding here keeps every serve path small. Idempotent.
  const diskBaseline =
    raw?.live && raw.schema === DEALS_SCHEMA_VERSION && !Number.isNaN(Date.parse(raw.to))
      ? compactDealsPayload(raw)
      : null;

  // The packaged file never advances on the read-only FS, so on its own every
  // refresh would re-query `disk.to → now` — a window that grows with deploy
  // age until it times out (the 2026-07-05 lockup). The L1 entry outlives its
  // TTL in the map, so the last successful merge doubles as an in-memory
  // baseline: take the freshest of the two and each refresh only queries since
  // the LAST MERGE. Lost on instance recycle — that just falls back to disk.
  // Stale-marked entries are still valid baselines (a capped self-heal chunk
  // is marked stale precisely so the client re-polls — its points are real
  // merged data), but the flag must not ride along: whether THIS response is
  // stale is re-decided below from how far the merge gets.
  const expired = responseCache.get(range)?.data;
  const memBaseline =
    expired?.live &&
    expired.schema === DEALS_SCHEMA_VERSION &&
    expired.deals.every((d) => d.points != null) &&
    !Number.isNaN(Date.parse(expired.to))
      ? { ...expired, stale: undefined }
      : null;
  const baseline =
    memBaseline && (!diskBaseline || Date.parse(memBaseline.to) > Date.parse(diskBaseline.to))
      ? memBaseline
      : diskBaseline;

  // Fresh packaged baseline → pure file read, no DB, no waiting.
  if (baseline && Date.parse(baseline.to) >= currentDataAsOf(now)) {
    lastSuccessAt = baseline.lastSuccessAt ?? lastSuccessAt;
    cachePayload(range, baseline);
    return { payload: baseline, source: "baseline-fresh", elapsedMs: Date.now() - startedAt };
  }

  // Start (or join) the single-flight refresh. Completion always lands in L1
  // even if this request stops waiting for it below.
  const joined = inFlight.has(range);
  let work = inFlight.get(range);
  if (!work) {
    work = refreshPayload(range, baseline, now)
      .then((result) => {
        if (result.payload.live) lastSuccessAt = result.payload.lastSuccessAt ?? lastSuccessAt;
        cachePayload(range, result.payload);
        return result;
      })
      .finally(() => inFlight.delete(range));
    // A refresh that fails AFTER the requester stopped waiting (SWR timeout)
    // has no awaiter left — log it here so it never becomes an unhandled
    // rejection. Requests racing `work` attach their own .catch.
    work.catch((err) =>
      console.warn(
        `[token-deals] Background refresh for ${range} failed:`,
        err instanceof Error ? err.message : err,
      ),
    );
    inFlight.set(range, work);
  }

  if (baseline) {
    // Stale-while-revalidate: give the refresh a short head start, then answer
    // with the stale baseline. `work` keeps its own error path — a rejection
    // here just means "serve stale now, retry on the next poll".
    let timer: ReturnType<typeof setTimeout> | undefined;
    const winner = await Promise.race([
      work.catch(() => null),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), SWR_WAIT_MS);
      }),
    ]).finally(() => clearTimeout(timer));

    if (winner != null && winner !== "timeout") {
      return {
        payload: winner.payload,
        source: joined ? "single-flight" : winner.source,
        elapsedMs: Date.now() - startedAt,
      };
    }
    if (winner == null) {
      console.warn(`[token-deals] Refresh for ${range} failed, serving stale baseline.`);
    }
    const stalePayload: TokenDealsPayload = { ...baseline, stale: true };
    cachePayload(range, stalePayload);
    return {
      payload: stalePayload,
      source: winner == null ? "stale-baseline" : "stale-swr",
      elapsedMs: Date.now() - startedAt,
    };
  }

  // No usable baseline at all — nothing to answer with but the refresh itself.
  const { payload, source } = await work;
  return {
    payload,
    source: joined ? "single-flight" : source,
    elapsedMs: Date.now() - startedAt,
  };
}
