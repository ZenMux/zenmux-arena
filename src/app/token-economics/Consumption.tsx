"use client";

// Surface 2 — TOKEN CONSUMPTION. The signature nof1 visual: vertical colored
// bars, value label on top, a boxed model pill at the foot. Bars are sorted
// descending and colored by vendor so a maker reads as one hue across the page.
// Hand-built from divs (this project ships no chart lib on purpose).
//
// A metric toggle switches the bars (and the per-vendor share strip below)
// between ALL-TIME tokens and the recency-fair AVG-PER-DAY launch-velocity
// metric — the same number the Value Ladder + Value Map rank by.

import { useMemo, useState } from "react";
import type { ModelEconomics, TokenEconomicsData } from "@research/token-economics/types";
import { tokens, usd, perDay, vendorColor, logoPath } from "./lib";
import { ModelPill } from "./components";

const TOP_N = [12, 24, 48] as const;

/** Which consumption metric the bars/share strip plot. */
type Metric = "avgDaily" | "allTime";

/** Pull the active metric off a model (null-safe). */
function metricOf(m: ModelEconomics, metric: Metric): number | null {
  return metric === "avgDaily" ? m.avgDailyTokens : m.usageTokens;
}

export function Consumption({ data }: { data: TokenEconomicsData }) {
  const [topN, setTopN] = useState<number>(12);
  // Default to avg/day — the headline metric across the rest of the module.
  const [metric, setMetric] = useState<Metric>("avgDaily");

  const ranked = useMemo(
    () =>
      data.models
        .filter((m) => metricOf(m, metric) != null)
        .sort((a, b) => (metricOf(b, metric) ?? 0) - (metricOf(a, metric) ?? 0)),
    [data.models, metric],
  );
  const shown = ranked.slice(0, topN);
  const max = (shown[0] ? metricOf(shown[0], metric) : null) ?? 1;
  const fmt = metric === "avgDaily" ? perDay : tokens;

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
              {metric === "avgDaily"
                ? "Avg tokens / working day at launch (first 14 working days)"
                : "All-time observed tokens served on ZenMux"}{" "}
              · top {topN} of {ranked.length} · bar height = volume, color =
              manufacturer
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* metric toggle */}
            <div className="flex items-center gap-1">
              {(
                [
                  ["avgDaily", "AVG / DAY"],
                  ["allTime", "ALL-TIME"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setMetric(key)}
                  className={
                    "border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors " +
                    (metric === key
                      ? "border-[#141414] bg-[#141414] text-[#f4f1ea]"
                      : "border-[#141414] bg-[#fbf9f4] hover:bg-[#ece8dd]")
                  }
                >
                  {label}
                </button>
              ))}
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
        </div>

        <div className="overflow-x-auto border border-[#141414] bg-[#fbf9f4] p-4 pb-3">
          <div
            className="flex items-end gap-2"
            style={{ minWidth: `${shown.length * 56}px`, height: "320px" }}
          >
            {shown.map((m) => {
              const v = metricOf(m, metric) ?? 0;
              const h = Math.max(2, (v / max) * 100);
              const color = vendorColor(m.vendor);
              return (
                <div
                  key={m.slug}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                  title={`${m.name}: ${fmt(v)} · basket ${usd(m.blendedCost)}`}
                >
                  {/* value label */}
                  <div className="text-[10px] font-bold tabular-nums">
                    {fmt(v)}
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
      <VendorShare data={data} metric={metric} />
    </section>
  );
}

function VendorShare({ data, metric }: { data: TokenEconomicsData; metric: Metric }) {
  // Roll up by the active metric: avg-daily sum vs all-time sum (+ matching share).
  const valueOf = (v: TokenEconomicsData["vendors"][number]) =>
    metric === "avgDaily" ? v.totalAvgDaily : v.totalUsage;
  const shareOf = (v: TokenEconomicsData["vendors"][number]) =>
    metric === "avgDaily" ? v.avgDailyShare : v.usageShare;
  const fmt = metric === "avgDaily" ? perDay : tokens;

  const vendors = useMemo(
    () =>
      [...data.vendors].sort((a, b) =>
        metric === "avgDaily"
          ? b.totalAvgDaily - a.totalAvgDaily
          : b.totalUsage - a.totalUsage,
      ),
    [data.vendors, metric],
  );
  const max = (vendors[0] ? valueOf(vendors[0]) : 0) || 1;

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-bold uppercase tracking-[0.14em]">
          Consumption by Manufacturer
        </h3>
        <p className="mt-0.5 text-[11px] text-[#6f6a5f]">
          {metric === "avgDaily"
            ? "Avg daily launch tokens summed across each maker's lineup"
            : "Total all-time tokens summed across each maker's lineup"}{" "}
          — who commands the volume.
        </p>
      </div>

      <div className="space-y-1.5 border border-[#141414] bg-[#fbf9f4] p-4">
        {vendors.map((v) => {
          const w = (valueOf(v) / max) * 100;
          const src = logoPath(v.vendor);
          return (
            <div
              key={v.vendor}
              className="flex items-center gap-2 text-[11px]"
              title={`${v.name}: ${fmt(valueOf(v))} (${(shareOf(v) * 100).toFixed(1)}%) across ${v.modelCount} models`}
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
                {fmt(valueOf(v))}
              </div>
              <div className="w-12 shrink-0 text-right tabular-nums text-[#6f6a5f]">
                {(shareOf(v) * 100).toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
