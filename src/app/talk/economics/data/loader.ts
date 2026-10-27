import { getEconomicsComparison } from "@research/token-economics/comparison-snapshot";
import type { EconomicsResponse } from "../types";

export async function loadEconomicsData(): Promise<EconomicsResponse> {
  const { payload } = await getEconomicsComparison();
  return { data: payload.data, provenance: payload.provenance };
}
