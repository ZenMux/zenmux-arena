import type { TokenEconomicsData } from "./types";
import type { SnapshotPayload } from "../cache/payload";
import { snapshotKey, type SnapshotId } from "../cache/payload";
import { sharedSnapshotCache } from "../cache/read-through";
import { supabaseSnapshotStore } from "../cache/supabase";

export const COMPARISON_REFRESH_SECONDS = 86400;
/** Reserved for the listing/launch-window publication; live snapshots remain v1. */
export const COMPARISON_SNAPSHOT_ID: SnapshotId = { scope: "token-economics", version: 2, range: "all" };
export interface EconomicsComparison {
  data: TokenEconomicsData;
  provenance: {
    listingSource: string;
    listingRetrievedAt: string;
    usageSource: string;
    usageCacheSeconds: number;
    latestObservedUsageDate: string | null;
    observedModels: number;
    requestedModels: number;
    usageAvailable: boolean;
  };
}
export type ComparisonSnapshot = SnapshotPayload & EconomicsComparison;

export function validComparison(value: unknown): value is ComparisonSnapshot {
  if (!value || typeof value !== "object") return false;
  const p = value as ComparisonSnapshot;
  return p.range === "all" && Number.isFinite(Date.parse(p.generatedAt)) &&
    p.from === p.generatedAt && p.to === p.generatedAt && p.bucketSeconds === COMPARISON_REFRESH_SECONDS &&
    p.refreshIntervalSeconds === COMPARISON_REFRESH_SECONDS &&
    !!p.data && p.data.generatedAt === p.generatedAt &&
    !!p.data.basket && Number.isFinite(p.data.basket.inputTokens) && Number.isFinite(p.data.basket.outputTokens) &&
    Array.isArray(p.data.models) && p.data.models.length > 0 &&
    p.data.models.every(m => !!m && typeof m.slug === "string" && typeof m.name === "string" &&
      typeof m.vendor === "string" && typeof m.shortName === "string" &&
      Number.isFinite(m.inputPrice) && m.inputPrice >= 0 && Number.isFinite(m.outputPrice) && m.outputPrice >= 0 &&
      Number.isFinite(m.blendedCost)) &&
    Array.isArray(p.data.vendors) && p.data.vendors.length > 0 &&
    !!p.data.summary && p.data.summary.modelCount === p.data.models.length &&
    p.data.summary.vendorCount === p.data.vendors.length &&
    !!p.provenance && p.provenance.listingRetrievedAt === p.generatedAt &&
    p.provenance.usageAvailable === true && Number.isInteger(p.provenance.observedModels) &&
    Number.isInteger(p.provenance.requestedModels) && p.provenance.observedModels >= 0 &&
    p.provenance.requestedModels >= p.data.models.length && p.provenance.observedModels <= p.provenance.requestedModels;
}

export async function getEconomicsComparison(now = new Date()) {
  const id = COMPARISON_SNAPSHOT_ID;
  return sharedSnapshotCache().get<ComparisonSnapshot>({
    key: snapshotKey(id), store: supabaseSnapshotStore(id), now,
    valid: validComparison,
    fresh: (p, at) => Date.parse(p.generatedAt) + COMPARISON_REFRESH_SECONDS * 1000 > at.getTime(),
  });
}
