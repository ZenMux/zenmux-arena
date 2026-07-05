"use client";

// THE LADDER — the at-a-glance ranking the board deliberately doesn't do.
// One row per deal, ranked by the selected metric (SAVED $ / TOKENS / % OFF),
// a full-width vendor-color bar for the glance, and a cumulative-saved
// sparkline so the trend rides inside the ranking. Clicking a row expands it
// in place into the full trend chart (DealTrendPanel) — the outbound ZenMux
// link lives inside the panel now, not on the row.

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type { DealSeries, TokenDealsPayload } from "@research/token-deals/types";
import { VendorGlyph } from "../../token-economics/components";
import {
  applyDateWindow,
  bandTheme,
  DEAL_FILTER_OPTIONS,
  discountFactor,
  fullLedgerWindow,
  matchesDealFilter,
  percentOff,
  shortDate,
  subsidyPct,
  tokens,
  trimEndedTail,
  usdGrouped,
  type DateWindow,
  type DealFilter,
} from "../lib";
import { formatStamp, localZone, useDealsFeed } from "../useDealsFeed";
import { WindowControl } from "../WindowControl";
import { SegmentedControl } from "../SegmentedControl";
import { FreshnessBar } from "../FreshnessBar";
import { DealTrendPanel } from "./DealTrendPanel";

type Metric = "saved" | "tokens" | "off";

const METRIC_OPTIONS = [
  { key: "saved", label: "SAVED $", title: "Subsidy dollars, full deal window" },
  { key: "tokens", label: "TOKENS", title: "In-deal tokens, full deal window" },
  { key: "off", label: "% OFF", title: "Discount depth (free = 100%)" },
] as const satisfies { key: Metric; label: string; title: string }[];

function metricValue(deal: DealSeries, metric: Metric): number {
  if (metric === "saved") return deal.stats?.saved ?? 0;
  if (metric === "tokens") return deal.stats?.tokens ?? 0;
  return 1 - deal.discount; // % off; free deals have discount 0 → 1.0
}

function metricLabel(deal: DealSeries, metric: Metric): string {
  if (metric === "saved") return deal.stats ? usdGrouped(deal.stats.saved) : "—";
  if (metric === "tokens") return deal.stats ? tokens(deal.stats.tokens) : "—";
  return deal.dealType === "free" ? "100%" : subsidyPct(deal.discount);
}

