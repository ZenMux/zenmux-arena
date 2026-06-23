"use client";

// Surface 3 — the VALUE MAP: a price-vs-demand scatter, the analytical payoff of
// the whole study. X = basket cost (log), Y = AVG DAILY tokens at launch (log);
// both axes span 3+ orders of magnitude so log scales are mandatory. Each dot is
// a model, colored by manufacturer, sized a touch by avg-daily-tokens-per-dollar.
// Hand-built SVG (no chart lib), with a hover callout and an always-visible data
// fallback below.
//
// Y is the launch-velocity metric (avg tokens/working-day over the first 14
// working days), NOT all-time usage — so a new model and an old one sit on the
// same demand axis. Reading the map: bottom-right = expensive AND in demand
// (premium), top-left = cheap AND in demand (value plays), bottom-left = ignored.

import { useMemo, useState, type CSSProperties } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { ModelEconomics, TokenEconomicsData } from "@research/token-economics/types";
import type { VendorId } from "@research/lib/types";
import { usd, tokens, perDay, perDollarDay, vendorColor, logoPath, PANEL_SCROLLBAR } from "./lib";
import { VendorGlyph } from "./components";
import { useElementHeight } from "./useElementHeight";

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

interface SpotlightLabel extends Pt {
  labelX: number;
  labelY: number;
  labelAnchor: "start" | "end";
}

