"use client";

// Surface 4b — PRICE × DEMAND LADDER. The sibling of the Value Ladder, but with
// different axes:
//   · ROW ORDER (the "vertical axis")  = basket price — priciest model on top,
//     cheapest at the bottom, so you read the lineup top-down by what it costs.
//   · BAR LENGTH (the "horizontal axis") = MED/DAY tokens (launch velocity), log
//     scale — how much each model is actually consumed per active day.
//
// Reading it: a long bar high up = an expensive model that's still heavily used
// (premium demand); a long bar near the bottom = a cheap model in heavy demand
// (a value play); a short bar = little daily consumption regardless of price.
//
// Same two layouts as the Value Ladder, toggled by a checkbox:
//   · flat     — every model in one ladder, ordered by price.
//   · grouped  — bucketed per manufacturer, vendors ordered by median price.

import { useMemo, useState } from "react";
import type { ModelEconomics, TokenEconomicsData } from "@research/token-economics/types";
import { perDay, perDollarDay, tokens, usd, vendorColor, date } from "./lib";
import { VendorGlyph } from "./components";

// Bars cap at this % of the track so the tip label (logo · name · value) always
// has room to its right — identical budget to the Value Ladder for visual rhyme.
const MAX_BAR = 64;

interface Group {
  vendor: string;
  name: string;
  sample: ModelEconomics;
  models: ModelEconomics[];
  medianPrice: number;
}

