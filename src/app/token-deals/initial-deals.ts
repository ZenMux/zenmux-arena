import "server-only";
import { getTokenDealsWithMeta } from "@research/token-deals/snapshot";
import type { TokenDealsPayload } from "@research/token-deals/types";

/** First paint and API polling use the same shared snapshot and refresh lease. */
export async function loadInitialDeals(): Promise<TokenDealsPayload | null> {
  try {
    const { payload } = await getTokenDealsWithMeta("all", new Date());
    return payload.live ? payload : null;
  } catch {
    return null;
  }
}
