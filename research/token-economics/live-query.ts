import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { VENDORS } from "@research/lib/vendors";
import type { VendorId } from "@research/lib/types";
import { vendorForSlug } from "./normalize";
import {
  DEFAULT_LIVE_START_ISO,
  LIVE_BOARD_ANCHORS,
  LIVE_DATA_LAG_SECONDS,
  LIVE_MODEL_PRICES,
  liveAnchorId,
  liveRangeOption,
  type LiveModelSeries,
  type LiveTokenEconomicsPayload,
  type LiveUsagePoint,
} from "./live-config";

const TABLE = "valid_usage";
const QUERY_TIMEOUT_US = 30_000_000;
export const LIVE_START_ENV = "TOKEN_ECON_LIVE_START_ISO";

const DB_ENV = {
  host: "TOKEN_ECON_LIVE_DB_HOST",
  port: "TOKEN_ECON_LIVE_DB_PORT",
  user: "TOKEN_ECON_LIVE_DB_USER",
  password: "TOKEN_ECON_LIVE_DB_PASSWORD",
  database: "TOKEN_ECON_LIVE_DB_DATABASE",
} as const;

export class LiveDbConfigError extends Error {
  constructor(readonly missing: string[]) {
    super(`Missing live usage database env: ${missing.join(", ")}`);
    this.name = "LiveDbConfigError";
  }
}

export class LiveConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveConfigError";
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
  pool = mysql.createPool({
    ...cfg,
    waitForConnections: true,
    connectionLimit: 4,
    queueLimit: 8,
    connectTimeout: 10_000,
    timezone: "Z",
    dateStrings: true,
    supportBigNumbers: true,
    decimalNumbers: true,
    enableKeepAlive: true,
  });
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

function chooseBucketSeconds(from: Date, to: Date): number {
  const hours = Math.max(0, (to.getTime() - from.getTime()) / 3_600_000);
  if (hours <= 12) return 60;
  if (hours <= 72) return 300;
  if (hours <= 24 * 21) return 3600;
  return 86400;
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
  for (let cur = from; cur <= to; cur = addSeconds(cur, bucketSeconds)) {
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

  const conn = await getPool().getConnection();
  try {
    await conn.query("SET SESSION time_zone = '+00:00'");
    await conn.query(`SET SESSION ob_query_timeout = ${QUERY_TIMEOUT_US}`).catch(() => {});
    const [rows] = await conn.query<LiveUsageRow[]>(sql, [
      ...params.slugs,
      sqlDate(params.from),
      sqlDate(params.to),
    ]);
    return rows;
  } finally {
    conn.release();
  }
}

function modelMeta(slug: string): { vendor: VendorId; vendorName: string } {
  const vendor = vendorForSlug(slug);
  return { vendor, vendorName: VENDORS[vendor]?.name ?? vendor };
}

export async function fetchLiveTokenEconomics(
  requestedRange: string | null | undefined,
  now = new Date(),
): Promise<LiveTokenEconomicsPayload> {
  const dataAsOf = new Date(now.getTime() - LIVE_DATA_LAG_SECONDS * 1000);
  const range = liveRangeOption(requestedRange);
  const start = liveStartDate();
  const rangeFrom =
    range.key === "all"
      ? start
      : maxDate(start, new Date(dataAsOf.getTime() - (range.hours ?? 72) * 3_600_000));
  const bucketSeconds = chooseBucketSeconds(rangeFrom, dataAsOf);
  const toBucket = floorToBucket(dataAsOf, bucketSeconds);
  const fromBucket = floorToBucket(rangeFrom, bucketSeconds);
  const buckets = buildBuckets(fromBucket, toBucket, bucketSeconds);

  const slugs = LIVE_MODEL_PRICES.map((m) => m.slug);
  const rowMap = new Map<string, Map<string, LiveUsagePoint>>();
  for (const row of await queryUsageRows({
    slugs,
    from: fromBucket,
    to: dataAsOf,
    bucketSeconds,
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

  const models: LiveModelSeries[] = LIVE_MODEL_PRICES.map((price) => {
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
      anchorId: liveAnchorId(price.anchor),
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

  const anchors = LIVE_BOARD_ANCHORS.map((anchor) => {
    const anchorModels = models
      .filter((m) => m.anchorId === anchor.id)
      .sort((a, b) => b.totalTokens - a.totalTokens || a.model.localeCompare(b.model));
    return {
      id: anchor.id,
      label: anchor.label,
      totalTokens: anchorModels.reduce((sum, m) => sum + m.totalTokens, 0),
      totalCost: anchorModels.reduce((sum, m) => sum + m.totalCost, 0),
      totalRequests: anchorModels.reduce((sum, m) => sum + m.totalRequests, 0),
      peakTokens: Math.max(0, ...anchorModels.flatMap((m) => m.points.map((p) => p.tokens))),
      peakCost: Math.max(0, ...anchorModels.flatMap((m) => m.points.map((p) => p.cost))),
      models: anchorModels,
    };
  });

  return {
    generatedAt: now.toISOString(),
    dataLagSeconds: LIVE_DATA_LAG_SECONDS,
    range: range.key,
    bucket: bucketLabel(bucketSeconds),
    bucketSeconds,
    from: fromBucket.toISOString(),
    to: dataAsOf.toISOString(),
    anchors,
    unanchored: models
      .filter((m) => m.anchorId === "unanchored")
      .sort((a, b) => b.totalTokens - a.totalTokens || a.model.localeCompare(b.model)),
  };
}
