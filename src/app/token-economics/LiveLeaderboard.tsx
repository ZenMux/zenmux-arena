"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { AlertTriangle, ArrowUpRight, RefreshCw } from "lucide-react";
import {
  DEFAULT_LIVE_RANGE,
  DEFAULT_LIVE_REFRESH_INTERVAL_SECONDS,
  LIVE_RANGE_OPTIONS,
  type LiveAnchorSeries,
  type LiveMetricKey,
  type LiveModelSeries,
  type LiveRangeKey,
  type LiveTokenEconomicsPayload,
  type LiveUsagePoint,
  type LiveYAxisKey,
} from "@research/token-economics/live-config";
import { logoPath, tokens, usd, PANEL_SCROLLBAR } from "./lib";
import { VendorGlyph } from "./components";
import { LiveSkeletonBoard, LiveSkeletonStyles } from "./LiveSkeletonChart";
import { useElementHeight } from "./useElementHeight";

const LIVE_COLORS = [
  "#4f6ef7",
  "#ec4899",
  "#10b981",
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
const REFRESH_SETTLE_MS = 750;

const METRIC_OPTIONS = [
  { key: "live", label: "LIVE", title: "Real-time token usage per bucket" },
  { key: "cumulative", label: "TOTAL", title: "Cumulative token usage from the selected window start" },
] as const satisfies { key: LiveMetricKey; label: string; title: string }[];

const Y_AXIS_OPTIONS = [
  { key: "tokens", label: "TOKENS", title: "Plot token usage on the Y axis" },
  { key: "cost", label: "COST", title: "Plot billed cost from bill_amount on the Y axis" },
] as const satisfies { key: LiveYAxisKey; label: string; title: string }[];

function modelColor(index: number): string {
  return LIVE_COLORS[index % LIVE_COLORS.length];
}

function modelDash(index: number): string {
  return LINE_DASHES[Math.floor(index / LIVE_COLORS.length) % LINE_DASHES.length];
}

function compact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 10e9 ? 1 : 2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function compactUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return usd(n);
}

function preciseUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(6).replace(/\.?0+$/, "")}`;
}

function precisePerM(n: number): string {
  return `${preciseUsd(n)}/M`;
}

function discount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `x${n.toFixed(3).replace(/\.?0+$/, "")}`;
}

function formatAxisValue(n: number, axis: LiveYAxisKey): string {
  return axis === "cost" ? compactUsd(n) : tokens(n);
}

function compactAxisTick(n: number, axis: LiveYAxisKey): string {
  return axis === "cost" ? compactUsd(n) : compact(n);
}

function requests(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M req`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K req`;
  return `${Math.round(n)} req`;
}

function formatTick(iso: string, bucketSeconds: number): string {
  const d = new Date(iso);
  if (bucketSeconds >= 86400) {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(d);
  }
  if (bucketSeconds >= 3600) {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).format(d);
  }
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);
}

function addBucketSecondsIso(iso: string, bucketSeconds: number): string {
  return new Date(new Date(iso).getTime() + bucketSeconds * 1000).toISOString();
}

function formatBucketEndTick(iso: string, bucketSeconds: number): string {
  return formatTick(addBucketSecondsIso(iso, bucketSeconds), bucketSeconds);
}

function formatBucketInterval(iso: string, bucketSeconds: number): string {
  return `[${formatTick(iso, bucketSeconds)}, ${formatBucketEndTick(iso, bucketSeconds)})`;
}

function formatDateTimeTick(iso: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("month")} ${value("day")} ${value("hour")}:${value("minute")}`;
}

function formatRangeTick(iso: string, bucketSeconds: number, includeDate: boolean): string {
  return includeDate ? formatDateTimeTick(iso) : formatTick(iso, bucketSeconds);
}

