"use client";

// Token Deals（让利账本）— the page brain. One payload (range "all", the full
// deal windows) drives EVERYTHING money-related: hero total, stat row, cards,
// ended archive. The chart additionally supports a 72H hourly view fetched on
// demand — but card numbers never come from the clipped window, so switching
// the chart range can't silently shrink the ledger (口径事故).
//
// State machine per the PRD: loading (skeleton) → ready → refreshing (silent) →
// degraded (fetch failed OR payload.live=false: list prices + discounts stay,
// money shows "—", auto-retry with 10s backoff).

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, ArrowUpRight, RefreshCw } from "lucide-react";
import {
  DEAL_RANGE_OPTIONS,
  type DealRangeKey,
  type DealSeries,
  type TokenDealsPayload,
} from "@research/token-deals/types";
import { VendorGlyph, StatBox } from "../token-economics/components";
import { LiveSkeletonStyles } from "../token-economics/LiveSkeletonChart";
import { ChartFrame } from "./ChartFrame";
import { SubsidyChart, AXIS_OPTIONS, type ChartAxis } from "./SubsidyChart";
import {
  dealHref,
  discountFactor,
  discountZhe,
  isDeepDiscount,
  perM,
  shortDate,
  subsidyPct,
  tokens,
  usdGrouped,
} from "./lib";

const ERROR_BACKOFF_MS = 10_000;
const REFRESH_SETTLE_MS = 750;
const DEFAULT_REFRESH_SECONDS = 300;

type SortKey = "saved" | "discount" | "used" | "newest";

const SORT_OPTIONS = [
  { key: "saved", label: "SAVED", title: "Most subsidy dollars first" },
  { key: "discount", label: "DISCOUNT", title: "Deepest discount first" },
  { key: "used", label: "USED", title: "Most in-deal tokens first" },
  { key: "newest", label: "NEWEST", title: "Most recently started first" },
] as const satisfies { key: SortKey; label: string; title: string }[];

async function fetchDeals(range: DealRangeKey, signal?: AbortSignal): Promise<TokenDealsPayload> {
  const res = await fetch(`/api/token-deals/live?range=${range}`, { cache: "no-store", signal });
  const json = (await res.json()) as TokenDealsPayload | { error?: string };
  if (!res.ok) throw new Error("error" in json && json.error ? json.error : "Deals fetch failed");
  return json as TokenDealsPayload;
}

function nextAlignedDelayMs(intervalSeconds: number): number {
  const intervalMs = Math.max(1, intervalSeconds) * 1000;
  return intervalMs - (Date.now() % intervalMs) + REFRESH_SETTLE_MS;
}

function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
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