export function PriceVsDemand({ data }: { data: TokenEconomicsData }) {
  const [hover, setHover] = useState<string | null>(null);
  const [grouped, setGrouped] = useState(false);

  // Every model with both a price (to rank by) and a daily volume (to draw a
  // bar), ordered priciest-first — the flat ladder + source for the grouped view.
  const ranked = useMemo(
    () =>
      data.models
        .filter(
          (m) =>
            m.blendedCost > 0 && m.avgDailyTokens != null && m.avgDailyTokens > 0,
        )
        .sort((a, b) => b.blendedCost - a.blendedCost),
    [data.models],
  );

  // Vendor clusters: each kept price-sorted (priciest first), clusters themselves
  // ordered by median price so the most expensive makers lead.
  const groups = useMemo<Group[]>(() => {
    const byVendor = new Map<string, ModelEconomics[]>();
    for (const m of ranked) {
      const arr = byVendor.get(m.vendor) ?? [];
      arr.push(m);
      byVendor.set(m.vendor, arr);
    }
    const out: Group[] = [];
    for (const [vendor, models] of byVendor) {
      out.push({
        vendor,
        name: models[0].vendorName,
        sample: models[0],
        models, // already price-sorted (ranked was)
        medianPrice: med(models.map((m) => m.blendedCost)),
      });
    }
    return out.sort((a, b) => b.medianPrice - a.medianPrice);
  }, [ranked]);

  // Shared log scale for bar length (MED/DAY tokens), snapped to decades — same
  // in both layouts so a bar means the same length whichever mode is active.
  const loE = Math.floor(Math.log10(Math.min(...ranked.map((m) => m.avgDailyTokens!))));
  const hiE = Math.ceil(Math.log10(Math.max(...ranked.map((m) => m.avgDailyTokens!))));
  const barPct = (v: number) => ((Math.log10(v) - loE) / (hiE - loE || 1)) * MAX_BAR;
  const decades = useMemo(() => {
    const out: number[] = [];
    for (let e = loE; e <= hiE; e++) out.push(10 ** e);
    return out;
  }, [loE, hiE]);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.14em]">
            Price × Demand Ladder · Daily Tokens by Price
          </h2>
          <p className="mt-0.5 text-[11px] text-[#6f6a5f]">
            Rows ranked by <b className="text-[#141414]">basket price</b>{" "}
            (priciest first) · bar length = <b className="text-[#141414]">median
            tokens/day</b> at launch (log scale) ·{" "}
            {grouped ? (
              <>
                <b className="text-[#141414]">grouped by maker</b>, vendors ranked
                by median price.
              </>
            ) : (
              <>one continuous ladder.</>
            )}{" "}
            {ranked.length} models across {groups.length} vendors.
          </p>
        </div>

        {/* group-by-maker toggle */}
        <label className="flex cursor-pointer select-none items-center gap-2 border border-[#141414] bg-[#fbf9f4] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] hover:bg-[#ece8dd]">
          <input
            type="checkbox"
            checked={grouped}
            onChange={(e) => setGrouped(e.target.checked)}
            className="size-3.5 cursor-pointer accent-[#141414]"
          />
          Group by manufacturer
        </label>
      </div>

      <div className="overflow-x-auto border border-[#141414] bg-[#fbf9f4]">
        <div className="relative min-w-[640px] p-4">
          {/* decade gridlines behind everything (inset-4 aligns left:0 with the
              bar track origin, so a gridline at xPct% lines up with bar tips). */}
          <div className="pointer-events-none absolute inset-4">
            {decades.map((d) => (
              <div
                key={d}
                className="absolute top-0 bottom-0 border-l border-[#141414]/12"
                style={{ left: `${barPct(d)}%` }}
              >
                <span className="absolute -top-0.5 left-1 text-[9px] font-bold tabular-nums text-[#6f6a5f]">
                  {tokens(d)}/day
                </span>
              </div>
            ))}
          </div>

          {/* top ruler spacer so the decade labels above have headroom */}
          <div className="relative mb-2 h-3" />

          {grouped ? (
            // ── grouped: per-vendor mini-ladders ──
            <div className="relative space-y-3">
              {groups.map((g) => (
                <div key={g.vendor}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <VendorGlyph vendor={g.sample.vendor} alt={g.name} className="size-4" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em]">
                      {g.name}
                    </span>
                    <span className="text-[10px] tabular-nums text-[#6f6a5f]">
                      · {g.models.length} {g.models.length === 1 ? "model" : "models"} · median {usd(g.medianPrice)}
                    </span>
                  </div>
                  <div>
                    {g.models.map((m) => (
                      <Row key={m.slug} m={m} pct={barPct(m.avgDailyTokens ?? 1)} hover={hover} setHover={setHover} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // ── flat: one continuous ladder ranked by price ──
            <div className="relative">
              {ranked.map((m) => (
                <Row key={m.slug} m={m} pct={barPct(m.avgDailyTokens ?? 1)} hover={hover} setHover={setHover} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* legend / methodology line */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border border-[#141414] bg-[#fbf9f4] px-3 py-2 text-[11px] text-[#6f6a5f]">
        <span>
          Bar length = median daily tokens served (log scale) · rows ranked by
          basket price, priciest first ·{" "}
          {grouped
            ? "vendors ranked by median price, models ranked within each maker"
            : "colored by maker"}{" "}
          · hover a row to isolate it.
        </span>
      </div>
    </section>
  );
}

/** A single ladder row: the demand bar + a tip label (logo · name · price ·
    daily volume · date). Used by both the flat and grouped layouts. */
function Row({
  m,
  pct,
  hover,
  setHover,
}: {
  m: ModelEconomics;
  pct: number;
  hover: string | null;
  setHover: (s: string | null) => void;
}) {
  const dim = hover != null && hover !== m.slug;
  return (
    <div
      className="relative flex h-[22px] items-center transition-opacity duration-150 motion-reduce:transition-none"
      style={{ opacity: dim ? 0.35 : 1 }}
      onMouseEnter={() => setHover(m.slug)}
      onMouseLeave={() => setHover(null)}
      title={`${m.name}: ${perDay(m.avgDailyTokens)} · basket ${usd(m.blendedCost)} · ${perDollarDay(m.avgDailyPerDollar)}${m.publishTime ? ` · released ${m.publishTime}` : ""}`}
    >
      <div
        className="h-3 border border-[#141414]"
        style={{ width: `${Math.max(pct, 0.6)}%`, backgroundColor: vendorColor(m.vendor) }}
      />
      <div className="ml-1.5 flex items-center gap-1 whitespace-nowrap">
        <VendorGlyph vendor={m.vendor} alt={m.vendorName} className="size-3.5" />
        <span className="text-[11px] font-bold leading-none">{m.shortName}</span>
        {/* basket price — the row's ranking key, shown so the price→demand
            relationship is legible without hovering. */}
        <span className="text-[10px] font-bold tabular-nums leading-none text-[#141414]">
          {usd(m.blendedCost)}
        </span>
        {/* median daily volume — the bar's value. */}
        <span className="text-[10px] tabular-nums leading-none text-[#6f6a5f]">
          {perDay(m.avgDailyTokens)}
        </span>
        {/* listing publish date — metadata, hidden on the narrowest widths. */}
        {m.publishTime && (
          <span className="hidden items-center gap-1 text-[10px] tabular-nums leading-none text-[#6f6a5f] sm:inline-flex">
            <span aria-hidden className="text-[#141414]/30">·</span>
            {date(m.publishTime)}
          </span>
        )}
      </div>
    </div>
  );
}

/** Median of a numeric array (drives vendor cluster ordering + the header). */
function med(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
