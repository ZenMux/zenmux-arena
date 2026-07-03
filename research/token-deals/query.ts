// Token Deals（让利账本）— live aggregation over the billing DB.
//
// Mirrors the token-economics live pipeline's architecture (same DB, same env
// vars, same read-only-runtime rules) but is a fully independent copy: the PRD
// forbids touching token-economics code, and the aggregation itself is different
// (per-deal-window money math instead of anchor boards).
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
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import {
  DEFAULT_DEAL_RANGE,
  DealsConfigError,
  dateStartMs,
  dealRangeOption,
  dealStatus,
  loadDealsConfig,
  savedForTokens,
  windowEndMs,
  type DealPeriod,
  type DealRangeKey,
  type DealSeries,
  type DealStats,
  type DealUsagePoint,
  type DealsTotals,
  type TokenDealsPayload,
} from "./deals-config";

export { DealsConfigError } from "./deals-config";

const TABLE = "valid_usage";
const REFRESH_INTERVAL_SECONDS = 300;
const HOUR = 3600;
const DAY = 86400;
const QUERY_TIMEOUT_MS = 120_000;
// Re-fetch this many trailing buckets on incremental merges so late-arriving
// billing rows (backfills) still land. 3 days / 12 hours of overlap.
const OVERLAP_BUCKETS: Record<number, number> = { [DAY]: 3, [HOUR]: 12 };

// Same billing DB as the token-economics live pipeline — the deals ledger reads
// the identical valid_usage table, so it reuses those env vars on purpose (one
// secret to provision, not two).
const DB_ENV = {
  host: "TOKEN_ECON_LIVE_DB_HOST",
  port: "TOKEN_ECON_LIVE_DB_PORT",
  user: "TOKEN_ECON_LIVE_DB_USER",
  password: "TOKEN_ECON_LIVE_DB_PASSWORD",
  database: "TOKEN_ECON_LIVE_DB_DATABASE",
} as const;

export class DealsDbConfigError extends Error {
  constructor(readonly missing: string[]) {
    super(`Missing live usage database env: ${missing.join(", ")}`);
    this.name = "DealsDbConfigError";
  }
}

const CACHE_DIR_ENV = "TOKEN_DEALS_CACHE_DIR";

