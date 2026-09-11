import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { VENDORS } from "@research/lib/vendors";
import type { VendorId } from "@research/lib/types";
import { vendorForSlug } from "./normalize";
import {
  DEFAULT_LIVE_BUCKET_SECONDS,
  DEFAULT_LIVE_REFRESH_INTERVAL_SECONDS,
  DEFAULT_LIVE_START_ISO,
  LiveConfigError,
  UNANCHORED_ANCHOR_ID,
  liveRangeOption,
  type LiveRangeKey,
  type LiveModelSeries,
  type LiveTokenEconomicsPayload,
  type LiveUsagePoint,
} from "./live-config";
import { loadLiveModelConfig } from "./live-models";
import { snapshotId, snapshotKey, validEconomics } from "../cache/payload";
import { supabaseSnapshotStore, writeSharedSnapshot } from "../cache/supabase";
import { sharedSnapshotCache, type CacheSource, type CacheResult, type RefreshOptions } from "../cache/read-through";

export { LiveConfigError } from "./live-config";

const TABLE = "valid_usage";
// OceanBase hint: the (model_slug, created_at) index is used but every matched
// row index-backs into the main table for the token/cost columns — that lookup
// dominates the runtime. PARALLEL(4) splits the scan (measured ~4x on 1–4 day
// windows); READ_CONSISTENCY(WEAK) lets follower replicas serve the read,
// which is safe because dataAsOf is floored to the previous closed bucket.
const QUERY_HINT = "/*+ READ_CONSISTENCY(WEAK) PARALLEL(4) */";
export const LIVE_START_ENV = "TOKEN_ECON_LIVE_START_ISO";
export const LIVE_BUCKET_SECONDS_ENV = "TOKEN_ECON_LIVE_BUCKET_SECONDS";
export const LIVE_REFRESH_INTERVAL_SECONDS_ENV = "TOKEN_ECON_LIVE_REFRESH_INTERVAL_SECONDS";
const QUERY_TIMEOUT_ENV = "TOKEN_ECON_LIVE_QUERY_TIMEOUT_MS";
const DEFAULT_QUERY_TIMEOUT_MS = 60_000;

/** Shared snapshots are the only runtime baseline; JSON is an import format. */
export async function readSharedCache(range: LiveRangeKey): Promise<LiveTokenEconomicsPayload | null> {
  const value = await supabaseSnapshotStore<LiveTokenEconomicsPayload>(snapshotId("token-economics", range)).read();
  return validEconomics(value, range) ? value : null;
}

export async function writeSharedCache(range: LiveRangeKey, data: LiveTokenEconomicsPayload): Promise<void> {
  if (!validEconomics(data, range)) throw new Error("Refusing to persist an invalid economics snapshot.");
  await writeSharedSnapshot(snapshotId("token-economics", range), data);
}

const DB_ENV = {
  host: "TOKEN_ECON_LIVE_DB_HOST",
  port: "TOKEN_ECON_LIVE_DB_PORT",
  user: "TOKEN_ECON_LIVE_DB_USER",
  password: "TOKEN_ECON_LIVE_DB_PASSWORD",
  database: "TOKEN_ECON_LIVE_DB_DATABASE",
} as const;

const POOL_ENV = {
  connectionLimit: "TOKEN_ECON_LIVE_DB_POOL_SIZE",
  queueLimit: "TOKEN_ECON_LIVE_DB_QUEUE_LIMIT",
  maxIdle: "TOKEN_ECON_LIVE_DB_MAX_IDLE",
  idleTimeoutMs: "TOKEN_ECON_LIVE_DB_IDLE_TIMEOUT_MS",
} as const;

const DEFAULT_POOL_CONFIG = {
  connectionLimit: 8,
  queueLimit: 32,
  maxIdle: 4,
  idleTimeoutMs: 60_000,
} as const;

function readPoolConfig() {
  const readInt = (name: keyof typeof POOL_ENV, fallback: number): number => {
    const raw = process.env[POOL_ENV[name]]?.trim();
    if (!raw) return fallback;
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n <= 0) {
      console.warn(`[token-economics/live] Invalid ${POOL_ENV[name]}=${JSON.stringify(raw)}, using default ${fallback}`);
      return fallback;
    }
    return n;
  };

  return {
    connectionLimit: readInt("connectionLimit", DEFAULT_POOL_CONFIG.connectionLimit),
    queueLimit: readInt("queueLimit", DEFAULT_POOL_CONFIG.queueLimit),
    maxIdle: readInt("maxIdle", DEFAULT_POOL_CONFIG.maxIdle),
    idleTimeoutMs: readInt("idleTimeoutMs", DEFAULT_POOL_CONFIG.idleTimeoutMs),
  };
}

