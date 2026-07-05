// Token Deals — THE BOARD landing surface. A server component: the shell
// (ticker nav + opener headline) renders statically, and the packaged baseline
// (.cache/token-deals/all.json) is read off the local filesystem and passed to
// DealsClient as initialData — so the first paint already carries the full
// board, no skeleton. DealsClient then polls /api/token-deals/live to settle
// the numbers live.

import type { Metadata } from "next";
import { TokenDealsNav } from "./TokenDealsNav";
import { DealsClient } from "./DealsClient";
import { loadInitialDeals } from "./initial-deals";

export const metadata: Metadata = {
  title: "Token Deals — the live discount board · ZenMux Arena",
  description:
    "A live public ledger of ZenMux's model subsidies: list price → deal price for every discounted model, and the running total saved for developers.",
};

// Read the baseline per request, not once at build: the packaged file is
// deploy-frozen, but a writable deployment (or local dev) may refresh it.
export const dynamic = "force-dynamic";

export default async function TokenDealsPage() {
  const initialData = await loadInitialDeals();
  return (
    <>
      <TokenDealsNav active="board" />
      <div className="border-b-[3px] border-[#0a0a0b] bg-white">
        <div className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-8 sm:py-10">
          <h1 className="max-w-6xl font-[family-name:var(--font-deals-display)] text-[clamp(1.8rem,4.6vw,4.2rem)] uppercase leading-[0.95] tracking-tight text-[#0a0a0b]">
            We&apos;re paying part of your token bill.
            <br />
            <span className="text-[#0c6b33]">Here&apos;s the receipt.</span>
          </h1>
          <p className="mt-3 font-[family-name:var(--font-deals-mono)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0a0a0b]/60 sm:text-xs">
            Live · model by model · from the same billing data that produces your invoices
          </p>
        </div>
      </div>
      <DealsClient initialData={initialData} />
    </>
  );
}
