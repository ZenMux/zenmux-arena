"use client";

// Token Deals — THE BOARD. A stadium scoreboard of every subsidy ZenMux is
// running: a giant green total, four solid stat blocks, then one full-bleed
// band per deal in the vendor's brand color (flag-circle logo, poster-size
// model name, poster-size % OFF). Ended deals archive as desaturated strips.
//
// One payload (range "all", full deal windows) drives EVERYTHING money-related
// via useDealsFeed — the trend charts live on /token-deals/ladder.

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, RefreshCw } from "lucide-react";
import type { DealSeries, TokenDealsPayload } from "@research/token-deals/types";
import { VendorGlyph } from "../token-economics/components";
import {
  bandTheme,
  dealHref,
  discountFactor,
  percentOff,
  perM,
  shortDate,
  subsidyPct,
  tokens,
  usdGrouped,
} from "./lib";
import { formatStamp, localZone, useDealsFeed } from "./useDealsFeed";

type SortKey = "saved" | "discount" | "used" | "newest";
type DealFilter = "all" | "discount" | "free";

const SORT_OPTIONS = [
  { key: "saved", label: "SAVED", title: "Most subsidy dollars first" },
  { key: "discount", label: "% OFF", title: "Deepest discount first" },
  { key: "used", label: "USED", title: "Most in-deal tokens first" },
  { key: "newest", label: "NEWEST", title: "Most recently started first" },
] as const satisfies { key: SortKey; label: string; title: string }[];

const FILTER_OPTIONS = [
  { key: "all", label: "ALL", title: "Every live deal" },
  { key: "discount", label: "DISCOUNTED", title: "Percentage-off deals only" },
  { key: "free", label: "FREE", title: "Free (100% off) models only" },
] as const satisfies { key: DealFilter; label: string; title: string }[];

// The scoreboard panel palette — worldcup kick-off green, broadcast amber,
// pitch blue, signal red. Solid blocks, same-hue deep/pale ink.
const PANEL = {
  green: { bg: "#0c6b33", ink: "#41f08d" },
  amber: { bg: "#d9940a", ink: "#442c00" },
  blue: { bg: "#1747c0", ink: "#bccbff" },
  red: { bg: "#d7263d", ink: "#ffd6db" },
} as const;

function sortDeals(deals: DealSeries[], key: SortKey): DealSeries[] {
  const saved = (d: DealSeries) => d.stats?.saved ?? 0;
  const used = (d: DealSeries) => d.stats?.tokens ?? 0;
  const sorted = [...deals];
  switch (key) {
    case "saved":
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

/** "Providers: KingsoftCloud x0.34, Xiaomi x0.93" — band tooltip when the
    factor differs across providers (the band shows the deepest one). */
function providersTitle(deal: DealSeries): string {
  if (deal.providers.length <= 1) return "";
  return ` · providers: ${deal.providers.map((p) => `${p.name} ${discountFactor(p.discount)}`).join(", ")}`;
}

export function DealsClient() {
  const { data, error, loading, refreshing, degraded, retry } = useDealsFeed();
  const [sortKey, setSortKey] = useState<SortKey>("saved");
  const [filter, setFilter] = useState<DealFilter>("all");

  const active = useMemo(
    () =>
      sortDeals(
        (data?.deals ?? []).filter(
          (d) =>
            d.status === "active" && (filter === "all" || d.dealType === filter),
        ),
        sortKey,
      ),
    [data?.deals, sortKey, filter],
  );
  const ended = useMemo(
    () =>
      [...(data?.deals ?? [])]
        .filter((d) => d.status === "ended")
        .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? "")),
    [data?.deals],
  );

  return (
    <main className="flex-1">
      {(degraded || error) && data && (
        <DegradedBanner
          message={error ?? "Live billing data unavailable — retrying automatically"}
          lastSuccessAt={data.lastSuccessAt}
          retrying={refreshing || loading}
          onRetry={retry}
        />
      )}

      {!data && loading ? (
        <BoardSkeleton />
      ) : !data ? (
        <ErrorPanel message={error ?? "Failed to load token deals."} onRetry={retry} />
      ) : (
        <>
          <Ticker data={data} />
          <Hero data={data} refreshing={refreshing} onRefresh={retry} />
          <StatBlocks data={data} />

          {/* ── The band wall ── */}
          <section aria-label="Active deals">
            <SectionStrip
              title={`${active.length} deals live`}
              sub="Every band links to the model on zenmux.ai"
              right={
                <div className="flex flex-wrap items-center gap-2">
                  <SegmentedControl
                    label="Filter deals"
                    options={FILTER_OPTIONS}
                    value={filter}
                    onChange={setFilter}
                  />
                  <SegmentedControl
                    label="Sort deals"
                    options={SORT_OPTIONS}
                    value={sortKey}
                    onChange={setSortKey}
                  />
                </div>
              }
            />
            {active.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="flex flex-col gap-[3px] bg-[#0a0a0b]">
                {active.map((deal) => (
                  <DealBand key={deal.id} deal={deal} live={data.live} />
                ))}
              </div>
            )}
          </section>

          {/* ── Ended archive — desaturated strips, still in the grand total ── */}
          {ended.length > 0 && (
            <section aria-label="Ended deals">
              <SectionStrip
                title={`${ended.length} deals ended`}
                sub="The deal ends — its savings stay on the board"
              />
              <div className="flex flex-col gap-[3px]">
                {ended.map((deal) => (
                  <EndedStrip key={deal.id} deal={deal} />
                ))}
              </div>
            </section>
          )}

          <FinePrint data={data} />
        </>
      )}
    </main>
  );
}

