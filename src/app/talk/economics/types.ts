import type { TokenEconomicsData } from "@research/token-economics/types";

export type EconomicsView = "map" | "ladder" | "live" | "deals";

export interface EconomicsResponse {
  data: TokenEconomicsData;
  provenance: {
    listingSource: string;
    listingRetrievedAt: string;
    usageSource: string;
    usageCacheSeconds: number;
    /** Latest actual daily observation, NOT a common cutoff for every model. */
    latestObservedUsageDate: string | null;
    observedModels: number;
    requestedModels: number;
    managementConfigured: boolean;
  };
}
