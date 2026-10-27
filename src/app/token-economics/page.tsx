// Per-request rendering of the latest Supabase publication.
import { preload } from "react-dom";
import type { TokenEconomicsData } from "@research/token-economics/types";
import { DEFAULT_LIVE_RANGE } from "@research/token-economics/live-config";
import { getEconomicsComparison } from "@research/token-economics/comparison-snapshot";
import { TokenEconClient } from "./TokenEconClient";

export const revalidate = 0;

async function loadData(): Promise<TokenEconomicsData> {
  return (await getEconomicsComparison()).payload.data;
}

export default async function TokenEconomicsPage() {
  // Kick the LIVE tape's payload fetch off with the HTML (a <link rel="preload"
  // as="fetch"> in the head) so it downloads in parallel with the JS bundle
  // instead of waiting for hydration. The payload is far too large (~880KB raw
  // for "all") to embed as RSC initialData — preload gets the same head start
  // without bloating the HTML. LiveLeaderboard's fetch must stay cache-mode
  // compatible (no `cache: "no-store"`) for the browser to reuse this, and
  // crossOrigin must be set: a bare link-preload's credentials mode is
  // "include" while fetch() defaults to "same-origin" — without matching modes
  // the browser discards the preloaded response.
  preload(`/api/token-economics/live?range=${DEFAULT_LIVE_RANGE}`, {
    as: "fetch",
    crossOrigin: "anonymous",
  });

  const data = await loadData();

  return <TokenEconClient data={data} />;
}
