import fs from "node:fs/promises";
import path from "node:path";
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

export { LiveConfigError } from "./live-config";

const TABLE = "valid_usage";
export const LIVE_START_ENV = "TOKEN_ECON_LIVE_START_ISO";
export const LIVE_BUCKET_SECONDS_ENV = "TOKEN_ECON_LIVE_BUCKET_SECONDS";
export const LIVE_REFRESH_INTERVAL_SECONDS_ENV = "TOKEN_ECON_LIVE_REFRESH_INTERVAL_SECONDS";
const QUERY_TIMEOUT_ENV = "TOKEN_ECON_LIVE_QUERY_TIMEOUT_MS";
const DEFAULT_QUERY_TIMEOUT_MS = 60_000;

// L1 in-memory cache: the freshest fully-merged payload per range, with a short
// TTL. Serves concurrent bursts so we don't run the incremental DB query more
// than once per ~10s on a hot instance.
const responseCache = new Map<string, { data: LiveTokenEconomicsPayload; expiresAt: number }>();

// In-flight de-dup (single-flight): if a merge for a range is already running,
// concurrent callers await the same promise instead of each firing their own
// incremental DB query.
const inFlight = new Map<
  string,
  Promise<{ payload: LiveTokenEconomicsPayload; source: LiveFetchSource }>
>();

// Cache directory resolution. READ and WRITE are deliberately split so the two
// deployment roles never interfere:
//
//   - Runtime (production API route): READ-ONLY. The server runs on a read-only
//     serverless filesystem and must never query the DB or write to disk. It
//     reads the *.json files that were pre-aggregated and packaged into the
//     deploy artifact under `<cwd>/.cache/token-economics/live/`. Resolving the
//     read dir does NO writability probe — a read-only FS can still read the
//     packaged cache, and the old "write a .write-test file first" probe was the
//     bug that silently redirected reads to an empty temp dir.
//
//   - Precompute (build/deploy machine, writable): the only writer. It runs the
//     incremental DB query and persists fresh JSON, which then gets packaged.
//
// TOKEN_ECON_LIVE_CACHE_DIR overrides the directory for both roles when set.
const CACHE_DIR_ENV = "TOKEN_ECON_LIVE_CACHE_DIR";

function cacheDir(): string {
  return (
    process.env[CACHE_DIR_ENV]?.trim() ||
    path.join(process.cwd(), ".cache", "token-economics", "live")
  );
}

function cachePath(range: LiveRangeKey): string {
  return path.join(cacheDir(), `${range}.json`);
}

/**
 * Read a pre-aggregated payload from the packaged JSON cache. Pure read: never
 * touches the DB, never writes, never throws — returns null if the file is
 * missing or unparseable. Safe to call on a read-only filesystem.
 */
export async function readJsonCache(range: LiveRangeKey): Promise<LiveTokenEconomicsPayload | null> {
  try {
    const content = await fs.readFile(cachePath(range), "utf-8");
    return JSON.parse(content) as LiveTokenEconomicsPayload;
  } catch {
    return null;
  }
}

// Monotonic per-process counter for unique tmp filenames. Date.now()/Math.random()
// are intentionally avoided (some harnesses forbid them); a counter is enough to
// keep concurrent writers in the same process from sharing a tmp file.
let _tmpSeq = 0;

/**
 * Persist a payload to the on-disk JSON cache via atomic write (write tmp →
 * rename). Used ONLY by the precompute script on a writable filesystem; the
 * runtime never calls this. The tmp filename carries pid + a per-process
 * counter so two concurrent writers can never clobber each other's half-written
 * file before the rename.
 */
