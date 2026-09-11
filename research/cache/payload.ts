import { createHash } from "node:crypto";
import type { LiveTokenEconomicsPayload } from "../token-economics/live-config";
import { DEALS_SCHEMA_VERSION, type TokenDealsPayload } from "../token-deals/types";

export type CacheScope = "token-economics" | "token-deals";
export type CacheRange = "all" | "72h";
export interface SnapshotId {
  scope: CacheScope;
  version: number;
  range: CacheRange;
}
export interface SnapshotPayload {
  range: string;
  from: string;
  to: string;
  generatedAt: string;
  bucketSeconds: number;
  refreshIntervalSeconds: number;
  stale?: boolean;
}

export function snapshotId(scope: CacheScope, range: CacheRange): SnapshotId {
  return { scope, range, version: scope === "token-deals" ? DEALS_SCHEMA_VERSION : 1 };
}

export function snapshotKey(id: SnapshotId): string {
  return `${id.scope}:v${id.version}:${id.range}`;
}

function validWindow(p: SnapshotPayload, range: CacheRange): boolean {
  return p.range === range && Number.isFinite(Date.parse(p.from)) &&
    Number.isFinite(Date.parse(p.to)) && Date.parse(p.from) <= Date.parse(p.to) &&
    Number.isFinite(Date.parse(p.generatedAt)) && Number.isSafeInteger(p.bucketSeconds) &&
    p.bucketSeconds > 0 && Number.isSafeInteger(p.refreshIntervalSeconds) && p.refreshIntervalSeconds > 0;
}

export function validEconomics(value: unknown, range: CacheRange): value is LiveTokenEconomicsPayload {
  if (!value || typeof value !== "object") return false;
  const p = value as LiveTokenEconomicsPayload;
  if (!validWindow(p, range) || !Array.isArray(p.anchors) || !Array.isArray(p.unanchored)) return false;
  if (!p.anchors.every(a => Array.isArray(a.models))) return false;
  const models = [...p.anchors.flatMap(a => a.models), ...p.unanchored];
  return models.length > 0 && models.every(m => typeof m.slug === "string" && Array.isArray(m.points) &&
    m.points.every(point => Number.isFinite(Date.parse(point.t)) &&
      [point.tokens, point.cost, point.requests, point.promptTokens, point.completionTokens, point.reasoningTokens].every(Number.isFinite)));
}

export function validDeals(value: unknown, range: CacheRange): value is TokenDealsPayload {
  if (!value || typeof value !== "object") return false;
  const p = value as TokenDealsPayload;
  return validWindow(p, range) && p.schema === DEALS_SCHEMA_VERSION && p.live === true &&
    p.totals != null && Array.isArray(p.deals) && p.deals.length > 0 && p.deals.every(d =>
      d.stats != null && Array.isArray(d.points) && d.points.every(point =>
        Number.isFinite(Date.parse(point.t)) &&
        [point.tokens, point.paid, point.saved, point.subPaid, point.subSaved, point.requests].every(Number.isFinite)));
}

/** Stable across Postgres JSONB key ordering; arrays and all numeric values are preserved. */
export function canonicalJson(value: unknown): string {
  function stable(v: unknown): string {
    if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
    if (v && typeof v === "object") {
      return `{${Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([k, item]) => `${JSON.stringify(k)}:${stable(item)}`).join(",")}}`;
    }
    return JSON.stringify(v);
  }
  // Match the actual transport (omitted undefined object fields, null array
  // slots, Date serialization) before sorting JSONB's unordered object keys.
  return stable(JSON.parse(JSON.stringify(value)));
}

export function payloadHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function snapshotExpiresAt(id: SnapshotId, payload: SnapshotPayload): string {
  // Economics reports closed buckets (ALL is daily); Deals includes the open
  // daily/hourly bucket and advances at the five-minute refresh boundary.
  const seconds = id.scope === "token-economics"
    ? Math.max(payload.bucketSeconds, payload.refreshIntervalSeconds)
    : payload.refreshIntervalSeconds;
  return new Date(Date.parse(payload.to) + seconds * 1000).toISOString();
}