export function DealsClient() {
  // The canonical payload — always range "all" (full deal windows).
  const [data, setData] = useState<TokenDealsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [manualRefresh, setManualRefresh] = useState(0);

  // Chart-only state: range + its on-demand 72h payload (cached per fetch round).
  // "Loading" is DERIVED (72h selected but no payload yet) rather than set
  // synchronously in the effect — react-hooks/set-state-in-effect.
  const [chartRange, setChartRange] = useState<DealRangeKey>("all");
  const [chart72h, setChart72h] = useState<TokenDealsPayload | null>(null);
  const [chart72hFailed, setChart72hFailed] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("saved");
  const [axis, setAxis] = useState<ChartAxis>("saved");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const hasDataRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    let timeoutId: number | null = null;
    let refreshSeconds = DEFAULT_REFRESH_SECONDS;

    const clearTimer = () => {
      if (timeoutId != null) window.clearTimeout(timeoutId);
      timeoutId = null;
    };

    const schedule = (delayMs: number) => {
      if (!live) return;
      clearTimer();
      timeoutId = window.setTimeout(() => void run(), delayMs);
    };

    async function run(signal?: AbortSignal) {
      clearTimer();
      if (hasDataRef.current) setRefreshing(true);
      try {
        const json = await fetchDeals("all", signal);
        if (!live) return;
        refreshSeconds = json.refreshIntervalSeconds || DEFAULT_REFRESH_SECONDS;
        hasDataRef.current = true;
        setData(json);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        // Degraded payloads (live=false) retry fast; healthy ones align to the
        // refresh boundary like the token-economics LIVE view.
        schedule(json.live ? nextAlignedDelayMs(refreshSeconds) : ERROR_BACKOFF_MS);
      } catch (err) {
        if (!live || signal?.aborted) return;
        setError(err instanceof Error ? err.message : "Deals fetch failed");
        setLoading(false);
        setRefreshing(false);
        schedule(ERROR_BACKOFF_MS);
      }
    }
    void run(controller.signal);
    return () => {
      live = false;
      controller.abort();
      clearTimer();
    };
  }, [manualRefresh]);

  // 72H chart payload — fetched lazily when the range is first selected, then
  // refreshed whenever the main poll round-trips (so the two stay in step).
  useEffect(() => {
    if (chartRange !== "72h") return;
    const controller = new AbortController();
    let live = true;
    fetchDeals("72h", controller.signal)
      .then((json) => {
        if (!live) return;
        setChart72h(json);
        setChart72hFailed(false);
      })
      .catch(() => {
        if (!live) return;
        setChart72hFailed(true);
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [chartRange, data?.generatedAt]);

  const retry = useCallback(() => setManualRefresh((n) => n + 1), []);

  const degraded = data != null && !data.live;
  const chartPayload = chartRange === "72h" ? chart72h : data;

  const active = useMemo(
    () => sortDeals((data?.deals ?? []).filter((d) => d.status === "active"), sortKey),
    [data?.deals, sortKey],
  );
  const ended = useMemo(
    () =>
      [...(data?.deals ?? [])]
        .filter((d) => d.status === "ended")
        .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? "")),
    [data?.deals],
  );

  const toggleSeries = useCallback((id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-16 pt-6 sm:px-6">
      {(degraded || error) && data && (
        <DegradedBanner
          message={error ?? "实时数据暂不可用 · Live data unavailable — 正在自动重试"}
          lastSuccessAt={data.lastSuccessAt}
          retrying={refreshing || loading}
          onRetry={retry}
        />
      )}

      {!data && loading ? (
        <DealsSkeleton />
      ) : !data ? (
        <ErrorPanel message={error ?? "Failed to load token deals."} onRetry={retry} />
      ) : (
        <div className="space-y-10">
          <Hero data={data} refreshing={refreshing} onRefresh={retry} />

          {/* ── ③ ACTIVE ledger wall ── */}
          <section className="space-y-3">
            <SectionHead
              title="ACTIVE DEALS · 进行中优惠"
              sub={`${active.length} deals running · every card links to the model on zenmux.ai`}
              right={
                <SegmentedControl
                  label="Sort deals"
                  options={SORT_OPTIONS}
                  value={sortKey}
                  onChange={setSortKey}
                />
              }
            />
            {active.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {active.map((deal) => (
                  <DealCard key={deal.id} deal={deal} live={data.live} />
                ))}
              </div>
            )}
          </section>

          {/* ── ④ Subsidy over time ── */}
          {data.live && chartPayload && (
            <section className="space-y-3">
              <SectionHead
                title="SUBSIDY OVER TIME · 让利累积曲线"
                sub="Cumulative, per deal — export the PNG for the receipts"
                right={
                  <div className="flex flex-wrap items-center gap-2">
                    <SegmentedControl
                      label="Y axis"
                      options={AXIS_OPTIONS}
                      value={axis}
                      onChange={setAxis}
                    />
                    <SegmentedControl
                      label="Time range"
                      options={DEAL_RANGE_OPTIONS.map((r) => ({
                        key: r.key,
                        label: r.label,
                        title:
                          r.key === "all"
                            ? "Every deal's full window (daily buckets)"
                            : "Trailing 72 hours (hourly buckets)",
                      }))}
                      value={chartRange}
                      onChange={setChartRange}
                    />
                  </div>
                }
              />
              {chartRange === "72h" && !chart72h ? (
                <div className="border border-[#141414]/35 bg-[#fbf9f4] px-4 py-16 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-[#6f6a5f]">
                  {chart72hFailed
                    ? "72H window failed to load — retrying on the next refresh"
                    : "Loading 72H window…"}
                </div>
              ) : (
                <ChartFrame filename={`subsidy-over-time-${chartRange}`}>
                  <SubsidyChart
                    payload={chartPayload}
                    axis={axis}
                    hidden={hidden}
                    onToggle={toggleSeries}
                  />
                </ChartFrame>
              )}
            </section>
          )}

          {/* ── ⑤ ENDED archive — same public page, desaturated, still in the
                 grand total (归档不出账). Hidden entirely until history exists. ── */}
          {ended.length > 0 && (
            <section className="space-y-3">
              <SectionHead
                title="ENDED DEALS · 已结束"
                sub="已结束优惠的让利仍计入总账 — the story ends, the ledger doesn't"
              />
              <EndedList deals={ended} />
            </section>
          )}

          {/* Freshness anchor (常驻，不只降级态)。 */}
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6f6a5f]">
            {data.live ? (
              <>
                Live data · updated {formatStamp(data.generatedAt)} {localZone()} · window{" "}
                {data.from.slice(0, 10)} → {formatStamp(data.to)} {localZone()} · refreshes every{" "}
                {Math.round(data.refreshIntervalSeconds / 60)}m
                {data.stale ? " · 数据截至上次成功聚合 (stale)" : ""}
              </>
            ) : (
              <>Registry prices shown · live billing aggregation unavailable</>
            )}{" "}
            · SAVED = Σ 优惠期内用量 × (原价 − 折后价) · 按牌面价差计，非财务结算口径
          </p>
        </div>
      )}
    </main>
  );
}