/* ── Ticker: the dateline strip under the nav ─────────────────────────────── */

function Ticker({ data }: { data: TokenDealsPayload }) {
  const today = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  return (
    <div className="border-b border-white/15 bg-[#0a0a0b]">
      <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center gap-x-2 px-4 py-2 font-[family-name:var(--font-deals-mono)] text-[11px] font-semibold uppercase tracking-[0.1em] text-white sm:px-8">
        <span className="font-bold">Token deals:</span>
        <span className="text-white/70" suppressHydrationWarning>
          {today}
        </span>
        <span className="text-white/40">—</span>
        <span>{data.activeCount} deals live</span>
        {data.live && (
          <span className="relative ml-1 flex size-2" title="Live — refreshes automatically">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#41f08d] opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-[#41f08d]" />
            <span className="sr-only">Live</span>
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Hero: the one gigantic number ────────────────────────────────────────── */

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
    <section style={{ backgroundColor: PANEL.green.bg }} className="border-b-[3px] border-[#0a0a0b]">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.24em] sm:text-xs"
            style={{ color: PANEL.green.ink }}
          >
            Total saved for developers
          </p>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 border px-2.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: PANEL.green.ink, color: PANEL.green.ink }}
          >
            <RefreshCw className={"size-3 " + (refreshing ? "animate-spin" : "")} />
            Refresh
          </button>
        </div>

        {totals ? (
          <div
            className="mt-3 break-all font-[family-name:var(--font-deals-display)] text-[clamp(3.5rem,11vw,10.5rem)] leading-[0.95] tracking-tight tabular-nums"
            style={{ color: PANEL.green.ink }}
          >
            {usdGrouped(totals.saved)}
          </div>
        ) : (
          <div
            className="mt-4 font-[family-name:var(--font-deals-display)] text-[clamp(2rem,6vw,4.5rem)] leading-none"
            style={{ color: PANEL.green.ink }}
          >
            — LIVE DATA UNAVAILABLE
          </div>
        )}

        <p
          className="mt-4 max-w-3xl font-[family-name:var(--font-deals-mono)] text-[11px] font-semibold uppercase tracking-[0.06em] sm:text-xs"
          style={{ color: "rgba(255,255,255,0.75)" }}
        >
          {totals ? (
            <>
              Pay-as-you-go {usdGrouped(totals.saved - totals.subSaved)} · subscription{" "}
              {usdGrouped(totals.subSaved)} · counted from the same billing data that produces
              your invoices. Ended deals stay in this total.
            </>
          ) : data.lastSuccessAt ? (
            <>Last successful update {formatStamp(data.lastSuccessAt)} {localZone()}</>
          ) : (
            <>Deal facts shown — live billing aggregation unavailable</>
          )}
        </p>
      </div>
    </section>
  );
}

/* ── Stat blocks: four solid panels, worldcup split-screen style ──────────── */

