"use client";

// Surface 3 — the VALUE MAP: a price-vs-usage scatter, the analytical payoff of
// the whole study. X = basket cost (log), Y = tokens consumed (log); both axes
// span 3+ orders of magnitude so log scales are mandatory. Each dot is a model,
// colored by manufacturer, sized a touch by tokens-per-dollar. Hand-built SVG
// (no chart lib), with a hover callout and an always-visible data fallback below.
//
// Reading the map: bottom-right = expensive AND heavily used (premium demand),
// top-left = cheap AND heavily used (value plays), bottom-left = cheap & ignored.

import { useMemo, useState } from "react";
import type { ModelEconomics, TokenEconomicsData } from "@research/token-economics/types";
import { usd, tokens, perDollar, vendorColor } from "./lib";
import { VendorGlyph } from "./components";

// SVG viewport + plot insets (room for axis ticks/labels).
const W = 920;
const H = 520;
const PAD = { l: 70, r: 28, t: 28, b: 56 };

interface Pt {
  m: ModelEconomics;
  x: number; // px
  y: number; // px
  r: number; // px radius
}

export function ValueMap({ data }: { data: TokenEconomicsData }) {
  const [hover, setHover] = useState<string | null>(null);

  const pts = useMemo<Pt[]>(() => {
    const models = data.models.filter(
      (m) => m.usageTokens != null && m.usageTokens > 0 && m.blendedCost > 0,
    );
    const xs = models.map((m) => Math.log10(m.blendedCost));
    const ys = models.map((m) => Math.log10(m.usageTokens!));
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const tpdMax = Math.max(...models.map((m) => m.tokensPerDollar ?? 0));

    const plotW = W - PAD.l - PAD.r;
    const plotH = H - PAD.t - PAD.b;
    return models.map((m) => {
      const lx = (Math.log10(m.blendedCost) - xMin) / (xMax - xMin || 1);
      const ly = (Math.log10(m.usageTokens!) - yMin) / (yMax - yMin || 1);
      const tpd = (m.tokensPerDollar ?? 0) / (tpdMax || 1);
      return {
        m,
        x: PAD.l + lx * plotW,
        y: PAD.t + (1 - ly) * plotH, // invert: higher usage = higher on screen
        r: 5 + Math.sqrt(tpd) * 9,
      };
    });
  }, [data.models]);

  // Axis ticks at decade boundaries spanning the data.
  const xTicks = useMemo(() => decadeTicks(pts.map((p) => p.m.blendedCost)), [pts]);
  const yTicks = useMemo(() => decadeTicks(pts.map((p) => p.m.usageTokens!)), [pts]);
  const xRange = extent(pts.map((p) => Math.log10(p.m.blendedCost)));
  const yRange = extent(pts.map((p) => Math.log10(p.m.usageTokens!)));
  const xAt = (v: number) =>
    PAD.l + ((Math.log10(v) - xRange[0]) / (xRange[1] - xRange[0] || 1)) * (W - PAD.l - PAD.r);
  const yAt = (v: number) =>
    PAD.t + (1 - (Math.log10(v) - yRange[0]) / (yRange[1] - yRange[0] || 1)) * (H - PAD.t - PAD.b);

  const active = pts.find((p) => p.m.slug === hover) ?? null;

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em]">
          The Value Map · Price vs. Consumption
        </h2>
        <p className="mt-0.5 text-[11px] text-[#6f6a5f]">
          Each dot is a model · X = basket cost (log) · Y = tokens served (log) ·
          dot size = tokens-per-dollar · color = manufacturer. The eye-opener:
          where the money meets the demand.
        </p>
      </div>

      <div className="relative overflow-x-auto border border-[#141414] bg-[#fbf9f4] p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[680px]"
          role="img"
          aria-label="Scatter plot of model basket price versus token consumption"
        >
          {/* plot frame */}
          <rect
            x={PAD.l}
            y={PAD.t}
            width={W - PAD.l - PAD.r}
            height={H - PAD.t - PAD.b}
            fill="none"
            stroke="#141414"
          />
          {/* gridlines + ticks */}
          {xTicks.map((t) => (
            <g key={`x${t}`}>
              <line x1={xAt(t)} y1={PAD.t} x2={xAt(t)} y2={H - PAD.b} stroke="#141414" strokeOpacity={0.1} />
              <text x={xAt(t)} y={H - PAD.b + 18} textAnchor="middle" className="fill-[#6f6a5f]" style={{ fontSize: 11, fontWeight: 700 }}>
                {usd(t)}
              </text>
            </g>
          ))}
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line x1={PAD.l} y1={yAt(t)} x2={W - PAD.r} y2={yAt(t)} stroke="#141414" strokeOpacity={0.1} />
              <text x={PAD.l - 8} y={yAt(t) + 4} textAnchor="end" className="fill-[#6f6a5f]" style={{ fontSize: 11, fontWeight: 700 }}>
                {tokens(t)}
              </text>
            </g>
          ))}
          {/* axis titles */}
          <text x={(W + PAD.l) / 2} y={H - 8} textAnchor="middle" className="fill-[#141414]" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>
            BASKET COST →
          </text>
          <text x={16} y={(H - PAD.b + PAD.t) / 2} textAnchor="middle" transform={`rotate(-90 16 ${(H - PAD.b + PAD.t) / 2})`} className="fill-[#141414]" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>
            TOKENS SERVED →
          </text>

          {/* dots — non-hovered dimmed when something is hovered */}
          {pts.map((p) => {
            const dim = hover != null && hover !== p.m.slug;
            return (
              <circle
                key={p.m.slug}
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={vendorColor(p.m.vendor)}
                fillOpacity={dim ? 0.18 : 0.78}
                stroke="#141414"
                strokeOpacity={dim ? 0.2 : 0.9}
                strokeWidth={1}
                className="cursor-pointer transition-opacity duration-150 motion-reduce:transition-none"
                onMouseEnter={() => setHover(p.m.slug)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${p.m.name}\n${usd(p.m.blendedCost)} · ${tokens(p.m.usageTokens)} tokens · ${perDollar(p.m.tokensPerDollar)}`}</title>
              </circle>
            );
          })}

          {/* hover callout label for the active dot */}
          {active && (
            <g pointerEvents="none">
              <text
                x={Math.min(active.x + 10, W - PAD.r - 4)}
                y={Math.max(active.y - 10, PAD.t + 12)}
                textAnchor={active.x > W - 160 ? "end" : "start"}
                className="fill-[#141414]"
                style={{ fontSize: 12, fontWeight: 700 }}
              >
                {active.m.shortName}
              </text>
            </g>
          )}
        </svg>

        {/* corner annotations — what the quadrants mean */}
        <div className="pointer-events-none absolute left-[78px] top-[34px] text-[9px] font-bold uppercase tracking-[0.1em] text-[#6f6a5f]">
          ◤ cheap · heavily used
        </div>
        <div className="pointer-events-none absolute right-[34px] top-[34px] text-right text-[9px] font-bold uppercase tracking-[0.1em] text-[#6f6a5f]">
          premium · heavily used ◥
        </div>
      </div>

      {/* Hover detail / default summary line */}
      <div className="mt-2 flex items-center gap-2 border border-[#141414] bg-[#fbf9f4] px-3 py-2 text-[11px]">
        {active ? (
          <>
            <VendorGlyph vendor={active.m.vendor} alt={active.m.vendorName} className="size-4" />
            <span className="font-bold">{active.m.name}</span>
            <span className="text-[#6f6a5f]">·</span>
            <span className="tabular-nums">basket {usd(active.m.blendedCost)}</span>
            <span className="text-[#6f6a5f]">·</span>
            <span className="tabular-nums">{tokens(active.m.usageTokens)} tokens</span>
            <span className="text-[#6f6a5f]">·</span>
            <span className="tabular-nums text-[#1a8a4a]">{perDollar(active.m.tokensPerDollar)}</span>
          </>
        ) : (
          <span className="text-[#6f6a5f]">
            Hover a dot for detail · {pts.length} models plotted · larger dot =
            more tokens per dollar
          </span>
        )}
      </div>

      <VendorLegend data={data} />
    </section>
  );
}

/** A compact legend mapping each vendor to its dot color (sorted by usage). */
function VendorLegend({ data }: { data: TokenEconomicsData }) {
  const vendors = [...data.vendors].sort((a, b) => b.totalUsage - a.totalUsage);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] font-bold">
      {vendors.map((v) => (
        <span key={v.vendor} className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 border border-[#141414]"
            style={{ backgroundColor: vendorColor(v.vendor) }}
            aria-hidden
          />
          <span className="uppercase tracking-[0.06em]">{v.name}</span>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny scale helpers (no d3 — this project hand-rolls its viz)
// ---------------------------------------------------------------------------

function extent(logs: number[]): [number, number] {
  return [Math.min(...logs), Math.max(...logs)];
}

/** Ticks at each power-of-10 boundary spanning the data's range (inclusive). */
function decadeTicks(values: number[]): number[] {
  if (values.length === 0) return [];
  const lo = Math.floor(Math.log10(Math.min(...values)));
  const hi = Math.ceil(Math.log10(Math.max(...values)));
  const out: number[] = [];
  for (let e = lo; e <= hi; e++) out.push(10 ** e);
  return out;
}
