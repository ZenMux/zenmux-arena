"use client";

// Surface 2 — TOKEN CONSUMPTION. The signature nof1 visual: vertical colored
// bars, value label on top, a boxed model pill at the foot. Bars are sorted
// descending and colored by vendor so a maker reads as one hue across the page.
// Hand-built from divs (this project ships no chart lib on purpose).
//
// Below the headline bar chart, a per-vendor consumption-share strip rolls the
// same data up to the manufacturer level (who commands the most total volume).

import { useMemo, useState } from "react";
import type { TokenEconomicsData } from "@research/token-economics/types";
import { tokens, usd, vendorColor, logoPath } from "./lib";
import { ModelPill } from "./components";

const TOP_N = [12, 24, 48] as const;

export function Consumption({ data }: { data: TokenEconomicsData }) {
  const [topN, setTopN] = useState<number>(12);

  const ranked = useMemo(
    () =>
      data.models
        .filter((m) => m.usageTokens != null)
        .sort((a, b) => (b.usageTokens ?? 0) - (a.usageTokens ?? 0)),
    [data.models],
  );
  const shown = ranked.slice(0, topN);
  const max = shown[0]?.usageTokens ?? 1;

  return (
    <section className="space-y-8">
      {/* ── Headline bar chart ── */}
      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em]">
              Token Consumption
            </h2>
            <p className="mt-0.5 text-[11px] text-[#6f6a5f]">
              Observed tokens served on ZenMux · top {topN} of {ranked.length} ·
              bar height = volume, color = manufacturer
            </p>
          </div>
          <div className="flex items-center gap-1">
            {TOP_N.map((n) => (
              <button
                key={n}
                onClick={() => setTopN(n)}
                className={
                  "border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors " +
                  (topN === n
                    ? "border-[#141414] bg-[#141414] text-[#f4f1ea]"
                    : "border-[#141414] bg-[#fbf9f4] hover:bg-[#ece8dd]")
                }
              >
                TOP {n}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto border border-[#141414] bg-[#fbf9f4] p-4 pb-3">
          <div
            className="flex items-end gap-2"
            style={{ minWidth: `${shown.length * 56}px`, height: "320px" }}
          >
            {shown.map((m) => {
              const h = Math.max(2, ((m.usageTokens ?? 0) / max) * 100);
              const color = vendorColor(m.vendor);
              return (
                <div
                  key={m.slug}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                  title={`${m.name}: ${tokens(m.usageTokens)} tokens · basket ${usd(m.blendedCost)}`}
                >
                  {/* value label */}
                  <div className="text-[10px] font-bold tabular-nums">
                    {tokens(m.usageTokens)}
                  </div>
                  {/* bar */}
                  <div
                    className="w-full border border-[#141414] transition-all duration-300 motion-reduce:transition-none"
                    style={{ height: `${h}%`, backgroundColor: color }}
                  />
                  {/* model pill */}
                  <ModelPill model={m} className="mt-1 w-full justify-center" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Per-vendor consumption share ── */}
      <VendorShare data={data} />
    </section>
  );
}

function VendorShare({ data }: { data: TokenEconomicsData }) {
  const vendors = useMemo(
    () => [...data.vendors].sort((a, b) => b.totalUsage - a.totalUsage),
    [data.vendors],
  );
  const max = vendors[0]?.totalUsage ?? 1;

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-bold uppercase tracking-[0.14em]">
          Consumption by Manufacturer
        </h3>
        <p className="mt-0.5 text-[11px] text-[#6f6a5f]">
          Total observed tokens summed across each maker&apos;s lineup — who
          commands the volume.
        </p>
      </div>

      <div className="space-y-1.5 border border-[#141414] bg-[#fbf9f4] p-4">
        {vendors.map((v) => {
          const w = (v.totalUsage / max) * 100;
          const src = logoPath(v.vendor);
          return (
            <div
              key={v.vendor}
              className="flex items-center gap-2 text-[11px]"
              title={`${v.name}: ${tokens(v.totalUsage)} tokens (${(v.usageShare * 100).toFixed(1)}%) across ${v.modelCount} models`}
            >
              <div className="flex w-28 shrink-0 items-center gap-1.5 sm:w-36">
                {src && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt=""
                    className="size-4 shrink-0 object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <span className="truncate font-bold">{v.name}</span>
              </div>
              <div className="h-4 flex-1 border border-[#141414] bg-[#f4f1ea]">
                <div
                  className="h-full transition-all duration-300 motion-reduce:transition-none"
                  style={{ width: `${w}%`, backgroundColor: vendorColor(v.vendor) }}
                />
              </div>
              <div className="w-16 shrink-0 text-right font-bold tabular-nums">
                {tokens(v.totalUsage)}
              </div>
              <div className="w-12 shrink-0 text-right tabular-nums text-[#6f6a5f]">
                {(v.usageShare * 100).toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