function StatBlocks({ data }: { data: TokenDealsPayload }) {
  const totals = data.totals;
  const blocks = [
    {
      panel: PANEL.amber,
      label: "Avg discount",
      value: totals?.weightedDiscount != null ? percentOff(totals.weightedDiscount) : "—",
      sub: "saved-weighted · paid deals",
    },
    {
      panel: PANEL.blue,
      label: "Tokens on deal",
      value: totals ? tokens(totals.tokens) : "—",
      sub: "all deal windows",
    },
    {
      panel: { bg: "#f4f1ea", ink: "#141414" },
      label: "Developers paid",
      value: totals ? usdGrouped(totals.paid) : "—",
      sub: "actual spend in deal windows",
    },
    {
      panel: PANEL.red,
      label: "Deals live",
      value: String(data.activeCount),
      sub: data.endedCount > 0 ? `${data.endedCount} ended · all on the board` : "right now",
    },
  ];
  return (
    <section className="grid grid-cols-2 gap-[3px] border-b-[3px] border-[#0a0a0b] bg-[#0a0a0b] lg:grid-cols-4">
      {blocks.map((b) => (
        <div key={b.label} style={{ backgroundColor: b.panel.bg }} className="px-4 py-6 sm:px-6 sm:py-8">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: b.panel.ink, opacity: 0.85 }}
          >
            {b.label}
          </div>
          <div
            className="mt-2 truncate font-[family-name:var(--font-deals-display)] text-3xl leading-none tabular-nums sm:text-5xl"
            style={{ color: b.panel.ink }}
          >
            {b.value}
          </div>
          <div
            className="mt-2 truncate font-[family-name:var(--font-deals-mono)] text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: b.panel.ink, opacity: 0.7 }}
          >
            {b.sub}
          </div>
        </div>
      ))}
    </section>
  );
}

/* ── The deal band: one full-bleed vendor-color row ───────────────────────── */

