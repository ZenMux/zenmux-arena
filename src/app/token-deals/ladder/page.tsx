// Token Deals — THE LADDER. Server shell (ticker nav + amber masthead band);
// the ranked bars + trend charts live in LadderClient. Like the board, the
// packaged baseline is read server-side and passed as initialData so the
// ladder is ranked on first paint; LadderClient polls /api/token-deals/live
// to settle the numbers.

import type { Metadata } from "next";
import { TokenDealsNav } from "../TokenDealsNav";
import { LadderClient } from "./LadderClient";
import { loadInitialDeals } from "../initial-deals";

export const metadata: Metadata = {
  title: "The Discount Ladder — Token Deals · ZenMux Arena",
  description:
    "Every ZenMux model deal ranked: subsidy dollars, in-deal tokens, and discount depth — bars for the glance, cumulative curves for the trend.",
};

export const dynamic = "force-dynamic";

export default async function TokenDealsLadderPage() {
  const initialData = await loadInitialDeals();
  return (
    <>
      <TokenDealsNav active="ladder" />
      <div className="border-b-[3px] border-[#0a0a0b] bg-[#d9940a]">
        <div className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-8 sm:py-10">
          <h1 className="font-[family-name:var(--font-deals-display)] text-[clamp(2rem,5.4vw,4.8rem)] uppercase leading-[0.95] tracking-tight text-[#442c00]">
            The discount ladder
          </h1>
          <p className="mt-3 max-w-3xl font-[family-name:var(--font-deals-mono)] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#442c00]/75 sm:text-xs">
            Every deal ranked by what it gives away — bars for the glance, curves for the trend
          </p>
        </div>
      </div>
      <LadderClient initialData={initialData} />
    </>
  );
}
