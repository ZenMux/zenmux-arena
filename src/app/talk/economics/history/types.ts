import type { LiveTokenEconomicsPayload } from "@research/token-economics/live-config";

/** A published research artifact, never a mutable live-data cache. */
export interface HistoricalEconomicsData {
  kind: "deepseek-challenge-history";
  version: 1;
  window: { from: string; to: string; endDateInclusive: string; timezone: "UTC"; days: number };
  provenance: {
    source: "Supabase arena_snapshot_cache";
    snapshotKey: string;
    sourceFrom: string;
    sourceTo: string;
    sourceGeneratedAt: string;
    sourceWasStale: boolean;
    extractedAt: string;
    sourcePayloadSha256: string;
    selectedPayloadSha256: string;
    coverage: { slug: string; first: string; last: string; days: number }[];
    notes: string[];
  };
  payload: LiveTokenEconomicsPayload;
}
