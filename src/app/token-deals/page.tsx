// Token Deals（让利账本）— the landing surface. The shell (nav + headline strip)
// renders on the server; everything money-related lives in DealsClient, which
// polls /api/token-deals/live (all data arrives client-side, so the page itself
// stays static-fast and the skeleton shows instantly).

import type { Metadata } from "next";
import { TokenDealsNav } from "./TokenDealsNav";
import { DealsClient } from "./DealsClient";

export const metadata: Metadata = {
  title: "Token Deals · 让利账本 — ZenMux Arena",
  description:
    "A live, public ledger of ZenMux's model subsidies: list price → deal price for every discounted model, and the running total saved for developers.",
};

export default function TokenDealsPage() {
  return (
    <>
      <TokenDealsNav active="deals" />
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-6 sm:px-6">
        <div className="grid gap-2 border border-[#141414] bg-[#fbf9f4] px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#6f6a5f]">
            Subsidy ledger experiment · 一份账本，两个受众
          </p>
          <h1 className="max-w-4xl text-xl font-bold uppercase leading-tight tracking-[0.06em] text-[#141414] sm:text-2xl">
            We&apos;re paying part of your token bill. Here&apos;s the receipt —
            live, model by model.
          </h1>
        </div>
      </div>
      <DealsClient />
    </>
  );
}