export async function writeJsonCache(range: LiveRangeKey, data: LiveTokenEconomicsPayload): Promise<void> {
  const dir = cacheDir();
  const cacheFile = path.join(dir, `${range}.json`);
  const tmpPath = path.join(dir, `${range}.${process.pid}.${_tmpSeq++}.tmp`);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.writeFile(tmpPath, JSON.stringify(data), "utf-8");
    await fs.rename(tmpPath, cacheFile); // Atomic swap; readers never see a partial file
  } catch (err) {
    // Clean up the tmp file on failure so a read-only/full disk doesn't leave litter
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }
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
    SELECT
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
 * `persist` defaults to false so the runtime can never accidentally write to
 * its read-only filesystem; only the precompute script (writable build machine)
 * passes `persist: true`.
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

  // Only the precompute script (writable FS) persists. The runtime never writes.
  if (options.persist) {
    onProgress({ stage: "write-cache", message: "Writing cache to disk...", percent: 95 });
    await writeJsonCache(range.key, result);
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

  // Only the precompute script (writable FS) persists; the runtime merges in
  // memory and returns without ever touching the read-only disk.
  if (options.persist) {
    onProgress({ stage: "write-cache", message: "Writing updated cache to disk...", percent: 95 });
    await writeJsonCache(range.key, result);
    onProgress({ stage: "write-cache", message: "Incremental update complete!", percent: 100 });
  }

  return result;
}

/**
 * Which layer produced a runtime response. Surfaced to the API route as the
 * `X-Cache-Source` header so you can tell from the browser Network panel whether
 * a request was served from memory, the packaged baseline, or a live DB query.
 *
 *   - `l1-memory`     : served from the in-memory cache, ZERO DB work (fast).
 *   - `baseline-fresh`: the packaged baseline already covers the current bucket
 *                       (no boundary crossed since it was built) — returned as-is
 *                       with NO config read and NO DB query. Pure time arithmetic.
 *   - `single-flight` : joined an already-running merge for this range (fast).
 *   - `incremental-db`: packaged baseline + a DB query for the `baseline.to → now`
 *                       tail, merged in memory — AND it finished inside the SWR
 *                       wait window, so the caller got the fresh data directly.
 *   - `stale-swr`     : the refresh was still running after the SWR wait; the
 *                       expired baseline was served immediately (marked `stale`)
 *                       and the refresh keeps going — its result lands in L1.
 *   - `stale-baseline`: the refresh FAILED (DB blip); served the baseline as-is.
 *   - `full-db`       : no usable baseline; full re-aggregation from the DB (slow).
 */
export type LiveFetchSource =
  | "l1-memory"
  | "baseline-fresh"
  | "single-flight"
  | "incremental-db"
  | "stale-swr"
  | "stale-baseline"
  | "full-db";

export interface LiveFetchResult {
  payload: LiveTokenEconomicsPayload;
  source: LiveFetchSource;
  elapsedMs: number;
}

/** How long a request waits for the in-flight refresh before answering with
    the stale baseline. Long enough for a warm incremental query to win the
    race; short enough that a cold DB connection never holds first-byte. */
const SWR_WAIT_MS = 1_200;
/** L1 TTL for stale results — short so recovery is retried quickly. */
const STALE_TTL_MS = 10_000;

function cachePayload(range: LiveRangeKey, payload: LiveTokenEconomicsPayload): void {
  const ttlMs = payload.stale ? STALE_TTL_MS : msUntilNextBoundary(new Date());
  responseCache.set(range, { data: payload, expiresAt: Date.now() + ttlMs });
}

/** The actual refresh work — everything that may touch the DB lives here.
    Runs at most once per range at a time (single-flight via `inFlight`). */
async function refreshLivePayload(
  requestedRange: string | null | undefined,
  baseline: LiveTokenEconomicsPayload | null,
  now: Date,
): Promise<{ payload: LiveTokenEconomicsPayload; source: LiveFetchSource }> {
  if (baseline) {
    // Incrementally fetch only the new tail (baseline.to → now). Returns null
    // when incremental isn't valid (e.g. bucket size changed) — then fall
    // through to a full fetch.
    const merged = await incrementallyUpdateCache(requestedRange, baseline, now);
    if (merged) return { payload: merged, source: "incremental-db" };
  }
  return { payload: await fetchLiveTokenEconomics(requestedRange, now), source: "full-db" };
}