function sortDeals(deals: DealSeries[], key: SortKey): DealSeries[] {
  const saved = (d: DealSeries) => d.stats?.saved ?? 0;
  const used = (d: DealSeries) => d.stats?.tokens ?? 0;
  const sorted = [...deals];
  switch (key) {
    case "saved":
      // Rule 6: SAVED desc; ties (all zero / degraded) fall back to deeper discount first.
      return sorted.sort((a, b) => saved(b) - saved(a) || a.discount - b.discount);
    case "discount":
      return sorted.sort((a, b) => a.discount - b.discount || saved(b) - saved(a));
    case "used":
      return sorted.sort((a, b) => used(b) - used(a) || a.discount - b.discount);
    case "newest":
      return sorted.sort(
        (a, b) => b.startDate.localeCompare(a.startDate) || a.discount - b.discount,
      );
  }
}

/* ── ② Hero — the one oversized number on the page ─────────────────────────── */

function Hero({
  data,
  refreshing,
  onRefresh,
}: {
  data: TokenDealsPayload;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const totals = data.totals;
  return (
    <section className="border border-[#141414] bg-[#fbf9f4]">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <p className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6f6a5f]">
            Total saved for developers · 累计让利
            {data.live && (
              <span className="relative flex size-2" title="Live — refreshes automatically">
                <span className="absolute inline-flex size-full animate-ping bg-[#1a8a4a] opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 bg-[#1a8a4a]" />
                <span className="sr-only">Live</span>
              </span>
            )}
          </p>
          {totals ? (
            <div className="mt-2 break-all text-5xl font-bold leading-none tabular-nums text-[#1a8a4a] sm:text-7xl">
              {usdGrouped(totals.saved)}
            </div>
          ) : (
            <div className="mt-2">
              <div className="text-3xl font-bold uppercase leading-none tracking-[0.04em] text-[#6f6a5f] sm:text-5xl">
                — Live data unavailable
              </div>
              {data.lastSuccessAt && (
                <div className="mt-2 text-[11px] font-bold text-[#6f6a5f]">
                  上次成功更新 {formatStamp(data.lastSuccessAt)} {localZone()}
                </div>
              )}
            </div>
          )}
          <p className="mt-3 max-w-2xl text-[11px] font-bold leading-relaxed text-[#6f6a5f]">
            = Σ 优惠期内用量 × (原价 − 折后价) · 按牌面价差计，非财务结算口径 — list-price
            gap, not settlement cost. Ended deals stay in this total.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 border border-[#141414] bg-[#fbf9f4] px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors hover:bg-[#141414] hover:text-[#f4f1ea] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={"size-3 " + (refreshing ? "animate-spin" : "")} />
            Refresh
          </button>
          {data.live && (
            <span className="text-right text-[9px] font-bold uppercase tracking-[0.1em] text-[#6f6a5f]">
              Updated {formatStamp(data.generatedAt)} {localZone()}
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-px border-t border-[#141414] bg-[#141414] lg:grid-cols-4">
        <StatBox
          label="Active deals"
          value={String(data.activeCount)}
          sub={data.endedCount > 0 ? `${data.endedCount} ended · all in the total` : "every one on this page"}
          className="border-0"
        />
        <StatBox
          label="Avg discount"
          value={totals?.weightedDiscount != null ? discountFactor(totals.weightedDiscount) : "x—"}
          sub={
            totals?.weightedDiscount != null
              ? `≈ ${subsidyPct(totals.weightedDiscount)} subsidized · saved-weighted`
              : "saved-weighted"
          }
          accent={totals?.weightedDiscount != null && isDeepDiscount(totals.weightedDiscount) ? "#1a8a4a" : undefined}
          className="border-0"
        />
        <StatBox
          label="Tokens on deal"
          value={totals ? tokens(totals.tokens) : "—"}
          sub="all deal windows"
          className="border-0"
        />
        <StatBox
          label="Developers paid"
          value={totals ? usdGrouped(totals.paid) : "—"}
          sub={
            totals && totals.paid > 0
              ? `you pay $1 → ZenMux adds $${(totals.saved / totals.paid).toFixed(2)}`
              : "actual spend in deal windows"
          }
          className="border-0"
        />
      </div>
    </section>
  );
}

/* ── ③ The ledger card ─────────────────────────────────────────────────────── */

function DealCard({
  deal,
  live,
  variant = "active",
}: {
  deal: DealSeries;
  live: boolean;
  variant?: "active" | "ended";
}) {
  const href = dealHref(deal.slug, deal.delisted);
  const isEnded = variant === "ended";
  const deep = isDeepDiscount(deal.discount);
  const strikeColor = isEnded ? "text-[#6f6a5f]" : "text-[#cf3636]";
  const savedColor = isEnded ? "text-[#3d3a33]" : "text-[#1a8a4a]";

  const body = (
    <>
      {/* Header: identity + state badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center border border-[#141414]/45 bg-white p-1.5">
            <VendorGlyph vendor={deal.vendor} alt={deal.vendorName} className="size-full" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-bold leading-tight text-[#141414]">
              {deal.model}
            </span>
            <span className="block truncate text-[9px] font-bold uppercase tracking-[0.12em] text-[#6f6a5f]">
              {deal.vendorName}
              {deal.delisted ? " · 已下架" : ""}
            </span>
          </span>
        </div>
        {isEnded ? (
          <span className="shrink-0 border border-[#6f6a5f] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#6f6a5f]">
            Ended
          </span>
        ) : live ? (
          <span className="flex shrink-0 items-center gap-1.5 border border-[#1a8a4a] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#1a8a4a]">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping bg-[#1a8a4a] opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-1.5 bg-[#1a8a4a]" />
            </span>
            Live
          </span>
        ) : null}
      </div>

      {/* Price ledger: list price struck out → deal price. Without the struck
          original, the discount has no proof (设计决策：原价必须可见且被划掉). */}
      <div className={"mt-3 space-y-1 border px-2.5 py-2 " + (isEnded ? "border-[#141414]/25 bg-[#f4f1ea]" : "border-[#141414]/35 bg-white/60")}>
        <PriceRow
          label="Input"
          orig={perM(deal.origInput)}
          net={perM(deal.netInput)}
          strikeColor={strikeColor}
          netColor={savedColor}
        />
        <PriceRow
          label="Output"
          orig={perM(deal.origOutput)}
          net={perM(deal.netOutput)}
          strikeColor={strikeColor}
          netColor={savedColor}
        />
      </div>

      {/* Discount badge + subsidy rate */}
      <div className="mt-3 flex items-center gap-2.5">
        <span
          title={`用户支付比例 ${deal.discount.toFixed(4)} — SAVED = 期内用量 × (原价 − 折后价)`}
          className={
            "inline-flex items-baseline gap-1.5 border px-2 py-1 " +
            (isEnded
              ? "border-[#6f6a5f] text-[#3d3a33]"
              : deep
                ? "border-2 border-[#1a8a4a] text-[#1a8a4a]"
                : "border-[#141414] text-[#141414]")
          }
        >
          <span className="text-lg font-bold leading-none tabular-nums">
            {discountFactor(deal.discount)}
          </span>
          <span className="text-[10px] font-bold">{discountZhe(deal.discount)}</span>
        </span>
        <span className="text-[10px] font-bold leading-tight text-[#6f6a5f]">
          ZenMux 补贴 <span className={savedColor}>{subsidyPct(deal.discount)}</span>
          <br />
          of the list price
        </span>
      </div>

      {/* In-window trio — SAVED is the card's second focal point. */}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#141414]/25 pt-2.5">
        <CardStat label="Used" value={deal.stats ? tokens(deal.stats.tokens) : "—"} sub="tokens" />
        <CardStat label="Paid" value={deal.stats ? usdGrouped(deal.stats.paid) : "—"} />
        <CardStat
          label="Saved"
          value={deal.stats ? usdGrouped(deal.stats.saved) : "—"}
          valueClass={"text-[15px] " + savedColor}
        />
      </div>

      {/* Footer: window + outbound affordance */}
      <div className="mt-3 flex items-end justify-between gap-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[#6f6a5f]">
        <span>
          {isEnded && deal.endDate
            ? `${shortDate(deal.startDate)} — ${shortDate(deal.endDate)}`
            : `Since ${shortDate(deal.startDate)}`}
        </span>
        {href && (
          <ArrowUpRight
            className="size-3.5 shrink-0 text-[#141414] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden
          />
        )}
      </div>
    </>
  );

  const cardClass =
    "group flex h-full flex-col border p-4 transition-all " +
    (isEnded
      ? "border-[#141414]/45 bg-[#eceae3]"
      : "border-[#141414] bg-[#fbf9f4] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#141414] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141414]");

  // Whole card = one outbound funnel link (rule 8) unless delisted.
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${deal.model} — open on ZenMux`}
        className={cardClass}
      >
        {body}
      </a>
    );
  }
  return <div className={cardClass}>{body}</div>;
}

function PriceRow({
  label,
  orig,
  net,
  strikeColor,
  netColor,
}: {
  label: string;
  orig: string;
  net: string;
  strikeColor: string;
  netColor: string;
}) {
  return (
    <div className="grid grid-cols-[3.6rem_minmax(0,1fr)] items-baseline gap-2 text-[11px]">
      <span className="font-bold uppercase tracking-[0.1em] text-[#6f6a5f]">{label}</span>
      <span className="min-w-0 whitespace-nowrap font-bold tabular-nums">
        <span className={"line-through decoration-[1.5px] " + strikeColor}>{orig}</span>{" "}
        <span className="text-[#6f6a5f]">→</span>{" "}
        <span className={netColor + " text-[13px]"}>{net}</span>
        <span className="text-[#6f6a5f]"> /M</span>
      </span>
    </div>
  );
}

function CardStat({
  label,
  value,
  sub,
  valueClass = "text-[13px] text-[#141414]",
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#6f6a5f]">{label}</div>
      <div className={"mt-0.5 truncate font-bold tabular-nums " + valueClass}>{value}</div>
      {sub && <div className="text-[8px] font-bold text-[#6f6a5f]">{sub}</div>}
    </div>
  );
}

/* ── ⑤ Ended archive: compact row ⇄ expanded card ──────────────────────────── */

function EndedList({ deals }: { deals: DealSeries[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="border border-[#141414]/45">
      {deals.map((deal, i) => {
        const open = expanded.has(deal.id);
        const href = dealHref(deal.slug, deal.delisted);
        return (
          <div key={deal.id} className={i > 0 ? "border-t border-[#141414]/25" : ""}>
            <div className="flex items-stretch bg-[#eceae3]">
              <button
                type="button"
                onClick={() => toggle(deal.id)}
                aria-expanded={open}
                className="grid min-h-12 flex-1 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[#e4e1d8] sm:gap-4"
              >
                <span className="flex size-7 items-center justify-center border border-[#141414]/35 bg-white p-1">
                  <VendorGlyph vendor={deal.vendor} alt={deal.vendorName} className="size-full" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-bold text-[#141414]">
                    {deal.model}
                    {deal.delisted && (
                      <span className="ml-1.5 text-[9px] font-bold uppercase text-[#6f6a5f]">已下架</span>
                    )}
                  </span>
                  <span className="block truncate text-[9px] font-bold uppercase tracking-[0.1em] text-[#6f6a5f]">
                    {deal.endDate ? `${shortDate(deal.startDate)} — ${shortDate(deal.endDate)}` : shortDate(deal.startDate)}
                  </span>
                </span>
                <span className="hidden border border-[#6f6a5f] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#3d3a33] sm:inline-flex">
                  {discountFactor(deal.discount)}
                </span>
                <span className="text-right">
                  <span className="block text-[8px] font-bold uppercase tracking-[0.12em] text-[#6f6a5f]">
                    Saved
                  </span>
                  <span className="block text-[12px] font-bold tabular-nums text-[#3d3a33]">
                    {deal.stats ? usdGrouped(deal.stats.saved) : "—"}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={
                    "text-[10px] font-bold text-[#6f6a5f] transition-transform " +
                    (open ? "rotate-90" : "")
                  }
                >
                  ▸
                </span>
              </button>
              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${deal.model} on ZenMux`}
                  className="flex w-9 shrink-0 items-center justify-center border-l border-[#141414]/25 text-[#6f6a5f] transition-colors hover:bg-[#141414] hover:text-[#f4f1ea]"
                >
                  <ArrowUpRight className="size-3.5" />
                </a>
              )}
            </div>
            {open && (
              <div className="border-t border-[#141414]/25 bg-[#eceae3] p-3">
                <div className="max-w-md">
                  <DealCard deal={deal} live={false} variant="ended" />
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div className="border-t border-[#141414]/25 bg-[#eceae3] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#6f6a5f]">
        共 {deals.length} 条已结束优惠 · 让利已计入顶部总账
      </div>
    </div>
  );
}

/* ── Shared chrome ─────────────────────────────────────────────────────────── */

function SectionHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-1">
      <div>
        <h2 className="text-base font-bold uppercase leading-none tracking-[0.13em] sm:text-lg">
          {title}
        </h2>
        <p className="mt-1 text-[10px] font-bold tracking-[0.02em] text-[#6f6a5f]">{sub}</p>
      </div>
      {right}
    </div>
  );
}