function formatChartHoverInterval(
  points: LiveUsagePoint[],
  index: number,
  bucketSeconds: number,
  metric: LiveMetricKey,
): string {
  const point = points[index];
  if (!point) return "";
  if (metric === "live") return formatBucketInterval(point.t, bucketSeconds);
  const start = points[0]?.t ?? point.t;
  const end = addBucketSecondsIso(point.t, bucketSeconds);
  const includeDate = start.slice(0, 10) !== end.slice(0, 10);
  return `[${formatRangeTick(start, bucketSeconds, includeDate)}, ${formatRangeTick(end, bucketSeconds, includeDate)})`;
}

function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(iso));
}

function formatDuration(seconds: number): string {
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

function nextAlignedRefreshDelayMs(intervalSeconds: number): number {
  const intervalMs = Math.max(1, intervalSeconds) * 1000;
  const untilBoundary = intervalMs - (Date.now() % intervalMs);
  return untilBoundary + REFRESH_SETTLE_MS;
}

function tickIndices(length: number, desired = 6): number[] {
  if (length <= 1) return [0];
  const out = new Set<number>();
  for (let i = 0; i < desired; i++) {
    out.add(Math.round((i * (length - 1)) / (desired - 1)));
  }
  return [...out].sort((a, b) => a - b);
}

function pathForValues(values: number[], maxY: number, box: ChartBox): string {
  if (values.length === 0) return "";
  const x = (i: number) =>
    box.left + (values.length === 1 ? 0 : (i / (values.length - 1)) * box.plotW);
  const y = (v: number) => box.top + (1 - v / maxY) * box.plotH;
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`)
    .join(" ");
}

function pointValue(point: LiveUsagePoint, axis: LiveYAxisKey): number {
  return axis === "cost" ? point.cost : point.tokens;
}

function valuesForModel(
  model: LiveModelSeries,
  metric: LiveMetricKey,
  axis: LiveYAxisKey,
): number[] {
  if (metric === "live") return model.points.map((p) => pointValue(p, axis));
  let total = 0;
  return model.points.map((p) => {
    total += pointValue(p, axis);
    return total;
  });
}

function metricValue(
  model: LiveModelSeries,
  metric: LiveMetricKey,
  axis: LiveYAxisKey,
): number {
  if (axis === "cost") return metric === "live" ? model.latestCost : model.totalCost;
  return metric === "live" ? model.latestTokens : model.totalTokens;
}

function anchorMetricValue(
  anchor: LiveAnchorSeries,
  metric: LiveMetricKey,
  axis: LiveYAxisKey,
): number {
  if (axis === "cost") return metric === "live" ? anchor.peakCost : anchor.totalCost;
  return metric === "live" ? anchor.peakTokens : anchor.totalTokens;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

interface ChartBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  plotW: number;
  plotH: number;
}

interface HoverTarget {
  index: number;
}

const CHART: ChartBox = {
  left: 74,
  right: 194,
  top: 16,
  bottom: 48,
  width: 1500,
  height: 560,
  plotW: 1500 - 74 - 194,
  plotH: 560 - 16 - 48,
};

async function fetchLivePayload(
  range: LiveRangeKey,
  signal?: AbortSignal,
): Promise<LiveTokenEconomicsPayload> {
  const res = await fetch(`/api/token-economics/live?range=${range}`, {
    cache: "no-store",
    signal,
  });
  const json = (await res.json()) as LiveTokenEconomicsPayload | { error?: string };
  if (!res.ok) throw new Error("error" in json && json.error ? json.error : "Live usage failed");
  return json as LiveTokenEconomicsPayload;
}

export function LiveLeaderboard() {
  const [range, setRange] = useState<LiveRangeKey>(DEFAULT_LIVE_RANGE);
  const [metric, setMetric] = useState<LiveMetricKey>("cumulative");
  const [axis, setAxis] = useState<LiveYAxisKey>("tokens");
  const [data, setData] = useState<LiveTokenEconomicsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const json = await fetchLivePayload(range, signal);
      setData(json);
      setError(null);
      setLoading(false);
    },
    [range],
  );

  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    let timeoutId: number | null = null;
    let refreshIntervalSeconds = DEFAULT_LIVE_REFRESH_INTERVAL_SECONDS;

    const clearTimer = () => {
      if (timeoutId == null) return;
      window.clearTimeout(timeoutId);
      timeoutId = null;
    };

    const scheduleNext = () => {
      if (!live) return;
      clearTimer();
      timeoutId = window.setTimeout(() => {
        void run();
      }, nextAlignedRefreshDelayMs(refreshIntervalSeconds));
    };

    async function run(signal?: AbortSignal) {
      clearTimer();
      try {
        const json = await fetchLivePayload(range, signal);
        if (!live) return;
        refreshIntervalSeconds =
          json.refreshIntervalSeconds || DEFAULT_LIVE_REFRESH_INTERVAL_SECONDS;
        setData(json);
        setError(null);
        setLoading(false);
        scheduleNext();
      } catch (err) {
        if (!live || signal?.aborted) return;
        setError(err instanceof Error ? err.message : "Live usage failed");
        setLoading(false);
        scheduleNext();
      }
    }
    void run(controller.signal);
    return () => {
      live = false;
      controller.abort();
      clearTimer();
    };
  }, [range]);

  return (
    <section className="space-y-7">
      <div className="grid gap-3 border border-[#141414] bg-[#fbf9f4] px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#6f6a5f]">
            Anchor-normalized pricing experiment
          </p>
          <h1 className="mt-1 max-w-4xl text-xl font-bold uppercase leading-tight tracking-[0.06em] text-[#141414] sm:text-2xl">
            Welcome to the DeepSeek Kill-Line Challenge: what happens when these
            models are priced like DeepSeek?
          </h1>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-2 text-[10px] font-bold sm:min-w-[260px] sm:grid-cols-2 lg:grid-cols-3">
          {(data?.anchors ?? []).map((anchor) => (
            <div key={anchor.id} className="border border-[#141414] bg-[#f4f1ea] px-2.5 py-2">
              <div className="uppercase tracking-[0.12em] text-[#6f6a5f]">{anchor.label}</div>
              <div className="mt-1 tabular-nums text-[#141414]">
                IN {precisePerM(anchor.price.input)}
              </div>
              <div className="tabular-nums text-[#141414]">
                OUT {precisePerM(anchor.price.output)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            label="Usage view"
            options={METRIC_OPTIONS}
            value={metric}
            onChange={setMetric}
          />
          <SegmentedControl
            label="Y axis"
            options={Y_AXIS_OPTIONS}
            value={axis}
            onChange={setAxis}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {data && (
            <div className="hidden text-right text-[10px] font-bold tracking-[0.02em] text-[#6f6a5f] lg:block">
              <span className="text-[#141414]">{data.bucket}</span> buckets ·{" "}
              <span className="text-[#141414]">{formatDuration(data.refreshIntervalSeconds)}</span>{" "}
              refresh · <span className="text-[#141414]">{formatTick(data.from, data.bucketSeconds)}</span>{" "}
              → <span className="text-[#141414]">{formatStamp(data.to)}</span> UTC ·{" "}
              refreshed{" "}
              <span className="text-[#141414]">{formatStamp(data.generatedAt)}</span> UTC
            </div>
          )}
          <div
            className="flex items-center gap-0 border border-[#141414] bg-[#fbf9f4] p-1"
            aria-label="Time range"
          >
            {LIVE_RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  setRange(option.key);
                }}
                className={
                  "min-h-8 cursor-pointer border px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors " +
                  (range === option.key
                    ? "border-[#141414] bg-[#141414] text-[#f4f1ea]"
                    : "border-transparent bg-[#fbf9f4] hover:border-[#141414] hover:bg-[#ece8dd]")
                }
                title={
                  option.key === "all"
                    ? data
                      ? `Since ${formatStamp(data.from)} UTC`
                      : "Since the configured live start"
                    : "Trailing 72 hours, clipped to the configured start"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              load().catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Live usage failed");
                setLoading(false);
              });
            }}
            disabled={loading}
            className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 border border-[#141414] bg-[#fbf9f4] px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors hover:bg-[#141414] hover:text-[#f4f1ea] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={"size-3 " + (loading ? "animate-spin" : "")} />
            Refresh
          </button>
        </div>
      </div>

      {error && <ErrorPanel message={error} />}

      {!data && loading ? (
        <LiveSkeleton />
      ) : data ? (
        <div className="space-y-9">
          {data.anchors.map((anchor) => (
            <AnchorBoard
              key={anchor.id}
              anchor={anchor}
              bucket={data.bucket}
              bucketSeconds={data.bucketSeconds}
              metric={metric}
              axis={axis}
            />
          ))}
        </div>
      ) : null}
    </section>
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
    <div
      className="flex items-center gap-0 border border-[#141414] bg-[#fbf9f4] p-1"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={
            "min-h-8 cursor-pointer border px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors " +
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

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 border border-[#cf3636] bg-[#fff6f2] px-3 py-2 text-[11px] text-[#cf3636]">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <div>
        <div className="font-bold uppercase tracking-[0.12em]">Live usage unavailable</div>
        <div className="mt-0.5 text-[#6f6a5f]">{message}</div>
      </div>
    </div>
  );
}

function LiveSkeleton() {
  return (
    <div className="space-y-9" role="status" aria-label="Loading live usage charts">
      <LiveSkeletonStyles />
      <span className="sr-only">Loading live usage charts</span>
      <LiveSkeletonBoard variant="primary" />
      <LiveSkeletonBoard variant="secondary" />
    </div>
  );
}

function AnchorBoard({
  anchor,
  bucket,
  bucketSeconds,
  metric,
  axis,
}: {
  anchor: LiveAnchorSeries;
  bucket: string;
  bucketSeconds: number;
  metric: LiveMetricKey;
  axis: LiveYAxisKey;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [chartRef, chartHeight] = useElementHeight<HTMLDivElement>();
  const visible = anchor.models.filter((m) => !hidden.has(m.slug));
  const leader = [...anchor.models].sort(
    (a, b) => metricValue(b, metric, axis) - metricValue(a, metric, axis),
  )[0] ?? null;

  const toggle = (slug: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  return (
    <section className="space-y-2 bg-[#fbf9f4]">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-base font-bold uppercase leading-none tracking-[0.13em] sm:text-lg">
            {anchor.label} {axis === "cost" ? "Billed Cost" : "Token Usage"}
          </h2>
          <div className="mt-1 text-[10px] font-bold tracking-[0.02em] text-[#6f6a5f]">
            {anchor.models.length} models · {bucket} buckets · {tokens(anchor.totalTokens)} tokens ·{" "}
            {compactUsd(anchor.totalCost)} billed · {requests(anchor.totalRequests)}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-x-5 text-right">
          <MiniStat
            label={metric === "live" ? `Peak ${axis === "cost" ? "Cost" : "Bucket"}` : "Cumulative"}
            value={formatAxisValue(anchorMetricValue(anchor, metric, axis), axis)}
          />
          <MiniStat label="Leader" value={leader?.model ?? "—"} />
          <MiniStat
            label={axis === "cost" ? "Leader Bill" : "Leader Tokens"}
            value={leader ? formatAxisValue(metricValue(leader, metric, axis), axis) : "—"}
          />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div ref={chartRef} className="min-w-0 self-start">
          <TimeSeriesChart
            anchor={anchor}
            visible={visible}
            bucketSeconds={bucketSeconds}
            metric={metric}
            axis={axis}
          />
        </div>
        <PriceAdjustmentPanel anchor={anchor} chartHeight={chartHeight} />
      </div>
      <SeriesToggles models={anchor.models} hidden={hidden} onToggle={toggle} />
    </section>
  );
}

function PriceAdjustmentPanel({
  anchor,
  chartHeight,
}: {
  anchor: LiveAnchorSeries;
  chartHeight: number | null;
}) {
  const anchorPrice = anchor.price;
  const ledgerModels = [...anchor.models].sort((a, b) => {
    const ad = a.isAnchor ? 0 : 1;
    const bd = b.isAnchor ? 0 : 1;
    return ad - bd || a.model.localeCompare(b.model);
  });
  const targetBasket = anchor.targetBlended;

  return (
    <aside
      className="box-border flex min-h-0 flex-col overflow-hidden border border-[#141414] bg-[#f4f1ea] px-3 py-2.5 xl:h-[var(--chart-panel-height)] xl:max-h-[var(--chart-panel-height)]"
      style={chartHeight ? ({ "--chart-panel-height": `${chartHeight}px` } as CSSProperties) : undefined}
    >
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#141414]">
            Price Reset Ledger
          </h3>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#6f6a5f]">
            Target basket {preciseUsd(targetBasket)}
          </p>
        </div>
        <div className="shrink-0 text-right text-[9px] font-bold uppercase tracking-[0.08em] text-[#6f6a5f]">
          <div>Anchor</div>
          <div className="mt-0.5 tabular-nums text-[#141414]">
            {precisePerM(anchorPrice.input)} in
          </div>
          <div className="tabular-nums text-[#141414]">
            {precisePerM(anchorPrice.output)} out
          </div>
        </div>
      </div>

      <div className={`mt-2 min-h-0 flex-1 overflow-y-auto pr-1 ${PANEL_SCROLLBAR}`}>
        <div className="grid gap-1.5">
          {ledgerModels.map((m) => (
            <PriceLedgerRow key={m.slug} model={m} anchorPrice={anchorPrice} />
          ))}
        </div>
      </div>
    </aside>
  );
}

function PriceLedgerRow({
  model,
  anchorPrice,
}: {
  model: LiveModelSeries;
  anchorPrice: { input: number; output: number };
}) {
  const beforeInput = model.isAnchor ? anchorPrice.input : model.origInput;
  const afterInput = model.isAnchor ? anchorPrice.input : model.newInput;
  const beforeOutput = model.isAnchor ? anchorPrice.output : model.origOutput;
  const afterOutput = model.isAnchor ? anchorPrice.output : model.newOutput;

  return (
    <div
      className="grid gap-1 border border-[#141414]/35 bg-[#fbf9f4] px-2 py-1.5 text-[9px]"
      title={`${model.model}: input ${precisePerM(beforeInput)} -> ${precisePerM(afterInput)}, output ${precisePerM(beforeOutput)} -> ${precisePerM(afterOutput)}, basket ${preciseUsd(model.origBlended)} -> ${preciseUsd(model.newBlended)}`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="flex size-4 shrink-0 items-center justify-center border border-[#141414]/35 bg-white p-0.5">
            <VendorGlyph vendor={model.vendor} alt={model.vendorName} className="size-full" />
          </span>
          <span className="truncate text-[10px] font-bold text-[#141414]">{model.model}</span>
        </span>
        <span className="shrink-0 font-bold tabular-nums text-[#1a8a4a]">
          {model.isAnchor ? "ANCHOR" : discount(model.discountFactor)}
        </span>
      </div>
      <PriceMove label="Input" before={precisePerM(beforeInput)} after={precisePerM(afterInput)} />
      <PriceMove label="Output" before={precisePerM(beforeOutput)} after={precisePerM(afterOutput)} />
      <div className="flex min-w-0 items-end justify-between gap-2">
        <div className="min-w-0 flex-1">
          <PriceMove
            label="Basket"
            before={preciseUsd(model.origBlended)}
            after={preciseUsd(model.newBlended)}
          />
        </div>
        <a
          href={`https://zenmux.ai/${model.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Try ${model.model} on ZenMux`}
          className="inline-flex min-h-6 shrink-0 items-center gap-0.5 whitespace-nowrap border border-[#141414]/70 bg-transparent px-1.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#141414] transition-colors hover:border-[#141414] hover:bg-[#141414] hover:text-[#f4f1ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141414]"
        >
          Try it now
          <ArrowUpRight className="size-2.5" />
        </a>
      </div>
    </div>
  );
}