/**
 * Runtime entry point for the live leaderboard API. Designed for a read-only
 * serverless filesystem that CAN reach the DB:
 *
 *   1. L1 in-memory cache — serves concurrent bursts with zero DB load.
 *   2. Baseline boundary check (pure time arithmetic) — a packaged baseline
 *      that already reaches the current bucket IS the live answer.
 *   3. Stale-while-revalidate — an EXPIRED baseline is served immediately
 *      (marked `stale`) while a single-flight DB refresh runs; the request
 *      only waits SWR_WAIT_MS for it, so first-byte never blocks on a cold DB
 *      connection. The finished refresh always lands in L1 — on serverless the
 *      unfinished promise simply resumes on the next invocation (the client
 *      re-polls stale payloads quickly), so the refresh still lands without
 *      any background-execution guarantee.
 *   4. Fallbacks — refresh failure with a baseline serves the stale baseline;
 *      no baseline at all awaits one full fetch.
 *
 * Never writes to disk (`persist` is never set), so it is safe on read-only FS.
 * Returns the payload plus diagnostics (`source`, `elapsedMs`).
 */
export async function getLiveTokenEconomicsWithMeta(
  requestedRange: string | null | undefined,
  now = new Date(),
): Promise<LiveFetchResult> {
  const startedAt = Date.now();
  const range = liveRangeOption(requestedRange);
  const cacheKey = range.key;

  // 1. L1 in-memory cache.
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return {
      payload: { ...cached.data, generatedAt: now.toISOString() },
      source: "l1-memory",
      elapsedMs: Date.now() - startedAt,
    };
  }

  // 2. Read the packaged JSON cache as the historical baseline.
  const raw = await readJsonCache(cacheKey);
  const baseline =
    raw?.bucketSeconds && !Number.isNaN(Date.parse(raw.to)) ? compactLivePayload(raw) : null;

  // 2a. BOUNDARY CHECK: if the baseline already reaches the current data-as-of
  // boundary, no new bucket has closed since it was built — no DB needed.
  if (baseline && new Date(baseline.to) >= currentDataAsOf(now, baseline.bucketSeconds)) {
    cachePayload(cacheKey, baseline);
    return { payload: baseline, source: "baseline-fresh", elapsedMs: Date.now() - startedAt };
  }

  // 3. Start (or join) the single-flight refresh. Completion always lands in
  // L1 even if this request stops waiting for it below.
  const joined = inFlight.has(cacheKey);
  let work = inFlight.get(cacheKey);
  if (!work) {
    work = refreshLivePayload(requestedRange, baseline, now)
      .then((result) => {
        cachePayload(cacheKey, result.payload);
        return result;
      })
      .finally(() => inFlight.delete(cacheKey));
    // A refresh that fails AFTER the requester stopped waiting (SWR timeout)
    // has no awaiter left — log it here so it never becomes an unhandled
    // rejection. Requests racing `work` attach their own .catch.
    work.catch((err) =>
      console.warn(
        `[token-economics/live] Background refresh for ${cacheKey} failed:`,
        err instanceof Error ? err.message : err,
      ),
    );
    inFlight.set(cacheKey, work);
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
      console.warn(
        `[token-economics/live] Refresh for ${cacheKey} failed, serving stale baseline.`,
      );
    }
    const stalePayload: LiveTokenEconomicsPayload = { ...baseline, stale: true };
    cachePayload(cacheKey, stalePayload);
    return {
      payload: stalePayload,
      source: winner == null ? "stale-baseline" : "stale-swr",
      elapsedMs: Date.now() - startedAt,
    };
  }

  // 4. No usable baseline — nothing to answer with but the refresh itself.
  const { payload, source } = await work;
  return {
    payload,
    source: joined ? "single-flight" : source,
    elapsedMs: Date.now() - startedAt,
  };
}

/** Payload-only convenience wrapper around {@link getLiveTokenEconomicsWithMeta}. */
export async function getLiveTokenEconomics(
  requestedRange: string | null | undefined,
  now = new Date(),
): Promise<LiveTokenEconomicsPayload> {
  return (await getLiveTokenEconomicsWithMeta(requestedRange, now)).payload;
}