export class LiveDbConfigError extends Error {
  constructor(readonly missing: string[]) {
    super(`Missing live usage database env: ${missing.join(", ")}`);
    this.name = "LiveDbConfigError";
  }
}

interface LiveUsageRow extends RowDataPacket {
  model_slug: string;
  bucket: string | Date;
  requests: number | string;
  tokens: number | string | null;
  cost: number | string | null;
  prompt_tokens: number | string | null;
  completion_tokens: number | string | null;
  reasoning_tokens: number | string | null;
}

let pool: Pool | null = null;

function dbConfig() {
  const missing = Object.values(DB_ENV).filter((name) => !process.env[name]);
  if (missing.length > 0) throw new LiveDbConfigError(missing);
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
  const cfg = dbConfig();
  const poolCfg = readPoolConfig();
  pool = mysql.createPool({
    ...cfg,
    waitForConnections: true,
    connectionLimit: poolCfg.connectionLimit,
    queueLimit: poolCfg.queueLimit,
    connectTimeout: 10_000,
    // Connection keepalive + idle timeout to avoid stale connections killed by DB
    enableKeepAlive: true,
    keepAliveInitialDelay: 30_000,
    idleTimeout: poolCfg.idleTimeoutMs, // Reap idle connections after configured timeout
    maxIdle: poolCfg.maxIdle, // Soft cap on idle connections
    timezone: "Z",
    dateStrings: true,
    supportBigNumbers: true,
    decimalNumbers: true,
  });
  console.log(`[token-economics/live] DB pool initialized: max=${poolCfg.connectionLimit}, queue=${poolCfg.queueLimit}, maxIdle=${poolCfg.maxIdle}`);
  return pool;
}

/**
 * Close the database connection pool. Call this in CLI scripts when done
 * to allow the Node.js process to exit cleanly.
 */
export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

function floorToBucket(d: Date, bucketSeconds: number): Date {
  const bucketMs = bucketSeconds * 1000;
  return new Date(Math.floor(d.getTime() / bucketMs) * bucketMs);
}

function maxDate(a: Date, b: Date): Date {
  return a >= b ? a : b;
}

function liveStartDate(): Date {
  const raw = process.env[LIVE_START_ENV]?.trim() || DEFAULT_LIVE_START_ISO;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new LiveConfigError(
      `${LIVE_START_ENV} must be a valid ISO date/time; got ${JSON.stringify(raw)}.`,
    );
  }
  return date;
}

function liveSecondsEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const seconds = Number(raw);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new LiveConfigError(
      `${name} must be a positive integer number of seconds; got ${JSON.stringify(raw)}.`,
    );
  }
  return seconds;
}

function liveMsEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const ms = Number(raw);
  if (!Number.isSafeInteger(ms) || ms <= 0) {
    console.warn(`[token-economics/live] Invalid ${name}=${JSON.stringify(raw)}, using default ${fallback}ms`);
    return fallback;
  }
  return ms;
}

function liveBucketSeconds(): number {
  return liveSecondsEnv(LIVE_BUCKET_SECONDS_ENV, DEFAULT_LIVE_BUCKET_SECONDS);
}

function liveRefreshIntervalSeconds(): number {
  return liveSecondsEnv(
    LIVE_REFRESH_INTERVAL_SECONDS_ENV,
    DEFAULT_LIVE_REFRESH_INTERVAL_SECONDS,
  );
}

function addSeconds(d: Date, seconds: number): Date {
  return new Date(d.getTime() + seconds * 1000);
}

/**
 * The timestamp the live data SHOULD currently be advanced to, computed with
 * pure arithmetic from env config (no file/DB IO). Mirrors how both
 * `fetchLiveTokenEconomics` and `incrementallyUpdateCache` derive `dataAsOf`:
 * floor `now` to the refresh interval, then to the bucket. As long as a cached
 * payload's `to` is >= this value, nothing new could have closed yet, so the
 * cache is exact (not stale) and no DB query is needed.
 */
