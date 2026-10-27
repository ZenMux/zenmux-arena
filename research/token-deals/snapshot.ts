import { snapshotId, snapshotKey, validDeals } from "../cache/payload";
import { supabaseSnapshotStore } from "../cache/supabase";
import { sharedSnapshotCache } from "../cache/read-through";
import { compactDealsPayload } from "./presentation";
import { DEALS_SCHEMA_VERSION, DEFAULT_DEAL_RANGE, dealRangeOption, dealStatus,
  type DealRangeKey, type DealSeries, type TokenDealsPayload } from "./types";

export async function readSharedCache(range: DealRangeKey): Promise<TokenDealsPayload | null> {
  const value = await supabaseSnapshotStore<TokenDealsPayload>(snapshotId("token-deals", range)).read();
  return validDeals(value, range) ? value : null;
}

export async function getTokenDealsWithMeta(requestedRange: string | null | undefined, now = new Date()) {
  const range = dealRangeOption(requestedRange).key;
  const id = snapshotId("token-deals", range);
  const result = await sharedSnapshotCache().get<TokenDealsPayload>({
    key: snapshotKey(id), store: supabaseSnapshotStore(id), now,
    valid: (value): value is TokenDealsPayload => validDeals(value, range),
    fresh: (p, at) => Date.parse(p.to) >= Math.floor(at.getTime() / (p.refreshIntervalSeconds * 1000)) * p.refreshIntervalSeconds * 1000,
  });
  return { ...result, payload: compactDealsPayload(result.payload) };
}

export async function buildDegradedPayload(now = new Date()): Promise<TokenDealsPayload> {
  const candidates = await Promise.all(["all", "72h"].map(range => readSharedCache(range as DealRangeKey).catch(() => null)));
  const baseline = candidates.find(b => b?.schema === DEALS_SCHEMA_VERSION) ?? null;
  const visible: DealSeries[] = (baseline?.deals ?? []).map(deal => ({ ...deal,
    status: dealStatus(deal, now), stats: null, points: null,
  })).filter(deal => deal.status !== "scheduled").sort((a, b) => a.discount - b.discount);
  return {
    schema: DEALS_SCHEMA_VERSION, generatedAt: now.toISOString(), refreshIntervalSeconds: 300,
    range: DEFAULT_DEAL_RANGE, bucketSeconds: 86400,
    from: baseline?.from ?? now.toISOString(), to: baseline?.to ?? now.toISOString(),
    live: false, stale: true, lastSuccessAt: baseline?.lastSuccessAt ?? null,
    activeCount: visible.filter(d => d.status === "active").length,
    endedCount: visible.filter(d => d.status === "ended").length,
    totals: null, deals: visible,
  };
}
