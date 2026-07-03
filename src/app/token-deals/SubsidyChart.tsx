"use client";

// SUBSIDY OVER TIME — the hand-built SVG chart (no chart lib, house rule).
// Every deal is one CUMULATIVE series (monotonic — the whole point is "the
// giving keeps accumulating"), switchable between SAVED $ / TOKENS / PAID $,
// over the ALL (daily buckets) or 72H (hourly buckets) window. Chart mechanics
// (hover crosshair, end-label anti-collision, live end pulse) follow the
// token-economics LIVE chart so the two experiments feel like one product.

import { useMemo, useState, type PointerEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import type {
  DealSeries,
  TokenDealsPayload,
} from "@research/token-deals/types";
import { VendorGlyph } from "../token-economics/components";
import { dealHref, logoPath, tokens, usdCompact } from "./lib";

export type ChartAxis = "saved" | "tokens" | "paid";

export const AXIS_OPTIONS = [
  { key: "saved", label: "SAVED $", title: "Cumulative subsidy (list − deal price gap)" },
  { key: "tokens", label: "TOKENS", title: "Cumulative in-deal token usage" },
  { key: "paid", label: "PAID $", title: "Cumulative developer spend (bill_amount)" },
] as const satisfies { key: ChartAxis; label: string; title: string }[];

const DEAL_COLORS = [
  "#1a8a4a",
  "#4f6ef7",
  "#ec4899",
  "#f59e0b",
  "#9b5de5",
  "#06b6d4",
  "#ef4444",
  "#111111",
  "#0f766e",
  "#f97316",
  "#2563eb",
  "#7c3aed",
] as const;

const LINE_DASHES = ["", "7 4", "2 4", "10 4 2 4", "1 5"] as const;

export function dealColor(index: number): string {
  return DEAL_COLORS[index % DEAL_COLORS.length];
}

function dealDash(index: number): string {
  return LINE_DASHES[Math.floor(index / DEAL_COLORS.length) % LINE_DASHES.length];
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const CHART = {
  left: 74,
  right: 194,
  top: 16,
  bottom: 48,
  width: 1500,
  height: 560,
  plotW: 1500 - 74 - 194,
  plotH: 560 - 16 - 48,
};

function axisValue(p: { saved: number; tokens: number; paid: number }, axis: ChartAxis): number {
  return axis === "saved" ? p.saved : axis === "tokens" ? p.tokens : p.paid;
}

function formatValue(n: number, axis: ChartAxis): string {
  return axis === "tokens" ? tokens(n) : usdCompact(n);
}

function localZone(): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(
      new Date(),
    );
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

function tickLines(iso: string, bucketSeconds: number): { date: string; time: string | null } {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(d);
  if (bucketSeconds >= 86400) return { date, time: null };
  const time = new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return { date, time };
}

function formatHoverStamp(iso: string, bucketSeconds: number): string {
  const d = new Date(iso);
  if (bucketSeconds >= 86400) {
    return new Intl.DateTimeFormat("en-CA", { dateStyle: "short" }).format(d);
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function tickIndices(length: number, desired = 6): number[] {
  if (length <= 1) return [0];
  const out = new Set<number>();
  for (let i = 0; i < desired; i++) {
    out.add(Math.round((i * (length - 1)) / (desired - 1)));
  }
  return [...out].sort((a, b) => a - b);
}

interface PlottedDeal {
  deal: DealSeries;
  colorIndex: number;
  /** Cumulative value per global-grid index; null before the deal's window. */
  values: (number | null)[];
  final: number;
  lastIndex: number;
}

export function SubsidyChart({
  payload,
  axis,
  hidden,
  onToggle,
}: {
  payload: TokenDealsPayload;
  axis: ChartAxis;
  hidden: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);

  // Global time grid: every deal's points are bucket-aligned to the payload's
  // [from, to) window, so index = (t − from) / bucket places each deal's series
  // on one shared X axis regardless of when its window starts.
  const grid = useMemo(() => {
    const fromMs = Date.parse(payload.from);
    const toMs = Date.parse(payload.to);
    const stepMs = payload.bucketSeconds * 1000;
    const out: string[] = [];
    for (let t = fromMs; t < toMs; t += stepMs) out.push(new Date(t).toISOString());
    return out;
  }, [payload.from, payload.to, payload.bucketSeconds]);

  const chartDeals = useMemo(
    () => payload.deals.filter((d) => d.points && d.points.length > 0),
    [payload.deals],
  );

  const plotted: PlottedDeal[] = useMemo(() => {
    const fromMs = Date.parse(payload.from);
    const stepMs = payload.bucketSeconds * 1000;
    return chartDeals
      .filter((d) => !hidden.has(d.id))
      .map((deal) => {
        const values: (number | null)[] = new Array(grid.length).fill(null);
        let total = 0;
        let lastIndex = 0;
        for (const p of deal.points!) {
          const idx = Math.round((Date.parse(p.t) - fromMs) / stepMs);
          if (idx < 0 || idx >= grid.length) continue;
          total += axisValue(p, axis);
          values[idx] = total;
          lastIndex = idx;
        }
        return {
          deal,
          colorIndex: chartDeals.indexOf(deal),
          values,
          final: total,
          lastIndex,
        };
      });
  }, [chartDeals, hidden, grid.length, axis, payload.from, payload.bucketSeconds]);

  const maxY = Math.max(1e-9, ...plotted.map((s) => s.final)) * 1.08;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => r * maxY);
  const xTicks = tickIndices(grid.length);
  const xForIndex = (i: number) =>
    CHART.left + (grid.length <= 1 ? 0 : (i / (grid.length - 1)) * CHART.plotW);
  const yForValue = (v: number) => CHART.top + (1 - v / maxY) * CHART.plotH;

  // Right-edge labels with the same forward/backward anti-collision passes as
  // the LIVE chart — clamped labels must not pile up at the plot edges.
  const endLabels = useMemo(() => {
    const minY = CHART.top + 14;
    const maxLabelY = CHART.top + CHART.plotH - 14;
    const labelH = 22;
    const placed = plotted
      .map((s) => ({
        id: s.deal.id,
        deal: s.deal,
        colorIndex: s.colorIndex,
        value: s.final,
        y: yForValue(s.final),
        active: s.deal.status === "active",
        endX: xForIndex(s.lastIndex),
      }))
      .sort((a, b) => a.y - b.y)
      .map((row) => ({ ...row, labelY: clamp(row.y, minY, maxLabelY) }));
    for (let iter = 0; iter < 8; iter++) {
      let changed = false;
      if (placed.length > 0) {
        const c = clamp(placed[0].labelY, minY, maxLabelY);
        if (c !== placed[0].labelY) { placed[0].labelY = c; changed = true; }
        for (let i = 1; i < placed.length; i++) {
          const target = Math.max(placed[i].labelY, placed[i - 1].labelY + labelH);
          if (target !== placed[i].labelY) { placed[i].labelY = target; changed = true; }
        }
      }
      const last = placed.length - 1;
      if (last >= 0) {
        const c = clamp(placed[last].labelY, minY, maxLabelY);
        if (c !== placed[last].labelY) { placed[last].labelY = c; changed = true; }
        for (let i = last - 1; i >= 0; i--) {
          const target = Math.min(placed[i].labelY, placed[i + 1].labelY - labelH);
          if (target !== placed[i].labelY) { placed[i].labelY = target; changed = true; }
        }
      }
      if (!changed) break;
    }
    return placed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotted, maxY]);

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (grid.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * CHART.width;
    const ratio = clamp((svgX - CHART.left) / CHART.plotW, 0, 1);
    setHover(Math.round(ratio * (grid.length - 1)));
  };

  const hoverRows =
    hover == null
      ? []
      : plotted
          .map((s) => ({ plot: s, value: s.values[Math.min(hover, s.lastIndex)] }))
          .filter((r): r is { plot: PlottedDeal; value: number } => r.value != null)
          .sort((a, b) => b.value - a.value);
  const tooltipW = 320;
  const hoverX = hover == null ? 0 : xForIndex(hover);
  const tooltipX = hoverX > CHART.left + CHART.plotW * 0.62 ? hoverX - tooltipW - 14 : hoverX + 14;
  const tooltipH = 44 + hoverRows.length * 16;

  const summary = `Cumulative ${axis} across ${plotted.length} deals in the selected window.`;

  return (
    <div className="bg-[#fbf9f4]">
      <div className="mb-1 flex items-center justify-between gap-2 px-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#6f6a5f]">
        <span>
          Y Axis ·{" "}
          {axis === "saved" ? "Subsidy $" : axis === "tokens" ? "Tokens" : "Developer Paid $"}
        </span>
        <span>Cumulative · monotonic — the giving keeps accumulating</span>
      </div>
      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={summary}
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          className="w-full min-w-[1080px] cursor-crosshair bg-[#fbf9f4]"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
        >
          <style>
            {`
              @keyframes td-live-pulse {
                0% { opacity: 0.95; r: 5px; }
                70% { opacity: 0; r: 17px; }
                100% { opacity: 0; r: 17px; }
              }
              @media (prefers-reduced-motion: reduce) {
                .td-live-pulse { animation: none; opacity: 0.28; }
              }
            `}
          </style>
          <rect x={CHART.left} y={CHART.top} width={CHART.plotW} height={CHART.plotH} fill="#fbf9f4" />

          {yTicks.map((tick) => {
            const y = yForValue(tick);
            return (
              <g key={tick}>
                <line
                  x1={CHART.left}
                  x2={CHART.left + CHART.plotW}
                  y1={y}
                  y2={y}
                  stroke="#141414"
                  strokeOpacity={tick === 0 ? 0.52 : 0.1}
                />
                <text
                  x={CHART.left - 9}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-[#6f6a5f] text-[10px] font-bold tabular-nums"
                >
                  {formatValue(tick, axis)}
                </text>
              </g>
            );
          })}
          <line
            x1={CHART.left}
            x2={CHART.left}
            y1={CHART.top}
            y2={CHART.top + CHART.plotH}
            stroke="#141414"
            strokeOpacity="0.45"
          />
          <line
            x1={CHART.left}
            x2={CHART.left + CHART.plotW}
            y1={CHART.top + CHART.plotH}
            y2={CHART.top + CHART.plotH}
            stroke="#141414"
            strokeOpacity="0.45"
          />

          {xTicks.map((idx) => {
            const x = xForIndex(idx);
            const tick = grid[idx] ? tickLines(grid[idx], payload.bucketSeconds) : null;
            const dateY = tick?.time ? CHART.height - 30 : CHART.height - 16;
            return (
              <g key={idx}>
                <line
                  x1={x}
                  x2={x}
                  y1={CHART.top}
                  y2={CHART.top + CHART.plotH}
                  stroke="#141414"
                  strokeOpacity={0.08}
                />
                {tick && (
                  <text
                    x={x}
                    y={dateY}
                    textAnchor="middle"
                    className="fill-[#141414] text-[10px] font-bold tabular-nums"
                  >
                    {tick.date}
                  </text>
                )}
                {tick?.time && (
                  <text
                    x={x}
                    y={CHART.height - 16}
                    textAnchor="middle"
                    className="fill-[#6f6a5f] text-[10px] font-bold tabular-nums"
                  >
                    {tick.time}
                  </text>
                )}
              </g>
            );
          })}

          {plotted.map((s) => {
            const color = dealColor(s.colorIndex);
            let path = "";
            let started = false;
            s.values.forEach((v, i) => {
              if (v == null) return;
              path += `${started ? "L" : "M"} ${xForIndex(i).toFixed(2)} ${yForValue(v).toFixed(2)} `;
              started = true;
            });
            const endX = xForIndex(s.lastIndex);
            const endY = yForValue(s.final);
            return (
              <g key={s.deal.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={dealDash(s.colorIndex)}
                  vectorEffect="non-scaling-stroke"
                >
                  <title>
                    {s.deal.model}: {formatValue(s.final, axis)} cumulative
                  </title>
                </path>
                {/* Live pulse only on ACTIVE deals — an ended deal's line just
                    stops (归档没有 LIVE 语义). */}
                {s.deal.status === "active" && payload.live && (
                  <circle
                    className="td-live-pulse"
                    cx={endX}
                    cy={endY}
                    r="5"
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                  >
                    <animate attributeName="r" values="5;17;17" dur="1.35s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.95;0;0" dur="1.35s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={endX} cy={endY} r="4" fill={color} stroke="#141414" strokeWidth="1" />
              </g>
            );
          })}

          {endLabels.map((row) => {
            const color = dealColor(row.colorIndex);
            const logo = logoPath(row.deal.vendor);
            const x = CHART.left + CHART.plotW;
            return (
              <g key={`${row.id}-end-label`} opacity={row.active ? 1 : 0.55}>
                <line
                  x1={row.endX + 2}
                  x2={x + 12}
                  y1={row.y}
                  y2={row.labelY}
                  stroke={color}
                  strokeWidth="1"
                  strokeOpacity="0.55"
                />
                <rect
                  x={x + 12}
                  y={row.labelY - 11}
                  width="154"
                  height="22"
                  fill={color}
                  stroke="#141414"
                  strokeWidth="1"
                />
                <circle cx={x + 23} cy={row.labelY} r="10" fill="#fbf9f4" stroke="#141414" strokeWidth="1" />
                {logo && (
                  <image
                    href={logo}
                    x={x + 16}
                    y={row.labelY - 7}
                    width="14"
                    height="14"
                    preserveAspectRatio="xMidYMid meet"
                  />
                )}
                <text x={x + 38} y={row.labelY + 4} className="fill-white text-[10px] font-bold tabular-nums">
                  {formatValue(row.value, axis)}
                </text>
              </g>
            );
          })}

          {hover != null && grid[hover] && (
            <g pointerEvents="none">
              <line
                x1={hoverX}
                x2={hoverX}
                y1={CHART.top}
                y2={CHART.top + CHART.plotH}
                stroke="#141414"
                strokeWidth="1.25"
                strokeDasharray="4 3"
              />
              {hoverRows.map((row) => (
                <g key={`${row.plot.deal.id}-hover-pt`}>
                  <circle
                    cx={xForIndex(Math.min(hover, row.plot.lastIndex))}
                    cy={yForValue(row.value)}
                    r="8"
                    fill="#fbf9f4"
                    stroke="#141414"
                    strokeWidth="2"
                  />
                  <circle
                    cx={xForIndex(Math.min(hover, row.plot.lastIndex))}
                    cy={yForValue(row.value)}
                    r="4"
                    fill={dealColor(row.plot.colorIndex)}
                    stroke="#fbf9f4"
                    strokeWidth="1"
                  />
                </g>
              ))}
              <rect
                x={tooltipX}
                y={CHART.top + 10}
                width={tooltipW}
                height={tooltipH}
                fill="#fbf9f4"
                stroke="#141414"
                strokeWidth="1"
              />
              <text
                x={tooltipX + 10}
                y={CHART.top + 27}
                className="fill-[#141414] text-[10px] font-bold uppercase tracking-[0.08em]"
              >
                {formatHoverStamp(grid[hover], payload.bucketSeconds)}
              </text>
              <text
                x={tooltipX + 10}
                y={CHART.top + 41}
                className="fill-[#6f6a5f] text-[9px] font-bold uppercase tracking-[0.1em]"
              >
                {localZone()} · CUMULATIVE · {AXIS_OPTIONS.find((o) => o.key === axis)?.label}
              </text>
              {hoverRows.map((row, i) => (
                <g
                  key={row.plot.deal.id}
                  transform={`translate(${tooltipX + 10} ${CHART.top + 63 + i * 16})`}
                >
                  <rect
                    x="0"
                    y="-8"
                    width="8"
                    height="8"
                    fill={dealColor(row.plot.colorIndex)}
                    stroke="#141414"
                    strokeWidth="0.75"
                  />
                  <text x="14" y="0" className="fill-[#141414] text-[9px] font-bold">
                    {row.plot.deal.model.length > 19
                      ? `${row.plot.deal.model.slice(0, 18)}…`
                      : row.plot.deal.model}
                  </text>
                  <text
                    x={tooltipW - 20}
                    y="0"
                    textAnchor="end"
                    className="fill-[#141414] text-[9px] font-bold tabular-nums"
                  >
                    {formatValue(row.value, axis)}
                  </text>
                </g>
              ))}
            </g>
          )}
        </svg>
      </div>

      {/* Series toggles — the toggle flips visibility; the arrow square beside
          it is a SEPARATE anchor to the model page (rule 8: every model mention
          funnels out, but a link inside a button would be broken a11y). */}
      <div className="mt-1 flex gap-2 overflow-x-auto px-1 pb-1 pt-1">
        {chartDeals.map((deal, i) => {
          const off = hidden.has(deal.id);
          const href = dealHref(deal.slug, deal.delisted);
          const cumSaved = deal.points!.reduce((sum, p) => sum + p.saved, 0);
          return (
            <div
              key={deal.id}
              className={
                "flex min-w-[176px] items-stretch border transition-colors " +
                (off
                  ? "border-[#141414]/25 bg-[#f4f1ea] opacity-45"
                  : "border-[#141414]/55 bg-[#fbf9f4]")
              }
            >
              <button
                type="button"
                onClick={() => onToggle(deal.id)}
                className="grid min-h-[58px] min-w-0 flex-1 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 px-2 py-1.5 text-left hover:bg-[#ece8dd]"
                title={`${deal.model}: ${usdCompact(cumSaved)} saved in this window · click to toggle`}
              >
                <span className="relative row-span-2 size-8 border border-[#141414]/45 bg-white p-1">
                  <VendorGlyph vendor={deal.vendor} alt={deal.vendorName} className="size-full" />
                  <span
                    className="absolute -bottom-1 -right-1 size-2.5 border border-[#141414]"
                    style={{ backgroundColor: off ? "transparent" : dealColor(i) }}
                    aria-hidden
                  />
                </span>
                <span className="truncate text-[10px] font-bold leading-tight text-[#141414]">
                  {deal.model}
                </span>
                <span className="truncate text-[9px] font-bold uppercase tracking-[0.06em] text-[#6f6a5f]">
                  {deal.status === "ended" ? "ENDED · " : ""}
                  {usdCompact(cumSaved)} saved
                </span>
              </button>
              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${deal.model} on ZenMux`}
                  className="flex w-7 shrink-0 items-center justify-center border-l border-[#141414]/25 text-[#6f6a5f] transition-colors hover:bg-[#141414] hover:text-[#f4f1ea]"
                >
                  <ArrowUpRight className="size-3" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