function currentDataAsOf(now: Date, bucketSeconds: number): Date {
  const refreshIntervalSeconds = liveRefreshIntervalSeconds();
  const refreshBoundary = floorToBucket(now, refreshIntervalSeconds);
  return floorToBucket(refreshBoundary, bucketSeconds);
}

/**
 * Milliseconds from `now` until the next refresh boundary closes — i.e. how
 * long the current answer stays bit-for-bit valid. Used as the L1 TTL so a hot
 * range is held in memory across the whole bucket window (often minutes),
 * instead of being recomputed every 10s. Clamped to a small floor so a request
 * landing exactly on a boundary still caches briefly.
 */
function msUntilNextBoundary(now: Date): number {
  const refreshIntervalSeconds = liveRefreshIntervalSeconds();
  const boundary = floorToBucket(now, refreshIntervalSeconds);
  const next = addSeconds(boundary, refreshIntervalSeconds);
  return Math.max(1_000, next.getTime() - now.getTime());
}

function sqlDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
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

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

// Adaptive bucket sizing to keep query performance reasonable across time ranges:
// - ≤ 3 days: 5-minute buckets (fine granularity for recent data)
// - ≤ 14 days: 1-hour buckets (reduces point count by 12x)
// - > 14 days: 1-day buckets (reduces point count by 288x vs 5min)
function selectBucketSeconds(rangeDurationHours: number, configuredBucket: number): number {
  if (rangeDurationHours <= 72) return configuredBucket; // Keep fine granularity for default 72h view
  if (rangeDurationHours <= 14 * 24) return SECONDS_PER_HOUR;
  return SECONDS_PER_DAY;
}

function adaptiveQueryTimeout(rangeDurationHours: number, defaultTimeoutMs: number): number {
  // Give longer queries more time to complete
  if (rangeDurationHours > 14 * 24) return 5 * 60 * 1000; // 5 minutes for monthly+ views
  if (rangeDurationHours > 72) return 2 * 60 * 1000; // 2 minutes for multi-day views
  return defaultTimeoutMs;
}

function bucketExpression(bucketSeconds: number): string {
  if (bucketSeconds === 60) return "DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:00')";
  if (bucketSeconds === SECONDS_PER_HOUR) return "DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00')";
  if (bucketSeconds === SECONDS_PER_DAY) return "DATE_FORMAT(created_at, '%Y-%m-%d 00:00:00')";
  return (
    "DATE_FORMAT(FROM_UNIXTIME(" +
    `FLOOR(UNIX_TIMESTAMP(created_at) / ${bucketSeconds}) * ${bucketSeconds}` +
    "), '%Y-%m-%d %H:%i:%s')"
  );
}

function bucketLabel(bucketSeconds: number): string {
  if (bucketSeconds === 60) return "1-min";
  if (bucketSeconds === 300) return "5-min";
  if (bucketSeconds === SECONDS_PER_HOUR) return "1-hour";
  if (bucketSeconds === SECONDS_PER_DAY) return "1-day";
  return `${bucketSeconds}-sec`;
}

function buildBuckets(from: Date, to: Date, bucketSeconds: number): string[] {
  const out: string[] = [];
  for (let cur = from; cur < to; cur = addSeconds(cur, bucketSeconds)) {
    out.push(cur.toISOString());
  }
  return out;
}

function emptyPoint(t: string): LiveUsagePoint {
  return {
    t,
    tokens: 0,
    cost: 0,
    requests: 0,
    promptTokens: 0,
    completionTokens: 0,
    reasoningTokens: 0,
  };
}

