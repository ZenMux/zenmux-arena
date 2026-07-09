"use client";

// Surface 4 — VALUE LADDER: a horizontal "tier ladder" (显卡天梯图-style) that
// answers the scatter's question one ratio at a time. The "ratio" is the Value
// Map's Y÷X — avg daily tokens (launch velocity) per dollar of basket cost
// (`avgDailyPerDollar`) — i.e. how much daily demand each model returns per $.
//
// Each model is one horizontal BAR growing rightward on a LOG scale (the value
// spans 5+ orders of magnitude, so a linear axis would crush all but the top
// model to a sliver). Every bar is tipped with the model's logo + name + value
// — the ladder signature: a ragged right edge you read top-to-bottom.
//
// TWO layouts, toggled by a checkbox:
//   · default  — one flat ladder, every model ranked by value (best on top).
//   · grouped  — the same bars bucketed into per-vendor sections, vendors
//                ordered by their median value. Same scale, so bar lengths are
//                directly comparable across the two modes.

import { useMemo, useState } from "react";
import type { ModelEconomics, TokenEconomicsData } from "@research/token-economics/types";
import { date, perDay, perDollarDay, tokens, usd, vendorColor } from "./lib";
import { VendorGlyph } from "./components";

// Bars max out at this % of the track so the tip label always has room to its
// right; the remaining width holds the logo + model name + value.
const MAX_BAR = 64;

interface Group {
  vendor: string;
  name: string;
  sample: ModelEconomics; // a member, for the section-header glyph
  models: ModelEconomics[];
  median: number;
}