function PriceMove({
  label,
  before,
  after,
}: {
  label: string;
  before: string;
  after: string;
}) {
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-baseline gap-2">
      <span className="font-bold uppercase tracking-[0.08em] text-[#6f6a5f]">{label}</span>
      <span className="min-w-0 whitespace-nowrap font-bold tabular-nums text-[#141414]">
        {before} <span className="text-[#6f6a5f]">-&gt;</span>{" "}
        <span className="text-[#1a8a4a]">{after}</span>
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#6f6a5f]">
        {label}
      </div>
      <div className="mt-0.5 max-w-[12rem] truncate text-[12px] font-bold tabular-nums text-[#141414]">
        {value}
      </div>
    </div>
  );
}

function SeriesToggles({
  models,
  hidden,
  onToggle,
}: {
  models: LiveModelSeries[];
  hidden: Set<string>;
  onToggle: (slug: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto px-1 pb-1 pt-1">
      {models.map((m, i) => {
        const off = hidden.has(m.slug);
        return (
          <button
            key={m.slug}
            type="button"
            onClick={() => onToggle(m.slug)}
            className={
              "grid min-h-[58px] min-w-[148px] cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 border px-2 py-1.5 text-left transition-colors " +
              (off
                ? "border-[#141414]/25 bg-[#f4f1ea] text-[#6f6a5f] opacity-45"
                : "border-[#141414]/55 bg-[#fbf9f4] text-[#141414] hover:border-[#141414] hover:bg-[#ece8dd]")
            }
            title={`${m.model}: ${tokens(m.totalTokens)} in selected window`}
          >
            <span className="relative row-span-2 size-8 border border-[#141414]/45 bg-white p-1">
              <VendorGlyph vendor={m.vendor} alt={m.vendorName} className="size-full" />
              <span
                className="absolute -bottom-1 -right-1 size-2.5 border border-[#141414]"
                style={{ backgroundColor: off ? "transparent" : modelColor(i) }}
                aria-hidden
              />
            </span>
            <span className="truncate text-[10px] font-bold leading-tight">
              {m.model}
            </span>
            <span className="truncate text-[9px] font-bold uppercase tracking-[0.06em] text-[#6f6a5f]">
              {tokens(m.totalTokens)} · {compactUsd(m.totalCost)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TimeSeriesChart({
  anchor,
  visible,
  bucketSeconds,
  metric,
  axis,
}: {
  anchor: LiveAnchorSeries;
  visible: LiveModelSeries[];
  bucketSeconds: number;
  metric: LiveMetricKey;
  axis: LiveYAxisKey;
}) {
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const points = anchor.models[0]?.points ?? [];
  const plotted = useMemo(
    () => visible.map((m) => ({ m, values: valuesForModel(m, metric, axis) })),
    [visible, metric, axis],
  );
  const maxRaw = Math.max(1, ...plotted.flatMap((s) => s.values));
  const maxY = maxRaw * 1.08;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => r * maxY);
  const xTicks = tickIndices(points.length);
  const indexBySlug = new Map(anchor.models.map((m, i) => [m.slug, i]));
  const lastIndex = Math.max(0, points.length - 1);
  const xForIndex = (i: number) =>
    CHART.left + (points.length <= 1 ? 0 : (i / (points.length - 1)) * CHART.plotW);
  const yForValue = useCallback(
    (v: number) => CHART.top + (1 - v / maxY) * CHART.plotH,
    [maxY],
  );

  const endLabels = useMemo(() => {
    const minY = CHART.top + 14;
    const maxLabelY = CHART.top + CHART.plotH - 14;
    const rows = plotted
      .map((s) => ({
        slug: s.m.slug,
        model: s.m,
        value: s.values[lastIndex] ?? 0,
        y: yForValue(s.values[lastIndex] ?? 0),
      }))
      .sort((a, b) => a.y - b.y);
    const placed = rows.map((row) => ({
      ...row,
      labelY: clamp(row.y, minY, maxLabelY),
    }));
    for (let i = 1; i < placed.length; i++) {
      placed[i].labelY = Math.max(placed[i].labelY, placed[i - 1].labelY + 22);
    }
    const overflow = (placed[placed.length - 1]?.labelY ?? maxLabelY) - maxLabelY;
    if (overflow > 0) {
      for (const row of placed) row.labelY -= overflow;
      for (let i = placed.length - 2; i >= 0; i--) {
        placed[i].labelY = Math.min(placed[i].labelY, placed[i + 1].labelY - 22);
      }
    }
    return placed.map((row) => ({ ...row, labelY: clamp(row.labelY, minY, maxLabelY) }));
  }, [plotted, lastIndex, yForValue]);

  const summary = useMemo(() => {
    const top = anchor.models[0];
    return top
      ? `${anchor.label}: top model ${top.model} used ${formatAxisValue(metricValue(top, metric, axis), axis)} in this window.`
      : `${anchor.label}: no model ${axis === "cost" ? "bill amount" : "usage"} in this window.`;
  }, [anchor, axis, metric]);

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * CHART.width;
    const ratio = clamp((svgX - CHART.left) / CHART.plotW, 0, 1);
    const index = Math.round(ratio * (points.length - 1));
    setHover({ index });
  };

  const hoverIndex = hover?.index ?? null;
  const hoverRows =
    hoverIndex == null
      ? []
      : plotted
          .map((s) => ({
            model: s.m,
            value: s.values[hoverIndex] ?? 0,
            index: indexBySlug.get(s.m.slug) ?? 0,
          }))
          .sort((a, b) => b.value - a.value);
  const hoveredPoints =
    hoverIndex == null
      ? []
      : plotted.map((series) => {
          const modelIndex = indexBySlug.get(series.m.slug) ?? 0;
          return {
            slug: series.m.slug,
            x: xForIndex(hoverIndex),
            y: yForValue(series.values[hoverIndex] ?? 0),
            color: modelColor(modelIndex),
          };
        });
  const hoverInterval =
    hoverIndex == null
      ? ""
      : formatChartHoverInterval(points, hoverIndex, bucketSeconds, metric);
  const tooltipW = hoverInterval.length > 44 ? 360 : 264;
  const hoverX = hoverIndex == null ? 0 : xForIndex(hoverIndex);
  const tooltipX =
    hoverX > CHART.left + CHART.plotW * 0.62 ? hoverX - tooltipW - 14 : hoverX + 14;
  const tooltipH = 30 + hoverRows.length * 16;
  const hoverMetricLabel = metric === "live" ? "LIVE" : "TOTAL";
  const hoverAxisLabel = axis === "cost" ? "COST" : "TOKENS";

  return (
    <div className="bg-[#fbf9f4]">
      <div className="mb-1 flex items-center justify-between gap-2 px-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#6f6a5f]">
        <span>{axis === "cost" ? "Y Axis · Billed Cost" : "Y Axis · Tokens"}</span>
        <span>{metric === "live" ? "Latest Bucket" : "Cumulative Total"}</span>
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
              @keyframes te-live-pulse {
                0% { opacity: 0.95; r: 5px; }
                70% { opacity: 0; r: 17px; }
                100% { opacity: 0; r: 17px; }
              }
              .te-live-pulse { animation: te-live-pulse 1.35s ease-out infinite; }
              @media (prefers-reduced-motion: reduce) {
                .te-live-pulse { animation: none; opacity: 0.28; }
              }
            `}
          </style>
          <rect
            x={CHART.left}
            y={CHART.top}
            width={CHART.plotW}
            height={CHART.plotH}
            fill="#fbf9f4"
          />

          {yTicks.map((tick) => {
            const y = CHART.top + (1 - tick / maxY) * CHART.plotH;
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
                  {compactAxisTick(tick, axis)}
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
                <text
                  x={x}
                  y={CHART.height - 16}
                  textAnchor="middle"
                  className="fill-[#6f6a5f] text-[10px] font-bold tabular-nums"
                >
                  {points[idx] ? formatBucketEndTick(points[idx].t, bucketSeconds) : ""}
                </text>
              </g>
            );
          })}

          {plotted.map(({ m, values }) => {
            const index = indexBySlug.get(m.slug) ?? 0;
            const path = pathForValues(values, maxY, CHART);
            const x = CHART.left + CHART.plotW;
            const y = yForValue(values[lastIndex] ?? 0);
            return (
              <g key={m.slug}>
                <path
                  d={path}
                  fill="none"
                  stroke={modelColor(index)}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={modelDash(index)}
                  vectorEffect="non-scaling-stroke"
                >
                  <title>
                    {m.model}: {formatAxisValue(metricValue(m, metric, axis), axis)} {metric === "live" ? "latest bucket" : "cumulative"}
                  </title>
                </path>
                <circle
                  className="te-live-pulse"
                  cx={x}
                  cy={y}
                  r="5"
                  fill="none"
                  stroke={modelColor(index)}
                  strokeWidth="2"
                >
                  <animate
                    attributeName="r"
                    values="5;17;17"
                    dur="1.35s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.95;0;0"
                    dur="1.35s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill={modelColor(index)}
                  stroke="#141414"
                  strokeWidth="1"
                />
              </g>
            );
          })}

          {endLabels.map((row) => {
            const index = indexBySlug.get(row.slug) ?? 0;
            const x = CHART.left + CHART.plotW;
            const logo = logoPath(row.model.vendor);
            return (
              <g key={`${row.slug}-end-label`}>
                <line
                  x1={x + 2}
                  x2={x + 12}
                  y1={row.y}
                  y2={row.labelY}
                  stroke={modelColor(index)}
                  strokeWidth="1"
                  strokeOpacity="0.55"
                />
                <rect
                  x={x + 12}
                  y={row.labelY - 11}
                  width="154"
                  height="22"
                  fill={modelColor(index)}
                  stroke="#141414"
                  strokeWidth="1"
                  rx="0"
                />
                <circle
                  cx={x + 23}
                  cy={row.labelY}
                  r="10"
                  fill="#fbf9f4"
                  stroke="#141414"
                  strokeWidth="1"
                />
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
                <text
                  x={x + 38}
                  y={row.labelY + 4}
                  className="fill-white text-[10px] font-bold tabular-nums"
                >
                  {formatAxisValue(row.value, axis)}
                </text>
              </g>
            );
          })}

          {hoverIndex != null && points[hoverIndex] && (
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
              {hoveredPoints.map((point) => (
                <g key={`${point.slug}-hover-point`}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="8"
                    fill="#fbf9f4"
                    stroke="#141414"
                    strokeWidth="2"
                  />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill={point.color}
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
                y={CHART.top + 29}
                className="fill-[#141414] text-[10px] font-bold uppercase tracking-[0.08em]"
              >
                {hoverInterval} UTC · {hoverMetricLabel} · {hoverAxisLabel}
              </text>
              {hoverRows.map((row, i) => (
                <g
                  key={row.model.slug}
                  transform={`translate(${tooltipX + 10} ${CHART.top + 49 + i * 16})`}
                >
                  <rect
                    x="0"
                    y="-8"
                    width="8"
                    height="8"
                    fill={modelColor(row.index)}
                    stroke="#141414"
                    strokeWidth="0.75"
                  />
                  <text
                    x="14"
                    y="0"
                    className="fill-[#141414] text-[9px] font-bold"
                  >
                    {row.model.model.length > 19
                      ? `${row.model.model.slice(0, 18)}…`
                      : row.model.model}
                  </text>
                  <text
                    x={tooltipW - 20}
                    y="0"
                    textAnchor="end"
                    className="fill-[#141414] text-[9px] font-bold tabular-nums"
                  >
                    {formatAxisValue(row.value, axis)}
                  </text>
                </g>
              ))}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
