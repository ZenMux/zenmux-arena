// Token Deals（让利账本）— shared DB pool, env plumbing, and time helpers.
//
// Same billing DB as the token-economics live pipeline — the deals ledger reads
// the identical tables, so it reuses those env vars on purpose (one secret to
// provision, not two). The pool is deliberately separate from token-economics'
// (that module may not be modified per the PRD), but tuned the same way.

import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

export const REFRESH_INTERVAL_SECONDS = 300;
export const HOUR = 3600;
export const DAY = 86400;

/** Per-query timeout. Overridable so the writable scripts (precompute /
    backfill), which don't care about first-byte latency, can run with a much
    larger budget than the serverless runtime — a chunk that needs 150s should
    succeed on the build machine, not die at 120s. */
const QUERY_TIMEOUT_ENV = "TOKEN_DEALS_QUERY_TIMEOUT_MS";
const DEFAULT_QUERY_TIMEOUT_MS = 120_000;

export function queryTimeoutMs(): number {
  const raw = process.env[QUERY_TIMEOUT_ENV]?.trim();
  if (!raw) return DEFAULT_QUERY_TIMEOUT_MS;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : DEFAULT_QUERY_TIMEOUT_MS;
}

const DB_ENV = {
  host: "TOKEN_ECON_LIVE_DB_HOST",
  port: "TOKEN_ECON_LIVE_DB_PORT",
  user: "TOKEN_ECON_LIVE_DB_USER",
  password: "TOKEN_ECON_LIVE_DB_PASSWORD",
  database: "TOKEN_ECON_LIVE_DB_DATABASE",
} as const;

/** Ledger start: ZenMux's launch day. Deal windows and free-model ledgers are
    clamped to this instant — discount rows fully reverted before it never
    surface. Deliberately NOT the shared TOKEN_ECON_LIVE_START_ISO env var:
    token-economics keeps its own (much later) live window, and widening that
    one would silently drag the econ pipeline back to 2025. */
export const DEALS_START_ENV = "TOKEN_DEALS_START_ISO";
export const DEALS_LAUNCH_ISO = "2025-09-29T00:00:00.000Z";

export class DealsDbConfigError extends Error {
  constructor(readonly missing: string[]) {
    super(`Missing live usage database env: ${missing.join(", ")}`);
    this.name = "DealsDbConfigError";
  }
}

export function dealsStartMs(): number {
  const raw = process.env[DEALS_START_ENV]?.trim() || DEALS_LAUNCH_ISO;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    throw new DealsDbConfigError([`${DEALS_START_ENV} (invalid ISO date: ${JSON.stringify(raw)})`]);
  }
  return ms;
}

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

let pool: Pool | null = null;

export function getPool(): Pool {
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

/** Run one query on a UTC-pinned session with retry-once semantics (transient
    OceanBase blips destroy the connection and retry on a fresh one). */
export async function queryRows<T extends RowDataPacket>(
  sql: string,
  values: unknown[],
): Promise<T[]> {
  const timeoutMs = queryTimeoutMs();
  let retries = 2;
  for (;;) {
    const conn = await getPool().getConnection();
    try {
      await conn.query("SET SESSION time_zone = '+00:00'");
      await conn.query(`SET SESSION ob_query_timeout = ${timeoutMs * 1000}`).catch(() => {});
      const [rows] = await conn.query<T[]>({ sql, values, timeout: timeoutMs });
      conn.release();
      return rows;
    } catch (err) {
      conn.destroy();
      retries--;
      if (retries <= 0) throw err;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

export function floorTo(ms: number, seconds: number): number {
  const step = seconds * 1000;
  return Math.floor(ms / step) * step;
}

/** "2026-06-23 06:00:00" (UTC, for created_at/gmt_* comparisons). */
export function sqlDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

/** Parse a UTC "YYYY-MM-DD HH:MM:SS" from a dateStrings session. */
export function parseSqlUtc(value: string | Date | null | undefined): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  const ms = Date.parse(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(ms) ? null : ms;
}

/** "YYYY-MM-DD" (UTC calendar date) of an instant. */
export function utcDateOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function toNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
