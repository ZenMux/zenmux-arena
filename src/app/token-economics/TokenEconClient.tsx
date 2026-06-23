"use client";

// The orchestrating client view for Token Economics. It switches between the
// five surfaces by an ACTIVE VIEW held in client state; Live gets its own
// chart-first layout while the other views keep the headline economics shell.
//
// WHY STATE, NOT SERVER NAVIGATION. The price surfaces share ONE identical `data`
// payload — switching view only chooses which component to render. The page is
// now dynamic (revalidate = 0), so a <Link>/router.push to ?view= would pointlessly
// re-run the server render (re-fetching the live listing) and make the tab "hang"
// until the round-trip lands. Instead the active view comes from the URL via
// useSyncExternalStore (SSR-safe: server snapshot is always "leaderboard", so no
// hydration mismatch), and a click mirrors the new view to the URL with
// history.replaceState + a manual dispatch — instant switch, NO server hit, while
// the address bar stays shareable and back/forward keeps working.

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import type { TokenEconomicsData } from "@research/token-economics/types";
import { usd, perDay, perDollarDay } from "./lib";
import { StatBox } from "./components";
import { TokenEconNav, type View } from "./TokenEconNav";
import { Leaderboard } from "./Leaderboard";
import { LiveLeaderboard } from "./LiveLeaderboard";
import { Consumption } from "./Consumption";
import { ValueMap } from "./ValueMap";
import { ValueByVendor } from "./ValueByVendor";
import { PriceVsDemand } from "./PriceVsDemand";
import { ChartFrame } from "./ChartFrame";

const VALID_VIEWS: readonly View[] = [
  "live",
  "leaderboard",
  "consumption",
  "value",
  "vendor-value",
];

/** Custom event the changeView setter fires so useSyncExternalStore re-reads the
 *  URL after a history.replaceState (which, unlike popstate, emits no event). */
const VIEW_EVENT = "te:viewchange";

/** Parse the active view from the live URL; unknown/missing → live. */
function readView(): View {
  const v = new URLSearchParams(window.location.search).get("view");
  return VALID_VIEWS.includes(v as View) ? (v as View) : "live";
}

/** Subscribe to both our own replaceState event and the browser's back/forward. */
function subscribeView(onChange: () => void): () => void {
  window.addEventListener(VIEW_EVENT, onChange);
  window.addEventListener("popstate", onChange);
  // The server snapshot is intentionally "live" to keep hydration stable. Nudge
  // the store once after mount so deep links like ?view=value become active
  // without waiting for a later popstate or tab click.
  const syncId = window.setTimeout(onChange, 0);
  return () => {
    window.clearTimeout(syncId);
    window.removeEventListener(VIEW_EVENT, onChange);
    window.removeEventListener("popstate", onChange);
  };
}

export function TokenEconClient({ data }: { data: TokenEconomicsData }) {
  // useSyncExternalStore is the SSR-safe way to derive state from a browser API:
  // the server snapshot ("live") matches the first client paint (no
  // hydration mismatch), then it re-reads the URL on every view change.
  const view = useSyncExternalStore(
    subscribeView,
    readView,
    () => "live" as View,
  );

  // Switch view instantly + mirror to the URL with NO server round-trip, then
  // notify the store so the render updates.
  const changeView = useCallback((next: View) => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event(VIEW_EVENT));
  }, []);

  return (
    <>
      <TokenEconNav view={view} onViewChange={changeView} />
      <main className="flex-1">
        <Shell data={data} view={view} />
      </main>
    </>
  );
}

function Shell({
  data,
  view,
}: {
  data: TokenEconomicsData;
  view: View;
}) {
  if (view === "live") {
    return (
      <div className="mx-auto max-w-none px-3 py-3 sm:px-4 lg:px-5">
        <ChartFrame filename="live-leaderboard">
          <div className="min-w-0">
            <LiveLeaderboard />
          </div>
        </ChartFrame>
      </div>
    );
  }

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
            money — really flow? The Live view adds minute-to-day token tapes for
            the newly discounted DeepSeek anchor cohorts.
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

        {/* ── Active surface ── each chart wrapped so it can export to PNG. ── */}
        {view === "leaderboard" && (
          <ChartFrame filename="leaderboard">
            <Leaderboard data={data} />
          </ChartFrame>
        )}
        {view === "consumption" && (
          <ChartFrame filename="consumption">
            <Consumption data={data} />
          </ChartFrame>
        )}
        {view === "value" && (
          <ChartFrame filename="value-map">
            <ValueMap data={data} />
          </ChartFrame>
        )}
        {view === "vendor-value" && (
          <div className="space-y-10">
            <ChartFrame filename="value-ladder">
              <ValueByVendor data={data} />
            </ChartFrame>
            <ChartFrame filename="price-vs-demand">
              <PriceVsDemand data={data} />
            </ChartFrame>
          </div>
        )}

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
            <b className="text-[#141414]">DAILY TOKENS.</b> Each model&apos;s{" "}
            <b className="text-[#141414]">launch velocity</b> — the{" "}
            <b className="text-[#141414]">median</b> single-day token volume across
            the active days of its first{" "}
            <b className="text-[#141414]">14 working days</b> (Mon–Fri) on/after
            release. We use the median, not the mean, so a launch-day spike
            can&apos;t distort it — it reads as a typical day, and stays
            comparable across release dates (unlike all-time usage, which favors
            older models). Daily series from ZenMux&apos;s model-usage API.{" "}
            <b className="text-[#141414]">Value</b> = daily tokens ÷ basket cost;
            the Value Ladder and Value Map rank by it. Partial windows (models
            younger than 14 working days) are flagged.
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