export function LadderClient({ initialData = null }: { initialData?: TokenDealsPayload | null }) {
  const { data, error, loading, refreshing, degraded, retry } = useDealsFeed(initialData);
  const [metric, setMetric] = useState<Metric>("saved");
  const [filter, setFilter] = useState<DealFilter>("all");
  const [win, setWin] = useState<DateWindow>(() => fullLedgerWindow());
  const [openId, setOpenId] = useState<string | null>(null);

  const ranked = useMemo(() => {
    // Window slicing happens client-side (additive daily points, see lib.ts) —
    // stats, bars, and sparklines all re-cut without a refetch.
    const deals = applyDateWindow(data?.deals ?? [], win).filter(
      (d) =>
        (d.status === "active" || d.status === "ended") && matchesDealFilter(d, filter),
    );
    return [...deals].sort(
      (a, b) => metricValue(b, metric) - metricValue(a, metric) || a.discount - b.discount,
    );
  }, [data?.deals, metric, win, filter]);
  const max = Math.max(1e-9, ...ranked.map((d) => metricValue(d, metric)));

  return (
    <main className="flex-1">
      {(degraded || error) && data && (
        <div className="border-b-[3px] border-[#0a0a0b] bg-[#d9940a]">
          <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[#442c00] sm:px-8">
            <div className="flex items-start gap-2 font-[family-name:var(--font-deals-mono)] text-[11px] font-semibold uppercase tracking-[0.06em]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span className="font-bold">
                {error ?? "Live billing data unavailable — retrying automatically"}
                {data.lastSuccessAt && (
                  <span className="ml-2 opacity-75">
                    last success {formatStamp(data.lastSuccessAt)} {localZone()}
                  </span>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={retry}
              disabled={refreshing || loading}
              className="cursor-pointer border border-current px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing || loading ? "Retrying…" : "Retry"}
            </button>
          </div>
        </div>
      )}

      {!data && loading ? (
        <LadderSkeleton />
      ) : !data ? (
        <div className="border-b-[3px] border-[#0a0a0b] bg-[#d7263d]">
          <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-3 px-4 py-8 text-[#ffd6db] sm:px-8">
            <div>
              <div className="font-[family-name:var(--font-deals-display)] text-2xl uppercase leading-none tracking-tight sm:text-4xl">
                Ladder unavailable
              </div>
              <div className="mt-2 font-[family-name:var(--font-deals-mono)] text-[11px] font-semibold uppercase tracking-[0.08em] opacity-80">
                {error ?? "Failed to load token deals."}
              </div>
            </div>
            <button
              type="button"
              onClick={retry}
              className="cursor-pointer border-2 border-current px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-opacity hover:opacity-70"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── The ladder ── */}
          <section aria-label="Deal ranking">
            <div className="border-b border-white/10 bg-[#141416]">
              <div className="mx-auto flex w-full max-w-[1800px] justify-end px-4 py-2.5 sm:px-8">
                <FreshnessBar
                  generatedAt={data.generatedAt}
                  refreshIntervalSeconds={data.refreshIntervalSeconds}
                  refreshing={refreshing || loading}
                  onRefresh={retry}
                />
              </div>
            </div>
            <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-end justify-between gap-3 px-4 py-5 sm:px-8">
              <div>
                <h2 className="font-[family-name:var(--font-deals-display)] text-xl uppercase leading-none tracking-tight text-white sm:text-3xl">
                  {ranked.length} deals ranked
                </h2>
                <p className="mt-1.5 font-[family-name:var(--font-deals-mono)] text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
                  Bar = share of the #1 deal · sparkline = cumulative saved · click a row for the
                  full trend
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <WindowControl value={win} onChange={setWin} />
                <SegmentedControl
                  label="Filter deals"
                  options={DEAL_FILTER_OPTIONS}
                  value={filter}
                  onChange={setFilter}
                />
                <SegmentedControl
                  label="Ranking metric"
                  options={METRIC_OPTIONS}
                  value={metric}
                  onChange={setMetric}
                />
              </div>
            </div>

            <div className="mx-auto w-full max-w-[1800px] px-4 pb-10 sm:px-8">
              <div className="flex flex-col">
                {ranked.map((deal, i) => (
                  <LadderRow
                    key={deal.id}
                    deal={deal}
                    rank={i + 1}
                    ratio={metricValue(deal, metric) / max}
                    label={metricLabel(deal, metric)}
                    open={openId === deal.id}
                    onToggle={() => setOpenId((cur) => (cur === deal.id ? null : deal.id))}
                  />
                ))}
              </div>
            </div>
          </section>

          <div className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-8">
            <p className="font-[family-name:var(--font-deals-mono)] text-[10px] font-semibold uppercase leading-relaxed tracking-[0.08em] text-white/40">
              {data.live ? "Live data" : "Cached deal facts shown · live billing aggregation unavailable"}{" "}
              · ended deals keep their rank — the ladder measures the whole window · an ended
              deal&apos;s curve stops at its last active day
            </p>
          </div>
        </>
      )}
    </main>
  );
}

/* ── One rung of the ladder ───────────────────────────────────────────────── */

function LadderRow({
  deal,
  rank,
  ratio,
  label,
  open,
  onToggle,
}: {
  deal: DealSeries;
  rank: number;
  ratio: number;
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  const theme = bandTheme(deal.vendor);
  const isFree = deal.dealType === "free";
  const ended = deal.status === "ended";
  const panelId = `deal-panel-${deal.id.replace(/[^a-zA-Z0-9-]/g, "")}`;

  const inner = (
    <div
      className={
        "grid grid-cols-[2rem_2.25rem_minmax(0,1fr)] items-center gap-x-3 py-3 sm:grid-cols-[2.5rem_2.5rem_minmax(0,16rem)_minmax(0,1fr)_5.5rem] sm:gap-x-4 " +
        (ended && !open ? "opacity-55" : "")
      }
    >
      <span className="text-right font-[family-name:var(--font-deals-mono)] text-sm font-bold tabular-nums text-white/40">
        {String(rank).padStart(2, "0")}
      </span>
      <span className="flex size-8 items-center justify-center rounded-full border border-white/25 bg-white p-1 sm:size-9">
        <VendorGlyph vendor={deal.vendor} alt={deal.vendorName} className="size-full" />
      </span>

      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-[family-name:var(--font-deals-display)] text-base uppercase leading-tight tracking-tight text-white sm:text-xl">
            {deal.model}
          </span>
          <ChevronDown
            className={
              "hidden size-3.5 shrink-0 text-white/40 transition-transform duration-200 group-hover:text-white sm:block " +
              (open ? "rotate-180" : "")
            }
            aria-hidden
          />
        </div>
        <div className="mt-0.5 truncate font-[family-name:var(--font-deals-mono)] text-[10px] font-semibold uppercase tracking-[0.1em] text-white/45">
          {deal.vendorName} ·{" "}
          <span style={{ color: ended ? undefined : "#41f08d" }}>
            {isFree ? "FREE" : percentOff(deal.discount)}
          </span>
          {!isFree && <> · you pay {discountFactor(deal.discount)}</>}
          {ended && deal.endDate
            ? ` · ended ${shortDate(deal.endDate)}`
            : deal.publishTime
              ? ` · released ${shortDate(deal.publishTime.slice(0, 10))}`
              : ""}
          {deal.delisted ? " · delisted" : ""}
        </div>
      </div>

      {/* The bar + value — the at-a-glance half. */}
      <div className="col-span-3 mt-2 flex items-center gap-3 sm:col-span-1 sm:mt-0">
        <div className="h-7 min-w-0 flex-1 bg-white/[0.07] sm:h-8">
          <div
            className="flex h-full items-center justify-end transition-[width] duration-500"
            style={{ width: `${Math.max(ratio * 100, 0.75)}%`, backgroundColor: theme.bg }}
          >
            <span
              className="hidden truncate px-2 font-[family-name:var(--font-deals-mono)] text-[11px] font-bold tabular-nums lg:inline"
              style={{ color: theme.title, opacity: ratio > 0.14 ? 1 : 0 }}
            >
              {label}
            </span>
          </div>
        </div>
        <span className="w-20 shrink-0 text-right font-[family-name:var(--font-deals-mono)] text-xs font-bold tabular-nums text-white sm:text-sm lg:hidden">
          {label}
        </span>
        <span className="hidden w-24 shrink-0 text-right font-[family-name:var(--font-deals-mono)] text-sm font-bold tabular-nums text-white lg:inline">
          {label}
        </span>
      </div>

      {/* The trend half: cumulative saved sparkline over the deal's window. */}
      <div className="hidden items-center justify-end sm:flex">
        <Sparkline deal={deal} color={ended ? "rgba(255,255,255,0.35)" : theme.bg} />
      </div>
    </div>
  );

  return (
    <div className={"border-b border-white/10 " + (open ? "bg-white/[0.03]" : "")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`#${rank} ${deal.model} — ${open ? "collapse" : "expand"} trend details`}
        className="group block w-full cursor-pointer px-1 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
      >
        {inner}
      </button>
      {/* Grid-rows height animation: 0fr → 1fr keeps the collapse smooth
          without measuring content height in JS. */}
      <div
        id={panelId}
        className={
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none " +
          (open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")
        }
      >
        <div className="overflow-hidden">{open && <DealTrendPanel deal={deal} />}</div>
      </div>
    </div>
  );
}

/** Tiny cumulative-saved curve (or flat line when degraded / no points). */
function Sparkline({ deal, color }: { deal: DealSeries; color: string }) {
  const W = 96;
  const H = 30;
  const spark = useMemo(() => {
    // Ended deals stop charting at their last active day — no flat tail out
    // to "now" for a model that's been offline for weeks (trimEndedTail).
    const points = deal.points ? trimEndedTail(deal) : null;
    if (!points || points.length === 0) return null;
    let total = 0;
    const cum = points.map((p) => (total += p.saved));
    const maxV = Math.max(1e-9, cum[cum.length - 1]);
    const n = cum.length;
    const yFor = (v: number) => H - 2 - (v / maxV) * (H - 4);
    const d = cum
      .map((v, i) => {
        const x = n <= 1 ? W : (i / (n - 1)) * W;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${yFor(v).toFixed(1)}`;
      })
      .join(" ");
    return { d, endY: yFor(cum[n - 1]) };
  }, [deal]);

  if (!spark) {
    return <div className="h-[30px] w-24 border-b border-dashed border-white/15" aria-hidden />;
  }
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="shrink-0"
      role="img"
      aria-label={`${deal.model} cumulative savings trend`}
    >
      <path d={spark.d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={W} cy={spark.endY} r="2.5" fill={color} />
    </svg>
  );
}

/* ── Chrome ───────────────────────────────────────────────────────────────── */

function LadderSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-8" role="status" aria-label="Loading the ladder">
      <span className="sr-only">Loading the ladder</span>
      <div className="h-8 w-64 animate-pulse bg-white/10" />
      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse bg-white/[0.07]" />
        ))}
      </div>
    </div>
  );
}