export function ValueMap({ data }: { data: TokenEconomicsData }) {
  const [hover, setHover] = useState<string | null>(null);
  const [hoverVendor, setHoverVendor] = useState<VendorId | null>(null);
  const [hiddenVendors, setHiddenVendors] = useState<Set<VendorId>>(() => new Set());
  const [focusedVendors, setFocusedVendors] = useState<Set<VendorId>>(() => new Set());
  const [chartRef, chartHeight] = useElementHeight<HTMLDivElement>();

  const plottableModels = useMemo(
    () =>
      data.models.filter(
        (m) => m.avgDailyTokens != null && m.avgDailyTokens > 0 && m.blendedCost > 0,
      ),
    [data.models],
  );

  const vendors = useMemo(() => {
    const modelCounts = new Map<VendorId, number>();
    for (const m of plottableModels) {
      modelCounts.set(m.vendor, (modelCounts.get(m.vendor) ?? 0) + 1);
    }
    return [...data.vendors]
      .filter((v) => modelCounts.has(v.vendor))
      .sort((a, b) => b.totalAvgDaily - a.totalAvgDaily || a.name.localeCompare(b.name))
      .map((v) => ({ ...v, modelCount: modelCounts.get(v.vendor) ?? v.modelCount }));
  }, [data.vendors, plottableModels]);

  const visibleModels = useMemo(
    () => plottableModels.filter((m) => !hiddenVendors.has(m.vendor)),
    [plottableModels, hiddenVendors],
  );

  const pts = useMemo<Pt[]>(() => {
    const models = visibleModels;
    if (models.length === 0) return [];
    const xs = models.map((m) => Math.log10(m.blendedCost));
    const ys = models.map((m) => Math.log10(m.avgDailyTokens!));
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const tpdMax = Math.max(...models.map((m) => m.avgDailyPerDollar ?? 0));

    const plotW = W - PAD.l - PAD.r;
    const plotH = H - PAD.t - PAD.b;
    return models.map((m) => {
      const lx = (Math.log10(m.blendedCost) - xMin) / (xMax - xMin || 1);
      const ly = (Math.log10(m.avgDailyTokens!) - yMin) / (yMax - yMin || 1);
      const tpd = (m.avgDailyPerDollar ?? 0) / (tpdMax || 1);
      return {
        m,
        x: PAD.l + lx * plotW,
        y: PAD.t + (1 - ly) * plotH, // invert: higher demand = higher on screen
        r: 5 + Math.sqrt(tpd) * 9,
      };
    });
  }, [visibleModels]);

  // Axis ticks at decade boundaries spanning the data.
  const xTicks = useMemo(() => decadeTicks(pts.map((p) => p.m.blendedCost)), [pts]);
  const yTicks = useMemo(() => decadeTicks(pts.map((p) => p.m.avgDailyTokens!)), [pts]);
  const xRange = pts.length ? extent(pts.map((p) => Math.log10(p.m.blendedCost))) : [0, 1];
  const yRange = pts.length ? extent(pts.map((p) => Math.log10(p.m.avgDailyTokens!))) : [0, 1];
  const xAt = (v: number) =>
    PAD.l + ((Math.log10(v) - xRange[0]) / (xRange[1] - xRange[0] || 1)) * (W - PAD.l - PAD.r);
  const yAt = (v: number) =>
    PAD.t + (1 - (Math.log10(v) - yRange[0]) / (yRange[1] - yRange[0] || 1)) * (H - PAD.t - PAD.b);

  // Median crosshairs split the cloud into four readable quadrants: the vertical
  // line marks the median basket price (cheap ↔ premium), the horizontal one the
  // median usage (ignored ↔ heavily used). They turn a fuzzy cloud into "which of
  // four zones is this model in?" — the single biggest legibility win here.
  const medX = median(pts.map((p) => p.m.blendedCost));
  const medY = median(pts.map((p) => p.m.avgDailyTokens!));

  const active = pts.find((p) => p.m.slug === hover) ?? null;
  const visibleFocusedVendors = new Set<VendorId>(
    [...focusedVendors].filter((id) => !hiddenVendors.has(id)),
  );
  if (hoverVendor && !hiddenVendors.has(hoverVendor)) visibleFocusedVendors.add(hoverVendor);
  if (active) visibleFocusedVendors.add(active.m.vendor);
  const spotlightOn = visibleFocusedVendors.size > 0;
  const spotlightLabels = spotlightOn
    ? placeSpotlightLabels(
        pts.filter(
          (p) => visibleFocusedVendors.has(p.m.vendor) && p.m.slug !== active?.m.slug,
        ),
      )
    : [];

  const toggleVendor = (id: VendorId) => {
    const willHide = !hiddenVendors.has(id);
    setHiddenVendors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (willHide) {
      setFocusedVendors((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setHover((slug) => {
        const hovered = pts.find((p) => p.m.slug === slug);
        return hovered?.m.vendor === id ? null : slug;
      });
      setHoverVendor((vendor) => (vendor === id ? null : vendor));
    }
  };

  const toggleFocus = (id: VendorId) => {
    if (hiddenVendors.has(id)) return;
    setFocusedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showAllVendors = () => setHiddenVendors(new Set());
  const hideAllVendors = () => {
    setHiddenVendors(new Set(vendors.map((v) => v.vendor)));
    setFocusedVendors(new Set());
    setHover(null);
    setHoverVendor(null);
  };

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em]">
          The Value Map · Price vs. Daily Demand
        </h2>
        <p className="mt-0.5 text-[11px] text-[#6f6a5f]">
          Each dot is a model · X = basket cost (log) · Y = median tokens/day at
          launch (log) · dot size = daily-tokens-per-dollar · color =
          manufacturer. The dashed{" "}
          <b className="text-[#141414]">median crosshairs</b> split the cloud into
          four zones — read where the money meets the demand.
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_270px] xl:items-stretch">
        <div ref={chartRef} className="relative self-start overflow-x-auto border border-[#141414] bg-[#fbf9f4] p-2">
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
            {/* median crosshairs — the quadrant dividers (dashed, accent ink) */}
            {pts.length > 0 && (
              <>
                <line x1={xAt(medX)} y1={PAD.t} x2={xAt(medX)} y2={H - PAD.b} stroke="#141414" strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.45} />
                <line x1={PAD.l} y1={yAt(medY)} x2={W - PAD.r} y2={yAt(medY)} stroke="#141414" strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.45} />
                <text x={xAt(medX)} y={PAD.t - 4} textAnchor="middle" className="fill-[#6f6a5f]" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em" }}>
                  MEDIAN {usd(medX)}
                </text>
              </>
            )}

            {/* axis titles */}
            <text x={(W + PAD.l) / 2} y={H - 8} textAnchor="middle" className="fill-[#141414]" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>
              BASKET COST →
            </text>
            <text x={16} y={(H - PAD.b + PAD.t) / 2} textAnchor="middle" transform={`rotate(-90 16 ${(H - PAD.b + PAD.t) / 2})`} className="fill-[#141414]" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>
              MEDIAN TOKENS / DAY →
            </text>

            {/* quadrant annotations — kept inside the SVG coordinate system so
                they scale with the chart and stay clear of ticks/axis lines. */}
            {pts.length > 0 && (
              <g pointerEvents="none" aria-hidden>
                <QuadrantBadge
                  x={PAD.l + 12}
                  y={PAD.t + 12}
                  width={158}
                  label="VALUE PLAYS · CHEAP + USED"
                  color="#1a8a4a"
                />
                <QuadrantBadge
                  x={W - PAD.r - 210}
                  y={PAD.t + 12}
                  width={198}
                  label="PREMIUM DEMAND · DEAR + USED"
                  color="#6f6a5f"
                  align="end"
                />
                <QuadrantBadge
                  x={PAD.l + 12}
                  y={H - PAD.b - 30}
                  width={120}
                  label="CHEAP + IGNORED"
                  color="#6f6a5f"
                />
                <QuadrantBadge
                  x={W - PAD.r - 132}
                  y={H - PAD.b - 30}
                  width={120}
                  label="DEAR + IGNORED"
                  color="#cf3636"
                  align="end"
                />
              </g>
            )}

            {/* dots — vendor eyes pin a spotlight; hover temporarily widens it. */}
            {pts.map((p) => {
              const dim = spotlightOn && !visibleFocusedVendors.has(p.m.vendor);
              const focused = visibleFocusedVendors.has(p.m.vendor);
              return (
                <circle
                  key={p.m.slug}
                  cx={p.x}
                  cy={p.y}
                  r={p.r}
                  fill={vendorColor(p.m.vendor)}
                  fillOpacity={dim ? 0.12 : focused ? 0.9 : 0.78}
                  stroke="#141414"
                  strokeOpacity={dim ? 0.16 : 0.9}
                  strokeWidth={focused ? 1.4 : 1}
                  className="cursor-pointer transition-opacity duration-150 motion-reduce:transition-none"
                  onMouseEnter={() => {
                    setHover(p.m.slug);
                    setHoverVendor(p.m.vendor);
                  }}
                  onMouseLeave={() => {
                    setHover(null);
                    setHoverVendor(null);
                  }}
                >
                  <title>{`${p.m.name}\n${usd(p.m.blendedCost)} · ${perDay(p.m.avgDailyTokens)} · ${perDollarDay(p.m.avgDailyPerDollar)}`}</title>
                </circle>
              );
            })}

            {/* maker spotlight labels — when a maker is hovered or pinned with
                the eye, every visible model from that maker gets a readable name. */}
            {spotlightLabels.map((p) => (
              <g key={`${p.m.slug}-spotlight-label`} pointerEvents="none">
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={p.labelX + (p.labelAnchor === "start" ? -4 : 4)}
                  y2={p.labelY - 3}
                  stroke={vendorColor(p.m.vendor)}
                  strokeWidth={1}
                  strokeOpacity={0.44}
                />
                <text
                  x={p.labelX}
                  y={p.labelY}
                  textAnchor={p.labelAnchor}
                  className="fill-[#141414]"
                  style={{ fontSize: 10.5, fontWeight: 800, paintOrder: "stroke" }}
                  stroke="#fbf9f4"
                  strokeWidth={3.5}
                >
                  {modelLabel(p.m.shortName)}
                </text>
              </g>
            ))}

            {/* hover callout — a highlight ring + boxed label so the active dot
                pops out of the cloud (the un-hovered dots are already dimmed). */}
            {active && (
              <g pointerEvents="none">
                <circle cx={active.x} cy={active.y} r={active.r + 4} fill="none" stroke="#141414" strokeWidth={1.5} />
                <text
                  x={Math.min(active.x + 10, W - PAD.r - 4)}
                  y={Math.max(active.y - 12, PAD.t + 12)}
                  textAnchor={active.x > W - 160 ? "end" : "start"}
                  className="fill-[#141414]"
                  style={{ fontSize: 12, fontWeight: 700, paintOrder: "stroke" }}
                  stroke="#fbf9f4"
                  strokeWidth={3}
                >
                  {active.m.shortName}
                </text>
              </g>
            )}

            {pts.length === 0 && (
              <text
                x={(W + PAD.l - PAD.r) / 2}
                y={(H + PAD.t - PAD.b) / 2}
                textAnchor="middle"
                className="fill-[#6f6a5f]"
                style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em" }}
              >
                SELECT AT LEAST ONE MAKER
              </text>
            )}
          </svg>
        </div>

        <VendorControls
          vendors={vendors}
          hidden={hiddenVendors}
          focused={focusedVendors}
          onToggleVendor={toggleVendor}
          onToggleFocus={toggleFocus}
          onShowAll={showAllVendors}
          onHideAll={hideAllVendors}
          onClearFocus={() => setFocusedVendors(new Set())}
          onHover={setHoverVendor}
          chartHeight={chartHeight}
        />
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
            <span className="tabular-nums">{perDay(active.m.avgDailyTokens)}</span>
            <span className="text-[#6f6a5f]">·</span>
            <span className="tabular-nums text-[#1a8a4a]">{perDollarDay(active.m.avgDailyPerDollar)}</span>
          </>
        ) : (
          <span className="text-[#6f6a5f]">
            Hover a dot for detail · {pts.length}/{plottableModels.length} models
            plotted · larger dot = more daily tokens per dollar
          </span>
        )}
      </div>
    </section>
  );
}

