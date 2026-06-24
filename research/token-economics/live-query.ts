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
const CACHE_TTL_MS_ENV = "TOKEN_ECON_LIVE_CACHE_TTL_MS";
const DEFAULT_CACHE_TTL_MS = 10_000; // 10s default cache for live data
const QUERY_TIMEOUT_ENV = "TOKEN_ECON_LIVE_QUERY_TIMEOUT_MS";
const DEFAULT_QUERY_TIMEOUT_MS = 60_000;

// Simple in-memory cache to avoid hitting DB on duplicate concurrent/stale requests
const responseCache = new Map<string, { data: LiveTokenEconomicsPayload; expiresAt: number }>();

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

function bucketExpression(bucketSeconds: number): string {
  if (bucketSeconds === 60) return "DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:00')";
  if (bucketSeconds === 3600) return "DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00')";
  if (bucketSeconds === 86400) return "DATE_FORMAT(created_at, '%Y-%m-%d 00:00:00')";
  return (
    "DATE_FORMAT(FROM_UNIXTIME(" +
    `FLOOR(UNIX_TIMESTAMP(created_at) / ${bucketSeconds}) * ${bucketSeconds}` +
    "), '%Y-%m-%d %H:%i:%s')"
  );
}

function bucketLabel(bucketSeconds: number): string {
  if (bucketSeconds === 60) return "1-min";
  if (bucketSeconds === 300) return "5-min";
  if (bucketSeconds === 3600) return "1-hour";
  if (bucketSeconds === 86400) return "1-day";
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

export async function fetchLiveTokenEconomics(
  requestedRange: string | null | undefined,
  now = new Date(),
): Promise<LiveTokenEconomicsPayload> {
  const range = liveRangeOption(requestedRange);
  const cacheKey = range.key;
  const cacheTtlMs = liveMsEnv(CACHE_TTL_MS_ENV, DEFAULT_CACHE_TTL_MS);
  const queryTimeoutMs = liveMsEnv(QUERY_TIMEOUT_ENV, DEFAULT_QUERY_TIMEOUT_MS);
  const queryTimeoutUs = queryTimeoutMs * 1000;

  // Check cache first
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    // Update generatedAt to avoid stale timestamps without re-querying
    return {
      ...cached.data,
      generatedAt: now.toISOString(),
    };
  }

  const liveConfig = await loadLiveModelConfig();
  const bucketSeconds = liveBucketSeconds();
  const refreshIntervalSeconds = liveRefreshIntervalSeconds();
  const refreshBoundary = floorToBucket(now, refreshIntervalSeconds);
  const dataAsOf = floorToBucket(refreshBoundary, bucketSeconds);
  const start = liveStartDate();
  const rangeFrom =
    range.key === "all"
      ? start
      : maxDate(start, new Date(dataAsOf.getTime() - (range.hours ?? 72) * 3_600_000));
  const fromBucket = floorToBucket(rangeFrom, bucketSeconds);
  const buckets = buildBuckets(fromBucket, dataAsOf, bucketSeconds);

  const slugs = liveConfig.models.map((m) => m.slug);
  const rowMap = new Map<string, Map<string, LiveUsagePoint>>();
  for (const row of await queryUsageRows({
    slugs,
    from: fromBucket,
    to: dataAsOf,
    bucketSeconds,
    timeoutUs: queryTimeoutUs,
  })) {
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

  const result: LiveTokenEconomicsPayload = {
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
  };

  // Store in cache
  responseCache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + cacheTtlMs,
  });

  return result;
}
