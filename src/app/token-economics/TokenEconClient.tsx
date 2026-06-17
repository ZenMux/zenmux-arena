"use client";

// The orchestrating client view for Token Economics. Renders the nof1-style
// ticker strip + headline stat boxes (always on), then switches between the
// three surfaces by the ?view= query (kept in step with the top-nav links).
//
// useSearchParams opts this subtree into client rendering; it's wrapped in a
// Suspense boundary by the parent layout's nav, and we read it directly here
// since the whole client view is already dynamic.

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { TokenEconomicsData } from "@research/token-economics/types";
import { usd, perDay, perDollarDay } from "./lib";
import { StatBox } from "./components";
import { Leaderboard } from "./Leaderboard";
import { Consumption } from "./Consumption";
import { ValueMap } from "./ValueMap";
import { ValueByVendor } from "./ValueByVendor";

type View = "leaderboard" | "consumption" | "value" | "vendor-value";

export function TokenEconClient({ data }: { data: TokenEconomicsData }) {
  return (
    <Suspense fallback={<Shell data={data} view="leaderboard" />}>
      <Routed data={data} />
    </Suspense>
  );
}

function Routed({ data }: { data: TokenEconomicsData }) {
  const params = useSearchParams();
  const view = (params.get("view") ?? "leaderboard") as View;
  return <Shell data={data} view={view} />;
}

function Shell({
  data,
  view,
}: {
  data: TokenEconomicsData;
  view: View;
}) {
  const s = data.summary;

  return (
    <div>
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {/* ── Title block ── */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold uppercase leading-none tracking-tight sm:text-3xl">
            Token Economics
          </h1>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-[#6f6a5f]">
            Every text model ZenMux serves, scored on two axes:{" "}
            <b className="text-[#141414]">what it costs</b> and{" "}
            <b className="text-[#141414]">how much it&apos;s actually used</b>.
            Prices are scraped live from the model listing; consumption is the
            observed token volume. The question: where does the compute — and the
            money — really flow?
          </p>
        </div>

        {/* ── Headline stat boxes ── */}
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatBox
            label="Busiest / Day"
            value={s.busiestDaily ? s.busiestDaily.name : "—"}
            sub={s.busiestDaily ? perDay(s.busiestDaily.avgDailyTokens) : undefined}
          />
          <StatBox
            label="Best Value"
            value={s.bestValue ? s.bestValue.name : "—"}
            sub={s.bestValue ? perDollarDay(s.bestValue.avgDailyPerDollar) : undefined}
            accent="#1a8a4a"
          />
          <StatBox
            label="Priciest Basket"
            value={s.priciest ? usd(s.priciest.blendedCost) : "—"}
            sub={s.priciest ? s.priciest.name : undefined}
            accent="#cf3636"
          />
          <StatBox
            label="Cheapest Basket"
            value={s.cheapest ? usd(s.cheapest.blendedCost) : "—"}
            sub={s.cheapest ? s.cheapest.name : undefined}
            accent="#1a8a4a"
          />
        </div>

        {/* ── Active surface ── */}
        {view === "leaderboard" && <Leaderboard data={data} />}
        {view === "consumption" && <Consumption data={data} />}
        {view === "value" && <ValueMap data={data} />}
        {view === "vendor-value" && <ValueByVendor data={data} />}

        {/* ── Footer / methodology ── */}
        <footer className="mt-10 border-t border-[#141414] pt-4 text-[10px] leading-relaxed text-[#6f6a5f]">
          <p>
            <b className="text-[#141414]">METHOD.</b> Basket cost = input price ×
            100,000 + output price × 1,000 tokens (prices quoted per 1M). Data
            scraped from{" "}
            <a
              href={data.source}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-[#141414]/40 underline-offset-2 hover:decoration-[#141414]"
            >
              zenmux.ai/models
            </a>{" "}
            on {new Date(data.generatedAt).toISOString().slice(0, 10)}. Free /
            unpriced models excluded.
          </p>
          <p className="mt-2">
            <b className="text-[#141414]">AVG DAILY.</b> Each model&apos;s{" "}
            <b className="text-[#141414]">launch velocity</b> — total tokens over
            its first <b className="text-[#141414]">14 working days</b> (Mon–Fri)
            on/after release, divided by the working days that have elapsed (a
            per-working-day rate, so it&apos;s comparable across release dates,
            unlike all-time usage which favors older models). Daily series from
            ZenMux&apos;s model-usage API. <b className="text-[#141414]">Value</b>{" "}
            = avg daily tokens ÷ basket cost; the Value Ladder and Value Map rank
            by it. Partial windows (models younger than 14 working days) are
            flagged.
          </p>
          <p className="mt-2">
            Part of{" "}
            <Link href="/" className="font-bold text-[#141414] underline decoration-[#141414]/40 underline-offset-2 hover:decoration-[#141414]">
              ZenMux Arena
            </Link>{" "}
            · built by thinkthinking · zenmux.ai
          </p>
        </footer>
      </div>
    </div>
  );
}