/** Interactive maker legend: checkbox = plotted, eye = vendor spotlight. */
function VendorControls({
  vendors,
  hidden,
  focused,
  onToggleVendor,
  onToggleFocus,
  onShowAll,
  onHideAll,
  onClearFocus,
  onHover,
  chartHeight,
}: {
  vendors: (TokenEconomicsData["vendors"][number] & { modelCount: number })[];
  hidden: Set<VendorId>;
  focused: Set<VendorId>;
  onToggleVendor: (id: VendorId) => void;
  onToggleFocus: (id: VendorId) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onClearFocus: () => void;
  onHover: (id: VendorId | null) => void;
  chartHeight: number | null;
}) {
  const shownCount = vendors.filter((v) => !hidden.has(v.vendor)).length;
  const focusCount = vendors.filter((v) => focused.has(v.vendor) && !hidden.has(v.vendor)).length;
  return (
    <aside
      className="box-border flex min-h-0 flex-col overflow-hidden border border-[#141414] bg-[#fbf9f4] p-3 xl:h-[var(--chart-panel-height)] xl:max-h-[var(--chart-panel-height)]"
      style={chartHeight ? ({ "--chart-panel-height": `${chartHeight}px` } as CSSProperties) : undefined}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#141414]">
            Makers
          </h3>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#6f6a5f]">
            {vendors.length} vendors · value map filter
          </p>
        </div>
        <span className="font-mono text-[10px] font-bold tabular-nums text-[#6f6a5f]">
          {shownCount}/{vendors.length}
        </span>
      </div>

      <div className="mb-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onShowAll}
          className="min-h-7 border border-[#141414]/45 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#141414] transition-colors hover:border-[#141414] hover:bg-[#ece8dd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141414]"
        >
          All
        </button>
        <button
          type="button"
          onClick={onHideAll}
          className="min-h-7 border border-[#141414]/45 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#141414] transition-colors hover:border-[#141414] hover:bg-[#ece8dd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141414]"
        >
          None
        </button>
        {focusCount > 0 && (
          <button
            type="button"
            onClick={onClearFocus}
            className="ml-auto inline-flex min-h-7 items-center gap-1 border border-[#d97706] px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#9a5600] transition-colors hover:bg-[#fff2d6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141414]"
            title="Clear focused makers"
          >
            <EyeOff className="size-3" />
            {focusCount}
          </button>
        )}
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${PANEL_SCROLLBAR}`}>
        <div className="flex flex-col gap-1">
          {vendors.map((v) => (
            <VendorControlRow
              key={v.vendor}
              vendor={v}
              hidden={hidden.has(v.vendor)}
              focused={focused.has(v.vendor) && !hidden.has(v.vendor)}
              onToggleVendor={onToggleVendor}
              onToggleFocus={onToggleFocus}
              onHover={onHover}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

function VendorControlRow({
  vendor,
  hidden,
  focused,
  onToggleVendor,
  onToggleFocus,
  onHover,
}: {
  vendor: TokenEconomicsData["vendors"][number] & { modelCount: number };
  hidden: boolean;
  focused: boolean;
  onToggleVendor: (id: VendorId) => void;
  onToggleFocus: (id: VendorId) => void;
  onHover: (id: VendorId | null) => void;
}) {
  const hasLogo = logoPath(vendor.vendor) != null;
  return (
    <div
      onMouseEnter={() => onHover(vendor.vendor)}
      onMouseLeave={() => onHover(null)}
      className={
        "flex min-h-9 items-center gap-1.5 border px-1.5 py-1 text-[10px] transition-colors " +
        (focused
          ? "border-[#d97706] bg-[#fff2d6]"
          : hidden
            ? "border-[#141414]/20 bg-[#f4f1ea] opacity-55"
            : "border-[#141414]/35 bg-[#fbf9f4] hover:border-[#141414] hover:bg-[#ece8dd]")
      }
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          checked={!hidden}
          onChange={() => onToggleVendor(vendor.vendor)}
          className="size-3.5 shrink-0 accent-[#141414]"
          aria-label={`${hidden ? "Show" : "Hide"} ${vendor.name}`}
        />
        <span className="flex size-5 shrink-0 items-center justify-center border border-[#141414]/40 bg-white p-0.5">
          {hasLogo ? (
            <VendorGlyph vendor={vendor.vendor} alt="" className="size-full" />
          ) : (
            <span
              className="size-2.5 border border-[#141414]"
              style={{ backgroundColor: vendorColor(vendor.vendor) }}
              aria-hidden
            />
          )}
        </span>
        <span className={hidden ? "min-w-0 flex-1 truncate text-[#6f6a5f] line-through" : "min-w-0 flex-1 truncate text-[#141414]"}>
          {vendor.name}
        </span>
        <span className="shrink-0 font-mono tabular-nums text-[#6f6a5f]">
          {vendor.modelCount}
        </span>
      </label>
      <button
        type="button"
        onClick={() => onToggleFocus(vendor.vendor)}
        disabled={hidden}
        aria-pressed={focused}
        aria-label={focused ? `Stop focusing ${vendor.name}` : `Focus ${vendor.name}`}
        title={focused ? `Stop focusing ${vendor.name}` : `Focus ${vendor.name}`}
        className={
          "flex size-7 shrink-0 items-center justify-center border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141414] disabled:cursor-not-allowed disabled:opacity-35 " +
          (focused
            ? "border-[#d97706] bg-[#d97706] text-white"
            : "border-[#141414]/35 text-[#6f6a5f] hover:border-[#141414] hover:bg-[#141414] hover:text-[#fbf9f4]")
        }
      >
        {focused ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      </button>
    </div>
  );
}

function QuadrantBadge({
  x,
  y,
  width,
  label,
  color,
  align = "start",
}: {
  x: number;
  y: number;
  width: number;
  label: string;
  color: string;
  align?: "start" | "end";
}) {
  const height = 18;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#fbf9f4"
        fillOpacity={0.88}
        stroke="#141414"
        strokeOpacity={0.26}
        strokeWidth={1}
      />
      <text
        x={align === "end" ? x + width - 7 : x + 7}
        y={y + 12.5}
        textAnchor={align}
        className="font-bold uppercase"
        fill={color}
        style={{ fontSize: 8.5, letterSpacing: "0.08em" }}
      >
        {label}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Tiny scale helpers (no d3 — this project hand-rolls its viz)
// ---------------------------------------------------------------------------

function extent(logs: number[]): [number, number] {
  return [Math.min(...logs), Math.max(...logs)];
}

/** Median of a numeric array (used for the quadrant crosshairs). */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function modelLabel(name: string): string {
  return name.length > 18 ? `${name.slice(0, 17)}…` : name;
}

function placeSpotlightLabels(points: Pt[]): SpotlightLabel[] {
  const top = PAD.t + 14;
  const bottom = H - PAD.b - 8;
  const rows: SpotlightLabel[] = points.map((p) => {
    const labelLeft = p.x > W - PAD.r - 190;
    return {
      ...p,
      labelX: clamp(
        labelLeft ? p.x - p.r - 8 : p.x + p.r + 8,
        PAD.l + 6,
        W - PAD.r - 6,
      ),
      labelY: clamp(p.y - p.r - 8, top, bottom),
      labelAnchor: labelLeft ? "end" : "start",
    };
  });

  for (const anchor of ["start", "end"] as const) {
    const group = rows
      .filter((row) => row.labelAnchor === anchor)
      .sort((a, b) => a.labelY - b.labelY);
    for (let i = 1; i < group.length; i++) {
      group[i].labelY = Math.max(group[i].labelY, group[i - 1].labelY + 14);
    }
    const overflow = (group[group.length - 1]?.labelY ?? bottom) - bottom;
    if (overflow > 0) {
      for (const row of group) row.labelY -= overflow;
      for (let i = group.length - 2; i >= 0; i--) {
        group[i].labelY = Math.min(group[i].labelY, group[i + 1].labelY - 14);
      }
    }
    for (const row of group) {
      row.labelY = clamp(row.labelY, top, bottom);
    }
  }

  return rows;
}