function cacheDir(): string {
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
// DB pool
// ---------------------------------------------------------------------------

let pool: Pool | null = null;

function dbConfig() {
  const missing = Object.values(DB_ENV).filter((name) => !process.env[name]);
  if (missing.length > 0) throw new DealsDbConfigError(missing);
  return {
    host: process.env[DB_ENV.host]!,
    port: Number(process.env[DB_ENV.port] ?? "3306"),
    user: process.env[DB_ENV.user]!,
    password: process.env[DB_ENV.password]!,
    database: process.env[DB_ENV.database]!,
  };
}

function getPool(): Pool {
  if (pool) return pool;
  pool = mysql.createPool({
    ...dbConfig(),
    waitForConnections: true,
    connectionLimit: 4,
    queueLimit: 32,
    connectTimeout: 10_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30_000,
    idleTimeout: 60_000,
    maxIdle: 2,
    timezone: "Z",
    dateStrings: true,
    supportBigNumbers: true,
    decimalNumbers: true,
  });
  return pool;
}

/** For CLI scripts (precompute) so the process can exit cleanly. */
export async function closeDealsDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

function floorTo(ms: number, seconds: number): number {
  const step = seconds * 1000;
  return Math.floor(ms / step) * step;
}

function sqlDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

function bucketIso(bucket: string | Date): string {
  if (bucket instanceof Date) return bucket.toISOString();
  return `${bucket.replace(" ", "T")}.000Z`;
}

function toNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
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
// DB query
// ---------------------------------------------------------------------------

interface UsageRow extends RowDataPacket {
  model_slug: string;
  bucket: string | Date;
  requests: number | string;
  cost: number | string | null;
  prompt_tokens: number | string | null;
  completion_tokens: number | string | null;
  reasoning_tokens: number | string | null;
}

async function queryUsageRows(params: {
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
      SUM(COALESCE(bill_amount, 0)) AS cost,
      SUM(COALESCE(tokens_prompt, 0)) AS prompt_tokens,
      SUM(COALESCE(tokens_completion, 0)) AS completion_tokens,
      SUM(COALESCE(tokens_reasoning, 0)) AS reasoning_tokens
    FROM ${TABLE}
    WHERE deleted = 0
      AND model_slug IN (${placeholders})
      AND created_at >= ?
      AND created_at < ?
    GROUP BY model_slug, bucket
    ORDER BY bucket ASC, model_slug ASC
  `;

  let retries = 2;
  while (retries > 0) {
    const conn = await getPool().getConnection();
    try {
      await conn.query("SET SESSION time_zone = '+00:00'");
      await conn.query(`SET SESSION ob_query_timeout = ${QUERY_TIMEOUT_MS * 1000}`).catch(() => {});
      const [rows] = await conn.query<UsageRow[]>({
        sql,
        values: [...params.slugs, sqlDate(params.fromMs), sqlDate(params.toMs)],
        timeout: QUERY_TIMEOUT_MS,
      });
      conn.release();
      return rows;
    } catch (err) {
      conn.destroy();
      retries--;
      if (retries <= 0) throw err;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error("Failed after retries");
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

interface RawBucket {
  t: string;
  requests: number;
  cost: number;
  promptTokens: number;
  outputTokens: number; // completion + reasoning
}

/** Buckets a deal owns within [fromMs, toMs): clipped to the deal's own window.
    Two periods of the same model never overlap (registry invariant), so date
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
  range: DealRangeKey;
  bucketSeconds: number;
  fromMs: number;
  toMs: number;
  now: Date;
  lastSuccessAt: string | null;
}): TokenDealsPayload {
  const { deals, rawBySlug, range, bucketSeconds, fromMs, toMs, now } = params;
  const stepMs = bucketSeconds * 1000;

  const series: DealSeries[] = [];
  for (const deal of deals) {
    const status = dealStatus(deal, now);
    if (status === "scheduled") continue; // registered but not shown yet (rule 1)

    const bounds = dealBucketRange(deal, fromMs, toMs, bucketSeconds);
    const byTime = rawBySlug.get(deal.slug) ?? new Map<string, RawBucket>();
    const points: DealUsagePoint[] = [];
    const stats: DealStats = {
      tokens: 0,
      promptTokens: 0,
      outputTokens: 0,
      requests: 0,
      paid: 0,
      saved: 0,
    };

    if (bounds) {
      for (let t = bounds.startMs; t < bounds.endMs; t += stepMs) {
        const iso = new Date(t).toISOString();
        const raw = byTime.get(iso);
        const promptTokens = raw?.promptTokens ?? 0;
        const outputTokens = raw?.outputTokens ?? 0;
        const tokens = promptTokens + outputTokens;
        const requests = raw?.requests ?? 0;
        const paid = raw?.cost ?? 0;
        const saved = raw ? savedForTokens(deal, promptTokens, outputTokens) : 0;
        points.push({ t: iso, tokens, promptTokens, outputTokens, requests, paid, saved });
        stats.tokens += tokens;
        stats.promptTokens += promptTokens;
        stats.outputTokens += outputTokens;
        stats.requests += requests;
        stats.paid += paid;
        stats.saved += saved;
      }
    }

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
    weightedDiscount: weightedDiscount(active),
  };

  return {
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
  };
}

/** Saved-weighted mean discount across active deals; plain mean before any
    usage lands (all weights zero). Null with no active deals. */
function weightedDiscount(active: DealSeries[]): number | null {
  if (active.length === 0) return null;
  const totalSaved = active.reduce((sum, d) => sum + (d.stats?.saved ?? 0), 0);
  if (totalSaved <= 0) {
    return active.reduce((sum, d) => sum + d.discount, 0) / active.length;
  }
  return active.reduce((sum, d) => sum + d.discount * (d.stats?.saved ?? 0), 0) / totalSaved;
}

function rangeWindow(range: DealRangeKey, deals: DealPeriod[], dataAsOfMs: number) {
  const bucketSeconds = bucketSecondsFor(range);
  const earliest = Math.min(...deals.map((d) => dateStartMs(d.startDate)), dataAsOfMs);
  const hours = dealRangeOption(range).hours;
  const rawFrom = hours == null ? earliest : Math.max(earliest, dataAsOfMs - hours * 3_600_000);
  return { bucketSeconds, fromMs: floorTo(rawFrom, bucketSeconds), toMs: dataAsOfMs };
}

function rowsToMap(rows: UsageRow[]): Map<string, Map<string, RawBucket>> {
  const bySlug = new Map<string, Map<string, RawBucket>>();
  for (const row of rows) {
    const t = bucketIso(row.bucket);
    const byTime = bySlug.get(row.model_slug) ?? new Map<string, RawBucket>();
    byTime.set(t, {
      t,
      requests: toNumber(row.requests),
      cost: toNumber(row.cost),
      promptTokens: toNumber(row.prompt_tokens),
      outputTokens: toNumber(row.completion_tokens) + toNumber(row.reasoning_tokens),
    });
    bySlug.set(row.model_slug, byTime);
  }
  return bySlug;
}

/** Full re-aggregation straight from the DB (cold path / precompute). */
export async function fetchTokenDeals(
  requestedRange: string | null | undefined,
  now = new Date(),
  options: { persist?: boolean } = {},
): Promise<TokenDealsPayload> {
  const range = dealRangeOption(requestedRange).key;
  const deals = await loadDealsConfig();
  const dataAsOfMs = currentDataAsOf(now);
  const { bucketSeconds, fromMs, toMs } = rangeWindow(range, deals, dataAsOfMs);

  const slugs = [...new Set(deals.map((d) => d.slug))];
  const rows = await queryUsageRows({ slugs, fromMs, toMs, bucketSeconds });

  const payload = assemble({
    deals,
    rawBySlug: rowsToMap(rows),
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

/** Baseline + incremental merge: reuse the packaged payload's old buckets and
    query the DB only for the tail (baseline.to − overlap → now). Returns null
    when the baseline isn't usable and a full fetch should run instead. */
async function incrementallyUpdate(
  range: DealRangeKey,
  baseline: TokenDealsPayload,
  now: Date,
): Promise<TokenDealsPayload | null> {
  const deals = await loadDealsConfig();
  const dataAsOfMs = currentDataAsOf(now);
  const { bucketSeconds, fromMs, toMs } = rangeWindow(range, deals, dataAsOfMs);
  if (baseline.bucketSeconds !== bucketSeconds) return null;

  const baselineTo = Date.parse(baseline.to);
  if (Number.isNaN(baselineTo)) return null;
  if (baselineTo >= toMs) return { ...baseline, generatedAt: now.toISOString() };

  const overlapMs = (OVERLAP_BUCKETS[bucketSeconds] ?? 3) * bucketSeconds * 1000;
  const incFromMs = Math.max(fromMs, floorTo(baselineTo, bucketSeconds) - overlapMs);
  // A tail bigger than half the window buys nothing over a full fetch.
  if (toMs - incFromMs > (toMs - fromMs) * 0.5) return null;

  const slugs = [...new Set(deals.map((d) => d.slug))];
  const rows = await queryUsageRows({ slugs, fromMs: incFromMs, toMs, bucketSeconds });

  // Rebuild the raw per-slug map: baseline buckets before the incremental
  // window + fresh buckets inside it. This is lossless — every point carries
  // its own prompt/output split and request count, and each (slug, bucket)
  // belongs to exactly one period per slug (non-overlap registry invariant).
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
        cost: p.paid,
        promptTokens: p.promptTokens,
        outputTokens: p.outputTokens,
      });
    }
    rawBySlug.set(deal.slug, byTime);
  }
  for (const [slug, byTime] of rowsToMap(rows)) {
    const target = rawBySlug.get(slug) ?? new Map<string, RawBucket>();
    for (const [t, raw] of byTime) target.set(t, raw);
    rawBySlug.set(slug, target);
  }

  return assemble({
    deals,
    rawBySlug,
    range,
    bucketSeconds,
    fromMs,
    toMs,
    now,
    lastSuccessAt: now.toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Degraded payload — registry facts only, no money numbers
// ---------------------------------------------------------------------------

let lastSuccessAt: string | null = null;

export async function buildDegradedPayload(now = new Date()): Promise<TokenDealsPayload> {
  const deals = await loadDealsConfig();
  const dataAsOfMs = currentDataAsOf(now);
  const visible: DealSeries[] = deals
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
  // Fall back to the freshest packaged baseline's stamp when this process has
  // never seen a live success (e.g. cold serverless instance during an outage).
  const baselineStamp = lastSuccessAt ?? (await readJsonCache("all"))?.lastSuccessAt ?? null;
  return {
    generatedAt: now.toISOString(),
    refreshIntervalSeconds: REFRESH_INTERVAL_SECONDS,
    range: DEFAULT_DEAL_RANGE,
    bucketSeconds: DAY,
    from: new Date(dataAsOfMs).toISOString(),
    to: new Date(dataAsOfMs).toISOString(),
    live: false,
    lastSuccessAt: baselineStamp,
    activeCount: visible.filter((d) => d.status === "active").length,
    endedCount: visible.filter((d) => d.status === "ended").length,
    totals: null,
    deals: visible,
  };
}

// ---------------------------------------------------------------------------
// Runtime entry (read-only FS safe): L1 → single-flight → baseline+incremental
// → full fetch; stale baseline on DB blips.
// ---------------------------------------------------------------------------

export type DealsFetchSource =
  | "l1-memory"
  | "baseline-fresh"
  | "single-flight"
  | "incremental-db"
  | "stale-baseline"
  | "full-db";

const responseCache = new Map<string, { data: TokenDealsPayload; expiresAt: number }>();
const inFlight = new Map<string, Promise<{ payload: TokenDealsPayload; source: DealsFetchSource }>>();

export interface DealsFetchResult {
  payload: TokenDealsPayload;
  source: DealsFetchSource;
  elapsedMs: number;
}

export async function getTokenDealsWithMeta(
  requestedRange: string | null | undefined,
  now = new Date(),
): Promise<DealsFetchResult> {
  const startedAt = Date.now();
  const range = dealRangeOption(requestedRange).key;
  const ttlMs = msUntilNextBoundary(now);

  const cached = responseCache.get(range);
  if (cached && Date.now() < cached.expiresAt) {
    return {
      payload: { ...cached.data, generatedAt: now.toISOString() },
      source: "l1-memory",
      elapsedMs: Date.now() - startedAt,
    };
  }

  const existing = inFlight.get(range);
  if (existing) {
    const { payload } = await existing;
    return {
      payload: { ...payload, generatedAt: now.toISOString() },
      source: "single-flight",
      elapsedMs: Date.now() - startedAt,
    };
  }

  const work = (async (): Promise<{ payload: TokenDealsPayload; source: DealsFetchSource }> => {
    const baseline = await readJsonCache(range);
    if (baseline?.live) {
      const baselineTo = Date.parse(baseline.to);
      if (!Number.isNaN(baselineTo) && baselineTo >= currentDataAsOf(now)) {
        return { payload: baseline, source: "baseline-fresh" };
      }
      try {
        const merged = await incrementallyUpdate(range, baseline, now);
        if (merged) return { payload: merged, source: "incremental-db" };
      } catch (err) {
        if (err instanceof DealsConfigError) throw err; // registry bug: surface it
        console.warn(
          `[token-deals] Incremental update for ${range} failed, serving stale baseline:`,
          err instanceof Error ? err.message : err,
        );
        return { payload: { ...baseline, stale: true }, source: "stale-baseline" };
      }
    }
    return { payload: await fetchTokenDeals(range, now), source: "full-db" };
  })();

  inFlight.set(range, work);
  try {
    const { payload, source } = await work;
    if (payload.live) lastSuccessAt = payload.lastSuccessAt ?? lastSuccessAt;
    const effectiveTtl = source === "stale-baseline" ? Math.min(ttlMs, 10_000) : ttlMs;
    responseCache.set(range, { data: payload, expiresAt: Date.now() + effectiveTtl });
    return { payload, source, elapsedMs: Date.now() - startedAt };
  } finally {
    inFlight.delete(range);
  }
}
