// Server-only loader for the board/ladder pages' first paint.
//
// Reads the packaged baseline (.cache/token-deals/all.json) straight off the
// local filesystem — no DB, no API round-trip — and hands it to the client
// components as initialData. The numbers may be hours old (the baseline is
// frozen at deploy time), so the payload is marked `stale`; useDealsFeed
// fetches the live payload immediately on mount and the figures settle in
// place. If the baseline is missing/unusable the pages just fall back to the
// old skeleton-then-fetch behavior (initialData null).

import { readJsonCache, compactDealsPayload } from "@research/token-deals/query";
import { DEALS_SCHEMA_VERSION, type TokenDealsPayload } from "@research/token-deals/types";

export async function loadInitialDeals(): Promise<TokenDealsPayload | null> {
  try {
    const baseline = await readJsonCache("all");
    if (!baseline || baseline.schema !== DEALS_SCHEMA_VERSION || !baseline.live) return null;
    // compact: legacy baselines carry full-precision floats; rounding here
    // keeps the RSC flight data (embedded in the HTML) small.
    return compactDealsPayload({ ...baseline, stale: true });
  } catch {
    return null;
  }
}