function DealBand({ deal, live }: { deal: DealSeries; live: boolean }) {
  const theme = bandTheme(deal.vendor);
  const href = dealHref(deal.slug, deal.delisted);
  const isFree = deal.dealType === "free";
  const multiRate = new Set(deal.providers.map((p) => p.discount)).size > 1;

  const priceLine =
    !isFree && deal.origInput != null && deal.netInput != null && deal.origOutput != null && deal.netOutput != null ? (
      <>
        <span>
          IN <s className="opacity-60">{perM(deal.origInput)}</s> {perM(deal.netInput)}
        </span>
        <span aria-hidden>·</span>
        <span>
          OUT <s className="opacity-60">{perM(deal.origOutput)}</s> {perM(deal.netOutput)}
        </span>
        <span aria-hidden>·</span>
        <span>/M TOKENS</span>
      </>
    ) : isFree && deal.origInput != null && deal.origOutput != null ? (
      <>
        <span>
          IN <s className="opacity-60">{perM(deal.origInput)}</s> $0
        </span>
        <span aria-hidden>·</span>
        <span>
          OUT <s className="opacity-60">{perM(deal.origOutput)}</s> $0
        </span>
        <span aria-hidden>·</span>
        <span>/M TOKENS</span>
      </>
    ) : isFree ? (
      <span>$0 / M TOKENS — INPUT &amp; OUTPUT</span>
    ) : null;

  const body = (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-7 sm:px-8 sm:py-9">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span
            className="flex size-10 items-center justify-center rounded-full border-2 bg-white p-1.5 shadow-[0_2px_6px_rgba(0,0,0,0.25)] sm:size-12"
            style={{ borderColor: theme.isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.4)" }}
          >
            <VendorGlyph vendor={deal.vendor} alt={deal.vendorName} className="size-full" />
          </span>
          <h3
            className="mt-3 flex min-w-0 items-baseline gap-3 font-[family-name:var(--font-deals-display)] text-[clamp(1.9rem,5.2vw,4.6rem)] uppercase leading-[0.95] tracking-tight"
            style={{ color: theme.title }}
          >
            <span className="break-words">{deal.model}</span>
            {href && (
              <ArrowUpRight
                className="hidden size-[0.55em] shrink-0 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100 sm:block"
                aria-hidden
              />
            )}
          </h3>
          <div
            className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-[family-name:var(--font-deals-mono)] text-[11px] font-semibold uppercase tracking-[0.08em] sm:text-xs"
            style={{ color: theme.meta }}
          >
            <span className="font-bold">{deal.vendorName}</span>
            {deal.delisted && <span>· delisted</span>}
            {priceLine && <span aria-hidden>·</span>}
            {priceLine}
            {deal.publishTime && (
              <>
                <span aria-hidden>·</span>
                <span>released {shortDate(deal.publishTime.slice(0, 10))}</span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div
            className="font-[family-name:var(--font-deals-display)] leading-[0.95] tracking-tight"
            style={{ color: theme.title }}
            title={
              isFree
                ? "Free — 100% off while listed"
                : `You pay ${discountFactor(deal.discount)} of list${providersTitle(deal)}`
            }
          >
            {isFree ? (
              <span className="text-[clamp(1.9rem,5.2vw,4.6rem)]">FREE</span>
            ) : (
              <>
                <span className="text-[clamp(1.9rem,5.2vw,4.6rem)] tabular-nums">
                  {multiRate ? <span className="text-[0.4em] align-middle">UP TO </span> : null}
                  {subsidyPct(deal.discount)}
                </span>{" "}
                <span className="text-[clamp(1rem,2.4vw,2.2rem)]">OFF</span>
              </>
            )}
          </div>
          {live && deal.stats ? (
            <div className="mt-2">
              <div
                className="font-[family-name:var(--font-deals-display)] text-[clamp(1.2rem,2.6vw,2.4rem)] leading-none tabular-nums"
                style={{ color: theme.title }}
              >
                {usdGrouped(deal.stats.saved)}
              </div>
              <div
                className="mt-1 font-[family-name:var(--font-deals-mono)] text-[10px] font-semibold uppercase tracking-[0.1em] sm:text-[11px]"
                style={{ color: theme.meta }}
              >
                saved · {tokens(deal.stats.tokens)} tokens
                {!isFree && <> · you pay {discountFactor(deal.discount)}</>}
              </div>
            </div>
          ) : (
            <div
              className="mt-2 font-[family-name:var(--font-deals-mono)] text-[11px] font-semibold uppercase tracking-[0.08em] sm:text-xs"
              style={{ color: theme.meta }}
            >
              {isFree ? "100% off while listed" : <>you pay {discountFactor(deal.discount)}</>}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const bandClass = "group block w-full transition-[filter] duration-150";
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${deal.model} — ${isFree ? "free" : `${subsidyPct(deal.discount)} off`} — open on ZenMux`}
        className={bandClass + " hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"}
        style={{ backgroundColor: theme.bg }}
      >
        {body}
      </a>
    );
  }
  return (
    <div className={bandClass} style={{ backgroundColor: theme.bg }}>
      {body}
    </div>
  );
}

/* ── Ended strip: desaturated archive row ─────────────────────────────────── */

function EndedStrip({ deal }: { deal: DealSeries }) {
  const href = dealHref(deal.slug, deal.delisted);
  const inner = (
    <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-4 sm:px-8">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/90 p-1 grayscale">
        <VendorGlyph vendor={deal.vendor} alt={deal.vendorName} className="size-full" />
      </span>
      <span className="min-w-0 font-[family-name:var(--font-deals-display)] text-base uppercase leading-none tracking-tight text-white/70 sm:text-xl">
        {deal.model}
      </span>
      <span className="font-[family-name:var(--font-deals-mono)] text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
        {deal.dealType === "free" ? "free" : percentOff(deal.discount)} ·{" "}
        {shortDate(deal.startDate)} — {deal.endDate ? shortDate(deal.endDate) : "?"}
        {deal.delisted ? " · delisted" : ""}
      </span>
      <span className="ml-auto text-right font-[family-name:var(--font-deals-mono)] text-xs font-bold uppercase tabular-nums tracking-[0.08em] text-white/70">
        {deal.stats ? usdGrouped(deal.stats.saved) : "—"}{" "}
        <span className="font-semibold text-white/40">saved</span>
      </span>
    </div>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${deal.model} — ended deal — open on ZenMux`}
        className="block bg-[#1c1c1e] transition-colors hover:bg-[#28282b]"
      >
        {inner}
      </a>
    );
  }
  return <div className="bg-[#1c1c1e]">{inner}</div>;
}

/* ── Shared chrome ────────────────────────────────────────────────────────── */

function SectionStrip({
  title,
  sub,
  right,
}: {
  title: string;
  sub: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="border-y-[3px] border-[#0a0a0b] bg-[#0a0a0b]">
      <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-end justify-between gap-3 px-4 py-5 sm:px-8">
        <div>
          <h2 className="font-[family-name:var(--font-deals-display)] text-xl uppercase leading-none tracking-tight text-white sm:text-3xl">
            {title}
          </h2>
          <p className="mt-1.5 font-[family-name:var(--font-deals-mono)] text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
            {sub}
          </p>
        </div>
        {right}
      </div>
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
    <div className="flex items-center border border-white/30" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={
            "min-h-8 cursor-pointer px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors sm:px-3 " +
            (value === option.key
              ? "bg-white text-[#0a0a0b]"
              : "text-white/70 hover:bg-white/15 hover:text-white")
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
    <div style={{ backgroundColor: PANEL.amber.bg }} className="border-b-[3px] border-[#0a0a0b]">
      <div
        className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-8"
        style={{ color: PANEL.amber.ink }}
      >
        <div className="flex items-start gap-2 font-[family-name:var(--font-deals-mono)] text-[11px] font-semibold uppercase tracking-[0.06em]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <div>
            <span className="font-bold">{message}</span>
            {lastSuccessAt && (
              <span className="ml-2 opacity-75">
                last success {formatStamp(lastSuccessAt)} {localZone()}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="cursor-pointer border border-current px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {retrying ? "Retrying…" : "Retry"}
        </button>
      </div>
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ backgroundColor: PANEL.red.bg }} className="border-b-[3px] border-[#0a0a0b]">
      <div
        className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-3 px-4 py-8 sm:px-8"
        style={{ color: PANEL.red.ink }}
      >
        <div>
          <div className="font-[family-name:var(--font-deals-display)] text-2xl uppercase leading-none tracking-tight sm:text-4xl">
            Token deals unavailable
          </div>
          <div className="mt-2 font-[family-name:var(--font-deals-mono)] text-[11px] font-semibold uppercase tracking-[0.08em] opacity-80">
            {message}
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer border-2 border-current px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-opacity hover:opacity-70"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-[#1c1c1e] px-4 py-16 text-center">
      <div className="font-[family-name:var(--font-deals-display)] text-2xl uppercase tracking-tight text-white">
        No deals running right now
      </div>
      <p className="mt-2 font-[family-name:var(--font-deals-mono)] text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50">
        History (if any) stays archived below.
      </p>
    </div>
  );
}

function FinePrint({ data }: { data: TokenDealsPayload }) {
  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-8">
      <p className="font-[family-name:var(--font-deals-mono)] text-[10px] font-semibold uppercase leading-relaxed tracking-[0.08em] text-white/40">
        {data.live ? (
          <>
            Live data · updated {formatStamp(data.generatedAt)} {localZone()} · window{" "}
            {data.from.slice(0, 10)} → {formatStamp(data.to)} {localZone()} · refreshes every{" "}
            {Math.round(data.refreshIntervalSeconds / 60)}m
            {data.stale ? " · showing last successful aggregation (stale)" : ""}
          </>
        ) : (
          <>Cached deal facts shown · live billing aggregation unavailable</>
        )}{" "}
        · SAVED = billed discount amounts on pay-as-you-go traffic + list price × (1 − discount)
        on subscription traffic · free models count their full list price
      </p>
    </div>
  );
}

/* ── Skeleton: pulsing dark bands ─────────────────────────────────────────── */

function BoardSkeleton() {
  return (
    <div role="status" aria-label="Loading the discount board">
      <span className="sr-only">Loading the discount board</span>
      <div className="border-b-[3px] border-[#0a0a0b] bg-[#12241a] px-4 py-14 sm:px-8">
        <div className="mx-auto w-full max-w-[1800px]">
          <div className="h-3 w-64 animate-pulse bg-white/15" />
          <div className="mt-5 h-24 w-[min(36rem,90%)] animate-pulse bg-white/15 sm:h-32" />
          <div className="mt-5 h-3 w-96 max-w-full animate-pulse bg-white/10" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-[3px] bg-[#0a0a0b] lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse bg-[#1c1c1e]" />
        ))}
      </div>
      <div className="mt-[3px] flex flex-col gap-[3px]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse bg-[#1c1c1e]" />
        ))}
      </div>
    </div>
  );
}