export function ValueByVendor({ data }: { data: TokenEconomicsData }) {
  const [hover, setHover] = useState<string | null>(null);
  const [grouped, setGrouped] = useState(false);

  // Every priced model that carries a value, ranked best-value-first — the flat
  // ladder, and the source list for the grouped view.
  const ranked = useMemo(
    () =>
      data.models
        .filter((m) => m.avgDailyPerDollar != null && m.avgDailyPerDollar > 0)
        .sort((a, b) => (b.avgDailyPerDollar ?? 0) - (a.avgDailyPerDollar ?? 0)),
    [data.models],
  );

  // Resolve the hovered model so the detail strip can show the FULL listing
  // name (m.name) — the bar tip only has room for shortName, which is often
  // ambiguous for long titles.
  const active = useMemo(
    () => (hover ? ranked.find((m) => m.slug === hover) ?? null : null),
    [hover, ranked],
  );

  // Vendor clusters (only consumed when grouped): each sorted best-value-first,
  // clusters themselves ordered by median value so the strongest makers lead.
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
        models, // already value-sorted (ranked was)
        median: med(models.map((m) => m.avgDailyPerDollar ?? 0)),
      });
    }
    return out.sort((a, b) => b.median - a.median);
  }, [ranked]);

  // Shared log scale across every model, snapped to decade boundaries — IDENTICAL
  // in both modes so a bar means the same length whichever layout is active.
  const loE = Math.floor(Math.log10(Math.min(...ranked.map((m) => m.avgDailyPerDollar!))));
  const hiE = Math.ceil(Math.log10(Math.max(...ranked.map((m) => m.avgDailyPerDollar!))));
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
            Value Ladder · Daily Tokens per Dollar
          </h2>
          <p className="mt-0.5 text-[11px] text-[#6f6a5f]">
            A value tier-list · one bar per model, longer = more median daily
            tokens ÷ basket cost (the Value Map&apos;s ratio, log scale) ·{" "}
            {grouped ? (
              <>
                <b className="text-[#141414]">grouped by maker</b>, vendors ranked
                by median value.
              </>
            ) : (
              <>ranked best value first.</>
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
                  {tokens(d)}/$·day
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
                      · {g.models.length} {g.models.length === 1 ? "model" : "models"} · median {perDollarDay(g.median)}
                    </span>
                  </div>
                  <div>
                    {g.models.map((m) => (
                      <Row key={m.slug} m={m} pct={barPct(m.avgDailyPerDollar ?? 1)} hover={hover} setHover={setHover} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // ── flat: one continuous ladder ranked by value ──
            <div className="relative">
              {ranked.map((m) => (
                <Row key={m.slug} m={m} pct={barPct(m.avgDailyPerDollar ?? 1)} hover={hover} setHover={setHover} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hover detail / default methodology line.
          shortName on the bar tip is often truncated-looking for long model
          titles; this strip is the place the full name is revealed on hover
          (same pattern as the Value Map callout). */}
      <div className="mt-2 flex min-h-[38px] flex-wrap items-center gap-x-2 gap-y-1 border border-[#141414] bg-[#fbf9f4] px-3 py-2 text-[11px]">
        {active ? (
          <>
            <VendorGlyph vendor={active.vendor} alt={active.vendorName} className="size-4 shrink-0" />
            <span className="font-bold text-[#141414]">{active.name}</span>
            <span className="text-[#6f6a5f]">·</span>
            <span className="tabular-nums text-[#1a8a4a]">
              {perDollarDay(active.avgDailyPerDollar)}
            </span>
            <span className="text-[#6f6a5f]">·</span>
            <span className="tabular-nums">basket {usd(active.blendedCost)}</span>
            <span className="text-[#6f6a5f]">·</span>
            <span className="tabular-nums">{perDay(active.avgDailyTokens)}</span>
            <span className="text-[#6f6a5f]">·</span>
            <span className="tabular-nums text-[#6f6a5f]">
              all-time {tokens(active.usageTokens)}
            </span>
            {active.publishTime && (
              <>
                <span className="text-[#6f6a5f]">·</span>
                <span className="tabular-nums text-[#6f6a5f]">
                  released {date(active.publishTime)}
                </span>
              </>
            )}
          </>
        ) : (
          <span className="text-[#6f6a5f]">
            Hover a row for the full model name · bar length = median daily
            tokens per dollar (log scale) ·{" "}
            {grouped
              ? "vendors ranked by median value, models ranked within each maker"
              : "every model ranked by value, colored by maker"}
          </span>
        )}
      </div>
    </section>
  );
}

/** A single ladder row: the value bar + a tip label (logo · name · value). Used
    identically by both the flat and grouped layouts. */
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
  const active = hover === m.slug;
  // On hover, expand shortName → full listing name so long titles are readable
  // right on the bar tip (the detail strip below also shows it as a backup).
  const label = active ? m.name : m.shortName;
  return (
    <div
      className="relative flex h-[22px] items-center transition-opacity duration-150 motion-reduce:transition-none"
      style={{ opacity: dim ? 0.35 : 1 }}
      onMouseEnter={() => setHover(m.slug)}
      onMouseLeave={() => setHover(null)}
      title={`${m.name}: ${perDollarDay(m.avgDailyPerDollar)} · basket ${usd(m.blendedCost)} · ${perDay(m.avgDailyTokens)}${m.publishTime ? ` · released ${m.publishTime}` : ""}`}
    >
      <div
        className="h-3 border border-[#141414]"
        style={{ width: `${Math.max(pct, 0.6)}%`, backgroundColor: vendorColor(m.vendor) }}
      />
      <div className="ml-1.5 flex items-center gap-1 whitespace-nowrap">
        <VendorGlyph vendor={m.vendor} alt={m.vendorName} className="size-3.5" />
        <span
          className={
            active
              ? "text-[11px] font-bold leading-none text-[#141414]"
              : "text-[11px] font-bold leading-none"
          }
        >
          {label}
        </span>
        {/* all-time token total in parens — the model's lifetime consumption,
            for quick "is this value play actually used?" context. */}
        <span className="text-[10px] tabular-nums leading-none text-[#6f6a5f]">
          ({tokens(m.usageTokens)})
        </span>
        <span className="text-[10px] font-bold tabular-nums leading-none text-[#1a8a4a]">
          {perDollarDay(m.avgDailyPerDollar)}
        </span>
        {/* listing publish date — separated by a thin dot so it reads as
            metadata, not another metric. Hidden on the narrowest widths so the
            value (the row's whole point) never gets pushed off-screen. */}
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