async function queryUsageRows(params: {
  slugs: string[];
  from: Date;
  to: Date;
  bucketSeconds: number;
  timeoutUs: number;
}): Promise<LiveUsageRow[]> {
  const placeholders = params.slugs.map(() => "?").join(",");
  const bucket = bucketExpression(params.bucketSeconds);
  const sql = `
    SELECT ${QUERY_HINT}
      model_slug,
      ${bucket} AS bucket,
      COUNT(*) AS requests,
      SUM(COALESCE(tokens_prompt, 0) + COALESCE(tokens_completion, 0) + COALESCE(tokens_reasoning, 0)) AS tokens,
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
      await conn.ping().catch(async () => {
        // Connection is dead, try to reconnect
        await conn.destroy();
        throw new Error("dead connection");
      });
      await conn.query("SET SESSION time_zone = '+00:00'");
      await conn.query(`SET SESSION ob_query_timeout = ${params.timeoutUs}`).catch(() => {});
      const [rows] = await conn.query<LiveUsageRow[]>({
        sql,
        values: [
          ...params.slugs,
          sqlDate(params.from),
          sqlDate(params.to),
        ],
        timeout: params.timeoutUs / 1000, // Driver-level timeout in ms
      });
      conn.release();
      return rows;
    } catch (err) {
      conn.destroy(); // Don't reuse broken connections
      retries--;
      if (retries <= 0) throw err;
      // Brief backoff before retry
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  throw new Error("Failed after retries");
}

function modelMeta(slug: string): { vendor: VendorId; vendorName: string } {
  const vendor = vendorForSlug(slug);
  return { vendor, vendorName: VENDORS[vendor]?.name ?? vendor };
}

// ---------------------------------------------------------------------------
// Payload compaction — the points arrays dominate the JSON, and the summed
// cost floats carry 15+ digits of double noise ($0.30000000000000004). Costs
// round to 6 decimals (micro-dollars — far below anything the UI renders, and
// a 5-min bucket's smallest real cost is still orders of magnitude above it);
// token/request counts are integers already. Applied at assembly (so persisted
// baselines shrink too) and to baselines read off disk (legacy files).
// ---------------------------------------------------------------------------

const COST_DECIMALS = 6;

function roundCost(n: number): number {
  return Number(n.toFixed(COST_DECIMALS));
}

function compactModelSeries(m: LiveModelSeries): LiveModelSeries {
  return {
    ...m,
    totalCost: roundCost(m.totalCost),
    latestCost: roundCost(m.latestCost),
    peakCost: roundCost(m.peakCost),
    points: m.points.map((p) => (p.cost === 0 ? p : { ...p, cost: roundCost(p.cost) })),
  };
}

/**
 * Overlay the CURRENT live-model config's price/campaign fields onto a cached
 * payload. Snapshots retain the configuration from their last refresh, so a payload served from the
 * `supabase`/`stale` paths carries whatever config existed when it was
 * built — without this overlay, an edited `endDate` (or price) in
 * `config/token-economics-live-models.json` would not take effect until the
 * cache is rebuilt. Usage stats/points stay untouched; only per-model config
 * fields (prices, discountFactor, start/endDate…) are refreshed, matching what
 * the incremental merge already does via `...price`. Models missing from the
 * config are left as-is.
 */
export async function overlayLiveModelConfig(
  payload: LiveTokenEconomicsPayload,
): Promise<LiveTokenEconomicsPayload> {
  let config;
  try {
    config = await loadLiveModelConfig();
  } catch (err) {
    console.warn(
      "[token-economics/live] Config overlay skipped (config unreadable):",
      err instanceof Error ? err.message : err,
    );
    return payload;
  }
  const bySlug = new Map(config.models.map((m) => [m.slug, m]));
  const overlay = (m: LiveModelSeries): LiveModelSeries => {
    const price = bySlug.get(m.slug);
    return price ? { ...m, ...price } : m;
  };
  return {
    ...payload,
    anchors: payload.anchors.map((a) => ({ ...a, models: a.models.map(overlay) })),
    unanchored: payload.unanchored.map(overlay),
  };
}

/** Round every cost field in the payload to COST_DECIMALS. Idempotent. */
export function compactLivePayload(payload: LiveTokenEconomicsPayload): LiveTokenEconomicsPayload {
  return {
    ...payload,
    anchors: payload.anchors.map((a) => ({
      ...a,
      totalCost: roundCost(a.totalCost),
      peakCost: roundCost(a.peakCost),
      models: a.models.map(compactModelSeries),
    })),
    unanchored: payload.unanchored.map(compactModelSeries),
  };
}

type FetchProgressStage =
  | "check-cache"
  | "load-config"
  | "query-db"
  | "aggregate"
  | "write-cache";

export interface FetchProgress {
  stage: FetchProgressStage;
  message: string;
  percent?: number; // 0-100
}

/**
 * Full re-aggregation of an entire range straight from the DB. This does NO
 * cache orchestration — callers decide caching. It is the cold-path fallback
 * behind {@link getLiveTokenEconomics} (when no baseline exists for incremental
 * merge) and the full-fetch path of the precompute script.
 *
 * `persist` is for explicit maintenance commands. Request refreshes persist
 * through the shared coordinator while holding the database refresh lease.
 */
export async function fetchLiveTokenEconomics(
  requestedRange: string | null | undefined,
  now = new Date(),
  options: {
    persist?: boolean;
    onProgress?: (progress: FetchProgress) => void;
  } = {},
): Promise<LiveTokenEconomicsPayload> {
  const onProgress = options.onProgress || (() => {});
  const range = liveRangeOption(requestedRange);
  const queryTimeoutMs = liveMsEnv(QUERY_TIMEOUT_ENV, DEFAULT_QUERY_TIMEOUT_MS);

  onProgress({ stage: "load-config", message: "Loading model config...", percent: 10 });
  const liveConfig = await loadLiveModelConfig();
  const configuredBucketSeconds = liveBucketSeconds();
  const refreshIntervalSeconds = liveRefreshIntervalSeconds();
  const refreshBoundary = floorToBucket(now, refreshIntervalSeconds);
  const dataAsOf = floorToBucket(refreshBoundary, configuredBucketSeconds);
  const start = liveStartDate();
  const rangeFrom =
    range.key === "all"
      ? start
      : maxDate(start, new Date(dataAsOf.getTime() - (range.hours ?? 72) * 3_600_000));

  // Calculate range duration in hours to select appropriate bucket size, cache TTL, and timeout
  const rangeDurationHours = (dataAsOf.getTime() - rangeFrom.getTime()) / (1000 * 3600);
  const bucketSeconds = selectBucketSeconds(rangeDurationHours, configuredBucketSeconds);
  const effectiveTimeoutMs = adaptiveQueryTimeout(rangeDurationHours, queryTimeoutMs);
  const effectiveTimeoutUs = effectiveTimeoutMs * 1000;

  const fromBucket = floorToBucket(rangeFrom, bucketSeconds);
  const toBucket = floorToBucket(dataAsOf, bucketSeconds);
  const buckets = buildBuckets(fromBucket, toBucket, bucketSeconds);

  const slugs = liveConfig.models.map((m) => m.slug);
  onProgress({
    stage: "query-db",
    message: `Querying database (${bucketLabel(bucketSeconds)} buckets, ${fromBucket.toISOString().slice(0,10)} → ${toBucket.toISOString().slice(0,10)})...`,
    percent: 30,
  });
  const rows = await queryUsageRows({
    slugs,
    from: fromBucket,
    to: toBucket,
    bucketSeconds,
    timeoutUs: effectiveTimeoutUs,
  });

  onProgress({ stage: "aggregate", message: `Aggregating ${rows.length} rows across ${slugs.length} models...`, percent: 70 });
  const rowMap = new Map<string, Map<string, LiveUsagePoint>>();
  for (const row of rows) {
    const t = bucketIso(row.bucket);
    const byTime = rowMap.get(row.model_slug) ?? new Map<string, LiveUsagePoint>();
    byTime.set(t, {
      t,
      tokens: toNumber(row.tokens),
      cost: toNumber(row.cost),
      requests: toNumber(row.requests),
      promptTokens: toNumber(row.prompt_tokens),
      completionTokens: toNumber(row.completion_tokens),
      reasoningTokens: toNumber(row.reasoning_tokens),
    });
    rowMap.set(row.model_slug, byTime);
  }

  const models: LiveModelSeries[] = liveConfig.models.map((price) => {
    const byTime = rowMap.get(price.slug) ?? new Map<string, LiveUsagePoint>();
    const points = buckets.map((t) => byTime.get(t) ?? emptyPoint(t));
    const totalTokens = points.reduce((sum, p) => sum + p.tokens, 0);
    const totalCost = points.reduce((sum, p) => sum + p.cost, 0);
    const totalRequests = points.reduce((sum, p) => sum + p.requests, 0);
    const peakTokens = Math.max(0, ...points.map((p) => p.tokens));
    const peakCost = Math.max(0, ...points.map((p) => p.cost));
    const { vendor, vendorName } = modelMeta(price.slug);
    return {
      ...price,
      vendor,
      vendorName,
      totalTokens,
      totalCost,
      totalRequests,
      latestTokens: points[points.length - 1]?.tokens ?? 0,
      latestCost: points[points.length - 1]?.cost ?? 0,
      peakTokens,
      peakCost,
      points,
    };
  });

  const anchors = liveConfig.anchors.map((anchor) => {
    const anchorModels = models
      .filter((m) => m.anchorId === anchor.id)
      .sort((a, b) => b.totalTokens - a.totalTokens || a.model.localeCompare(b.model));
    return {
      id: anchor.id,
      label: anchor.label,
      price: anchor.price,
      targetBlended: anchor.targetBlended,
      totalTokens: anchorModels.reduce((sum, m) => sum + m.totalTokens, 0),
      totalCost: anchorModels.reduce((sum, m) => sum + m.totalCost, 0),
      totalRequests: anchorModels.reduce((sum, m) => sum + m.totalRequests, 0),
      peakTokens: Math.max(0, ...anchorModels.flatMap((m) => m.points.map((p) => p.tokens))),
      peakCost: Math.max(0, ...anchorModels.flatMap((m) => m.points.map((p) => p.cost))),
      models: anchorModels,
    };
  });

  const result: LiveTokenEconomicsPayload = compactLivePayload({
    generatedAt: now.toISOString(),
    dataLagSeconds: Math.max(0, Math.floor((now.getTime() - dataAsOf.getTime()) / 1000)),
    refreshIntervalSeconds,
    range: range.key,
    bucket: bucketLabel(bucketSeconds),
    bucketSeconds,
    from: fromBucket.toISOString(),
    to: dataAsOf.toISOString(),
    anchors,
    unanchored: models
      .filter((m) => m.anchorId === UNANCHORED_ANCHOR_ID)
      .sort((a, b) => b.totalTokens - a.totalTokens || a.model.localeCompare(b.model)),
  });

  // Maintenance commands persist here; request refreshes commit under their shared lease.
  if (options.persist) {
    onProgress({ stage: "write-cache", message: "Writing shared snapshot to Supabase...", percent: 95 });
    await writeSharedCache(range.key, result);
    onProgress({ stage: "write-cache", message: "Done!", percent: 100 });
  }

  return result;
}

// Overlap window for incremental updates: re-fetch this much recent history
// to account for late-arriving data/backfills in the DB (e.g. delayed records)
const INCREMENTAL_OVERLAP_BUCKETS = 12; // 12 buckets = 1 hour for 5min, 12 hours for 1h, 12 days for 1d

/**
 * Incrementally update an existing cached payload, only fetching new data since last cache.
 * Returns null if incremental update is not possible (missing cache, incompatible bucket/range)
 * and a full fetch should be performed instead.
 */
export async function incrementallyUpdateCache(
  requestedRange: string | null | undefined,
  existing: LiveTokenEconomicsPayload,
  now = new Date(),
  options: { persist?: boolean; onProgress?: (progress: FetchProgress) => void } = {},
): Promise<LiveTokenEconomicsPayload | null> {
  const onProgress = options.onProgress || (() => {});
  const range = liveRangeOption(requestedRange);

  // Validate existing cache is compatible
  const liveConfig = await loadLiveModelConfig();
  const configuredBucketSeconds = liveBucketSeconds();
  const refreshIntervalSeconds = liveRefreshIntervalSeconds();
  const refreshBoundary = floorToBucket(now, refreshIntervalSeconds);
  const dataAsOf = floorToBucket(refreshBoundary, existing.bucketSeconds);
  const start = liveStartDate();
  const rangeFrom =
    range.key === "all"
      ? start
      : maxDate(start, new Date(dataAsOf.getTime() - (range.hours ?? 72) * 3_600_000));

  const rangeDurationHours = (dataAsOf.getTime() - rangeFrom.getTime()) / (1000 * 3600);
  const expectedBucketSeconds = selectBucketSeconds(rangeDurationHours, configuredBucketSeconds);

  // If bucket size changed (e.g. range expanded to multi-day), need full refetch
  if (existing.bucketSeconds !== expectedBucketSeconds) {
    onProgress({ stage: "check-cache", message: "Bucket size changed, performing full fetch", percent: 0 });
    return null;
  }

  const fromBucket = floorToBucket(rangeFrom, existing.bucketSeconds);
  const toBucket = floorToBucket(dataAsOf, existing.bucketSeconds);

  // Parse last point time from existing cache
  const lastPointTime = new Date(existing.to);
  if (Number.isNaN(lastPointTime.getTime())) {
    return null; // Invalid cache, full refetch
  }

  // If last cached point is already at/past target, nothing to do
  if (lastPointTime >= toBucket) {
    onProgress({ stage: "check-cache", message: "Cache already up to date", percent: 100 });
    return { ...existing, generatedAt: now.toISOString() };
  }

  // Calculate incremental fetch window: include overlap to fix late data
  const overlapMs = INCREMENTAL_OVERLAP_BUCKETS * existing.bucketSeconds * 1000;
  const incrementalFrom = new Date(Math.max(fromBucket.getTime(), lastPointTime.getTime() - overlapMs));
  const incrementalTo = toBucket;

  // If incremental window is too large, fall back to full fetch
  const fullWindowMs = toBucket.getTime() - fromBucket.getTime();
  const incrementalWindowMs = incrementalTo.getTime() - incrementalFrom.getTime();
  if (incrementalWindowMs > fullWindowMs * 0.5) {
    onProgress({ stage: "check-cache", message: "Incremental window too large, performing full fetch", percent: 0 });
    return null;
  }

  onProgress({
    stage: "query-db",
    message: `Incremental fetch: ${incrementalFrom.toISOString().slice(0, 16).replace("T", " ")} → ${incrementalTo.toISOString().slice(0, 16).replace("T", " ")} (${Math.round(incrementalWindowMs / (existing.bucketSeconds * 1000))} new buckets)`,
    percent: 30,
  });

  const effectiveTimeoutMs = adaptiveQueryTimeout(rangeDurationHours, liveMsEnv(QUERY_TIMEOUT_ENV, DEFAULT_QUERY_TIMEOUT_MS));
  const slugs = liveConfig.models.map((m) => m.slug);

  // Fetch only new/overlap rows
  const rows = await queryUsageRows({
    slugs,
    from: incrementalFrom,
    to: incrementalTo,
    bucketSeconds: existing.bucketSeconds,
    timeoutUs: effectiveTimeoutMs * 1000,
  });

  onProgress({ stage: "aggregate", message: `Merging ${rows.length} new rows into existing cache...`, percent: 70 });

  // Build point map for all models (existing + new)
  const pointMap = new Map<string, Map<string, LiveUsagePoint>>();

  // First, add existing points
  for (const anchor of existing.anchors) {
    for (const model of anchor.models) {
      const modelMap = new Map<string, LiveUsagePoint>();
      for (const p of model.points) {
        // Only keep points that are not in the overlap window (we'll replace those with fresh data)
        if (new Date(p.t) < incrementalFrom) {
          modelMap.set(p.t, p);
        }
      }
      pointMap.set(model.slug, modelMap);
    }
  }
  // Add unanchored models
  for (const model of existing.unanchored) {
    if (!pointMap.has(model.slug)) {
      const modelMap = new Map<string, LiveUsagePoint>();
      for (const p of model.points) {
        if (new Date(p.t) < incrementalFrom) {
          modelMap.set(p.t, p);
        }
      }
      pointMap.set(model.slug, modelMap);
    }
  }

  // Add new/updated points from fresh query
  for (const row of rows) {
    const t = bucketIso(row.bucket);
    const byTime = pointMap.get(row.model_slug) ?? new Map<string, LiveUsagePoint>();
    byTime.set(t, {
      t,
      tokens: toNumber(row.tokens),
      cost: toNumber(row.cost),
      requests: toNumber(row.requests),
      promptTokens: toNumber(row.prompt_tokens),
      completionTokens: toNumber(row.completion_tokens),
      reasoningTokens: toNumber(row.reasoning_tokens),
    });
    pointMap.set(row.model_slug, byTime);
  }

  // Build full bucket list (full range from fromBucket → toBucket)
  const fullBuckets = buildBuckets(fromBucket, toBucket, existing.bucketSeconds);

  // Reconstruct models with merged points, recalculate aggregates
  const models: LiveModelSeries[] = liveConfig.models.map((price) => {
    const byTime = pointMap.get(price.slug) ?? new Map<string, LiveUsagePoint>();
    const points = fullBuckets.map((t) => byTime.get(t) ?? emptyPoint(t));
    const totalTokens = points.reduce((sum, p) => sum + p.tokens, 0);
    const totalCost = points.reduce((sum, p) => sum + p.cost, 0);
    const totalRequests = points.reduce((sum, p) => sum + p.requests, 0);
    const peakTokens = Math.max(0, ...points.map((p) => p.tokens));
    const peakCost = Math.max(0, ...points.map((p) => p.cost));
    const { vendor, vendorName } = modelMeta(price.slug);
    return {
      ...price,
      vendor,
      vendorName,
      totalTokens,
      totalCost,
      totalRequests,
      latestTokens: points[points.length - 1]?.tokens ?? 0,
      latestCost: points[points.length - 1]?.cost ?? 0,
      peakTokens,
      peakCost,
      points,
    };
  });

  const anchors = liveConfig.anchors.map((anchor) => {
    const anchorModels = models
      .filter((m) => m.anchorId === anchor.id)
      .sort((a, b) => b.totalTokens - a.totalTokens || a.model.localeCompare(b.model));
    return {
      id: anchor.id,
      label: anchor.label,
      price: anchor.price,
      targetBlended: anchor.targetBlended,
      totalTokens: anchorModels.reduce((sum, m) => sum + m.totalTokens, 0),
      totalCost: anchorModels.reduce((sum, m) => sum + m.totalCost, 0),
      totalRequests: anchorModels.reduce((sum, m) => sum + m.totalRequests, 0),
      peakTokens: Math.max(0, ...anchorModels.flatMap((m) => m.points.map((p) => p.tokens))),
      peakCost: Math.max(0, ...anchorModels.flatMap((m) => m.points.map((p) => p.cost))),
      models: anchorModels,
    };
  });

  const result: LiveTokenEconomicsPayload = compactLivePayload({
    generatedAt: now.toISOString(),
    dataLagSeconds: Math.max(0, Math.floor((now.getTime() - dataAsOf.getTime()) / 1000)),
    refreshIntervalSeconds,
    range: range.key,
    bucket: bucketLabel(existing.bucketSeconds),
    bucketSeconds: existing.bucketSeconds,
    from: fromBucket.toISOString(),
    to: dataAsOf.toISOString(),
    anchors,
    unanchored: models
      .filter((m) => m.anchorId === UNANCHORED_ANCHOR_ID)
      .sort((a, b) => b.totalTokens - a.totalTokens || a.model.localeCompare(b.model)),
  });

  // Maintenance commands persist here; request refreshes commit under their shared lease.
  if (options.persist) {
    onProgress({ stage: "write-cache", message: "Writing updated snapshot to Supabase...", percent: 95 });
    await writeSharedCache(range.key, result);
    onProgress({ stage: "write-cache", message: "Incremental update complete!", percent: 100 });
  }

  return result;
}

export type LiveFetchSource = CacheSource;
export type LiveFetchResult = CacheResult<LiveTokenEconomicsPayload>;

/** L1 → Supabase → incremental billing query → fenced Supabase commit. */
export async function getLiveTokenEconomicsWithMeta(
  requestedRange: string | null | undefined,
  now = new Date(),
  options: RefreshOptions = {},
): Promise<LiveFetchResult> {
  const range = liveRangeOption(requestedRange).key;
  const id = snapshotId("token-economics", range);
  const result = await sharedSnapshotCache().get<LiveTokenEconomicsPayload>({
    key: snapshotKey(id), store: supabaseSnapshotStore(id), now, ...options,
    valid: (value): value is LiveTokenEconomicsPayload => validEconomics(value, range),
    fresh: (p, at) => Date.parse(p.to) >= currentDataAsOf(at, p.bucketSeconds).getTime(),
    ttlMs: (_, at) => Math.min(15_000, msUntilNextBoundary(at)),
    async load(baseline) {
      if (baseline) {
        const merged = await incrementallyUpdateCache(range, baseline, now);
        if (merged) return { payload: merged, source: "incremental-db" };
      }
      return { payload: await fetchLiveTokenEconomics(range, now), source: "full-db" };
    },
  });
  return {
    ...result,
    payload: await overlayLiveModelConfig({
      ...compactLivePayload(result.payload),
      dataLagSeconds: Math.max(0, Math.floor((now.getTime() - Date.parse(result.payload.to)) / 1000)),
    }),
  };
}

export async function getLiveTokenEconomics(
  requestedRange: string | null | undefined,
  now = new Date(),
): Promise<LiveTokenEconomicsPayload> {
  return (await getLiveTokenEconomicsWithMeta(requestedRange, now)).payload;
}