function SegmentedControl<K extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { key: K; label: string; title: string }[];
  value: K;
  onChange: (value: K) => void;
}) {
  return (
    <div className="flex items-center gap-0 border border-[#141414] bg-[#fbf9f4] p-1" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={
            "min-h-8 cursor-pointer border px-2.5 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors sm:px-3 " +
            (value === option.key
              ? "border-[#141414] bg-[#141414] text-[#f4f1ea]"
              : "border-transparent bg-[#fbf9f4] hover:border-[#141414] hover:bg-[#ece8dd]")
          }
          title={option.title}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DegradedBanner({
  message,
  lastSuccessAt,
  retrying,
  onRetry,
}: {
  message: string;
  lastSuccessAt: string | null;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border border-[#b8860b] bg-[#fdf6df] px-3 py-2">
      <div className="flex items-start gap-2 text-[11px] text-[#7a5b06]">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <div>
          <span className="font-bold">{message}</span>
          {lastSuccessAt && (
            <span className="ml-2 text-[#8a7a3d]">
              上次成功更新 {formatStamp(lastSuccessAt)} {localZone()}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="cursor-pointer border border-[#7a5b06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7a5b06] transition-colors hover:bg-[#7a5b06] hover:text-[#fdf6df] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {retrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border border-[#cf3636] bg-[#fff6f2] px-3 py-2.5 text-[11px] text-[#cf3636]">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <div>
          <div className="font-bold uppercase tracking-[0.12em]">Token deals unavailable</div>
          <div className="mt-0.5 text-[#6f6a5f]">{message}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="cursor-pointer border border-[#cf3636] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors hover:bg-[#cf3636] hover:text-[#fff6f2]"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-[#141414]/35 bg-[#fbf9f4] px-4 py-14 text-center">
      <div className="text-sm font-bold uppercase tracking-[0.14em] text-[#141414]">
        暂无进行中的优惠
      </div>
      <p className="mt-1.5 text-[11px] font-bold text-[#6f6a5f]">
        No deals are running right now — history (if any) stays archived below.
      </p>
    </div>
  );
}

function DealsSkeleton() {
  return (
    <div className="space-y-10" role="status" aria-label="Loading the subsidy ledger">
      <LiveSkeletonStyles />
      <span className="sr-only">Loading the subsidy ledger</span>
      <div className="border border-[#141414] bg-[#fbf9f4] px-5 py-6">
        <span className="te-live-skeleton-shine inline-block h-3 w-64 border border-[#141414]/15 bg-[#ece8dd]" />
        <div className="mt-3">
          <span className="te-live-skeleton-shine inline-block h-14 w-80 max-w-full border border-[#141414]/15 bg-[#ece8dd] sm:h-16" />
        </div>
        <div className="mt-3">
          <span className="te-live-skeleton-shine inline-block h-3 w-96 max-w-full border border-[#141414]/15 bg-[#ece8dd]" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="te-live-skeleton-shine block h-16 border border-[#141414]/15 bg-[#ece8dd]" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="te-live-skeleton-shine block h-64 border border-[#141414]/15 bg-[#ece8dd]" />
        ))}
      </div>
    </div>
  );
}
