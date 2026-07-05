"use client";

// The expanded rung — what a ladder row opens into. Hand-built SVG like every
// other chart in this repo (no chart lib): a cumulative-saved area curve with
// daily-saved bars riding the baseline, a pointer-tracked crosshair readout,
// a strip of window stats, and the outbound "open on ZenMux" funnel button
// (which used to be the whole row's click target).

import { useMemo, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { DealSeries } from "@research/token-deals/types";
import {
  bandTheme,
  dealHref,
  discountFactor,
  percentOff,
  shortDate,
  tokens,
  trimEndedTail,
  usdCompact,
  usdGrouped,
} from "../lib";

const W = 720;
const H = 200;
const PAD_X = 6;
const PAD_TOP = 14;
const PAD_BOTTOM = 26; // room for the daily bars + date axis
const BAR_ZONE = 44; // daily bars grow up from the baseline into this zone

interface TrendPoint {
  date: string; // YYYY-MM-DD
  day: number; // saved that day
  cum: number; // cumulative saved up to and incl. this day
  tokens: number;
}

function buildTrend(deal: DealSeries): TrendPoint[] {
  // Ended deals stop charting at their last active day — no flat tail out to
  // "now" for a model that's been offline for weeks (see trimEndedTail).
  const points = deal.points ? trimEndedTail(deal) : [];
  if (points.length === 0) return [];
  let total = 0;
  return points.map((p) => ({
    date: p.t.slice(0, 10),
    day: p.saved,
    cum: (total += p.saved),
    tokens: p.tokens,
  }));
}

export function DealTrendPanel({ deal }: { deal: DealSeries }) {
  const theme = bandTheme(deal.vendor);
  const href = dealHref(deal.slug, deal.delisted);
  const trend = useMemo(() => buildTrend(deal), [deal]);
  const isFree = deal.dealType === "free";

  return (
    <div className="border-l-2 pb-5 pl-3 pt-3 sm:pl-4" style={{ borderColor: theme.bg }}>
      {/* ── Window stats strip ── */}
      <div className="flex flex-wrap items-stretch gap-[3px]">
        <Stat label="Saved" value={deal.stats ? usdGrouped(deal.stats.saved) : "—"} accent={theme.bg} />
        <Stat label="Tokens" value={deal.stats ? tokens(deal.stats.tokens) : "—"} />
        <Stat label="Developers paid" value={deal.stats ? usdGrouped(deal.stats.paid) : "—"} />
        <Stat
          label="Deal"
          value={isFree ? "FREE" : percentOff(deal.discount)}
          sub={isFree ? "100% off while listed" : `you pay ${discountFactor(deal.discount)}`}
        />
        <Stat
          label="Window"
          value={`${shortDate(deal.startDate)} — ${deal.endDate ? shortDate(deal.endDate) : "now"}`}
          sub={deal.status === "ended" ? "ended" : "running"}
        />
      </div>

      {/* ── The curve ── */}
      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-[family-name:var(--font-deals-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">
            Cumulative saved <span className="text-white/35">· line</span>
            <span className="ml-3 text-white/35">daily saved · bars</span>
          </span>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 border border-white/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/80 transition-colors hover:bg-white hover:text-[#0a0a0b]"
            >
              Open {deal.model} on ZenMux
              <ArrowUpRight className="size-3" />
            </a>
          )}
        </div>
        {trend.length > 0 ? (
          <TrendChart trend={trend} color={theme.bg} dealId={deal.id} />
        ) : (
          <div className="flex h-24 items-center justify-center border border-dashed border-white/15 font-[family-name:var(--font-deals-mono)] text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
            No daily data — live billing aggregation unavailable
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="min-w-32 flex-1 bg-white/[0.06] px-3 py-2.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">{label}</div>
      <div
        className="mt-1 truncate font-[family-name:var(--font-deals-mono)] text-sm font-bold tabular-nums sm:text-base"
        style={{ color: accent ?? "#fff" }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 truncate font-[family-name:var(--font-deals-mono)] text-[9px] font-semibold uppercase tracking-[0.1em] text-white/40">
          {sub}
        </div>
      )}
    </div>
  );
}

/* ── The SVG chart itself ─────────────────────────────────────────────────── */

function TrendChart({
  trend,
  color,
  dealId,
}: {
  trend: TrendPoint[];
  color: string;
  dealId: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const geom = useMemo(() => {
    const n = trend.length;
    const maxCum = Math.max(1e-9, trend[n - 1].cum);
    const maxDay = Math.max(1e-9, ...trend.map((p) => p.day));
    const innerW = W - PAD_X * 2;
    const baseline = H - PAD_BOTTOM;
    const xFor = (i: number) => PAD_X + (n <= 1 ? innerW : (i / (n - 1)) * innerW);
    const yFor = (v: number) => baseline - (v / maxCum) * (baseline - PAD_TOP);
    const line = trend
      .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)} ${yFor(p.cum).toFixed(1)}`)
      .join(" ");
    const area = `${line} L${xFor(n - 1).toFixed(1)} ${baseline} L${xFor(0).toFixed(1)} ${baseline} Z`;
    const barW = Math.max(1.5, Math.min(8, (innerW / n) * 0.6));
    const bars = trend.map((p, i) => ({
      x: xFor(i) - barW / 2,
      h: (p.day / maxDay) * BAR_ZONE,
    }));
    return { xFor, yFor, line, area, bars, barW, baseline };
  }, [trend]);

  // Pointer → nearest data index, computed from the rendered width so the
  // crosshair stays accurate however the responsive SVG scales.
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const fx = PAD_X + ((e.clientX - rect.left) / rect.width) * W - PAD_X;
    const frac = Math.min(1, Math.max(0, (fx - PAD_X) / (W - PAD_X * 2)));
    setHover(Math.round(frac * (trend.length - 1)));
  };

  const h = hover != null ? trend[hover] : null;
  const gradId = `deal-grad-${dealId.replace(/[^a-zA-Z0-9-]/g, "")}`;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-40 w-full touch-none sm:h-48"
        role="img"
        aria-label="Cumulative and daily savings trend"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* baseline */}
        <line
          x1={PAD_X}
          y1={geom.baseline}
          x2={W - PAD_X}
          y2={geom.baseline}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
        />

        {/* daily bars (volume) */}
        {geom.bars.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={geom.baseline - b.h}
            width={geom.barW}
            height={Math.max(b.h, trend[i].day > 0 ? 1 : 0)}
            fill={color}
            opacity={hover === i ? 0.9 : 0.35}
          />
        ))}

        {/* cumulative area + line */}
        <path d={geom.area} fill={`url(#${gradId})`} />
        <path
          d={geom.line}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* crosshair */}
        {h && hover != null && (
          <g>
            <line
              x1={geom.xFor(hover)}
              y1={PAD_TOP}
              x2={geom.xFor(hover)}
              y2={geom.baseline}
              stroke="rgba(255,255,255,0.45)"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={geom.xFor(hover)} cy={geom.yFor(h.cum)} r="3.5" fill={color} stroke="#0a0a0b" strokeWidth="1.5" />
          </g>
        )}

        {/* first/last date ticks */}
        <text
          x={PAD_X}
          y={H - 8}
          fill="rgba(255,255,255,0.4)"
          fontSize="10"
          className="font-[family-name:var(--font-deals-mono)]"
        >
          {shortDate(trend[0].date)}
        </text>
        <text
          x={W - PAD_X}
          y={H - 8}
          textAnchor="end"
          fill="rgba(255,255,255,0.4)"
          fontSize="10"
          className="font-[family-name:var(--font-deals-mono)]"
        >
          {shortDate(trend[trend.length - 1].date)}
        </text>
      </svg>

      {/* readout — top corner, flips side past the midpoint so it never hides
          the crosshair */}
      {h && hover != null && (
        <div
          className={
            "pointer-events-none absolute top-1 border border-white/25 bg-[#0a0a0b]/95 px-2.5 py-1.5 font-[family-name:var(--font-deals-mono)] text-[10px] font-semibold uppercase tracking-[0.08em] " +
            (hover > trend.length / 2 ? "left-1" : "right-1")
          }
        >
          <div className="text-white/60">{shortDate(h.date)}</div>
          <div className="mt-0.5 tabular-nums text-white">
            <span style={{ color }}>{usdCompact(h.cum)}</span> total ·{" "}
            {usdCompact(h.day)} that day · {tokens(h.tokens)} tok
          </div>
        </div>
      )}
    </div>
  );
}
