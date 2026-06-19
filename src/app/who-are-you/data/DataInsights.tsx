"use client";

// Chart-based insight cards for the Data Explorer — the *visual* layer that sits
// alongside the dense tables in <DataAggregate>. Everything here is hand-built
// from divs + Tailwind (the project ships no charting library on purpose — see
// research/lib/svg.ts for the same philosophy), so the charts inherit the exact
// badge palette and dark-mode behavior as the rest of the page.
//
// Five cards, each a pure function of the already-loaded GraphData (no new I/O):
//   1. ImitationBalanceCard — diverging bar: who is imitated (right, +) vs who
//        imitates others (left, −), per manufacturer, sorted by net.
//   2. ConfusionPairsCard   — ranked probability bars: the strongest directed
//        "X claims to be Y" confusions, with both vendor logos.
//   3. LanguageCompositionCard — 100% stacked bars: self / confusion / unknown /
//        refused per language.
//   4. LanguageFragilityCard — dumbbell/range: per-model self-ID swing (min→max)
//        across the 10 languages — how language-dependent a model's identity is.
//   5. AbstentionCard — stacked bars: unknown + refused share per manufacturer
//        (the "didn't answer" story, distinct from "answered wrong").
//
// Accessibility: every bar carries a visible value label AND an aria-label;
// each card opens with an sr-only one-liner stating its key insight; semantic
// meaning is never carried by color alone (direction, text, and logos back it).

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GraphData, VendorId } from "@research/lib/types";
import { pct } from "../studio/VendorOverview";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// Analytical buckets, not real brands — excluded from any "vendor vs vendor"
// computation. (`other` is the catch-all dynamic-vendor parent.)
const PSEUDO: ReadonlySet<VendorId> = new Set([
  "self",
  "unknown",
  "refused",
  "other",
]);

/** "anthropic/claude-haiku-4.5:anthropic" → "claude-haiku-4.5". */
function modelShortName(id: string): string {
  const afterSlash = id.includes("/") ? id.slice(id.indexOf("/") + 1) : id;
  const colon = afterSlash.lastIndexOf(":");
  return colon > 0 ? afterSlash.slice(0, colon) : afterSlash;
}

function logoPathFor(logo: string | undefined | null): string | null {
  return logo ? `/maker-logo/${encodeURIComponent(logo)}` : null;
}

/** Logo chip + vendor name, sharing the invert-in-light-mode trick used across
    the viewer (logos are dark glyphs → invert on light, keep as-is on dark). */
function VendorLabel({
  name,
  logo,
  className,
  logoSize = "size-4",
}: {
  name: string;
  logo: string | null;
  className?: string;
  logoSize?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          className={cn(logoSize, "shrink-0 object-contain invert dark:invert-0")}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <span className="truncate font-medium">{name}</span>
    </span>
  );
}

/** Build quick id→name / id→logoPath lookups once per graph. */
function vendorMeta(graph: GraphData) {
  const names = new Map<VendorId, string>();
  const logos = new Map<VendorId, string | null>();
  for (const v of graph.vendors) {
    names.set(v.id, v.name);
    logos.set(v.id, logoPathFor(v.logo));
  }
  return { names, logos };
}

/** Inverted palette band (HIGHER = WORSE) — for confusion/abstention bars where
    a big value is bad news. Mirrors the cuts in VendorOverview's rateBadgeStyle
    but with the green/red sense flipped. */
function confusionBarColor(rate: number): string {
  if (rate >= 0.1) return "bg-red-500 dark:bg-red-500/80";
  if (rate >= 0.05) return "bg-orange-500 dark:bg-orange-500/80";
  if (rate >= 0.02) return "bg-amber-500 dark:bg-amber-500/80";
  return "bg-emerald-500 dark:bg-emerald-500/80";
}

/** Solid band (HIGHER = BETTER) for the fragility range bar, keyed off the
    model's WORST-language self-rate. Same cuts as VendorOverview's
    rateBadgeStyle, but solid mid-tones with dark variants (the badge palette's
    -100/-900 tints are too faint for a thin range bar). */
function selfBandColor(rate: number): string {
  if (rate >= 0.95) return "bg-emerald-400/70 dark:bg-emerald-500/50";
  if (rate >= 0.8) return "bg-amber-400/70 dark:bg-amber-500/50";
  if (rate >= 0.5) return "bg-orange-400/70 dark:bg-orange-500/50";
  return "bg-red-400/70 dark:bg-red-500/50";
}

// ---------------------------------------------------------------------------
// 1. Imitation balance — diverging bar
// ---------------------------------------------------------------------------

interface BalanceRow {
  vendor: VendorId;
  name: string;
  logo: string | null;
  /** Cross-vendor occurrences where OTHERS claimed to be this vendor. */
  imitated: number;
  /** Cross-vendor occurrences where THIS vendor's models claimed someone else. */
  imitates: number;
  net: number;
}

function computeBalanceRows(graph: GraphData): BalanceRow[] {
  const { names, logos } = vendorMeta(graph);
  // Only manufacturers we actually tested have a meaningful *both* directions
  // (a phantom target like "Microsoft" can be imitated but never imitates,
  // since we never ran a Microsoft model). Restrict to tested vendors here;
  // the pairs chart below still surfaces phantom targets.
  const tested = new Set<VendorId>(graph.models.map((m) => m.vendor));

  const imitated = new Map<VendorId, number>();
  const imitates = new Map<VendorId, number>();
  for (const e of graph.edges) {
    if (e.from === e.to) continue;
    if (PSEUDO.has(e.from) || PSEUDO.has(e.to)) continue; // cross-vendor, both real
    imitates.set(e.from, (imitates.get(e.from) ?? 0) + e.count);
    imitated.set(e.to, (imitated.get(e.to) ?? 0) + e.count);
  }

  const rows: BalanceRow[] = [];
  for (const v of tested) {
    const inC = imitated.get(v) ?? 0;
    const outC = imitates.get(v) ?? 0;
    rows.push({
      vendor: v,
      name: names.get(v) ?? v,
      logo: logos.get(v) ?? null,
      imitated: inC,
      imitates: outC,
      net: inC - outC,
    });
  }
  rows.sort((a, b) => b.net - a.net);
  return rows;
}

function ImitationBalanceCard({ graph }: { graph: GraphData }) {
  const rows = useMemo(() => computeBalanceRows(graph), [graph]);
  // Symmetric scale so left/right widths are comparable across rows.
  const maxMag = Math.max(1, ...rows.map((r) => Math.max(r.imitated, r.imitates)));

  const topCreditor = rows[0];
  const topDebtor = rows[rows.length - 1];

  return (
    <Card className="py-0">
      <CardHeader className="px-5 py-3">
        <CardTitle className="text-base">Imitation balance</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Per manufacturer: how often other models{" "}
          <span className="font-medium text-emerald-700 dark:text-emerald-400">
            claim to be it
          </span>{" "}
          (right) vs how often its own models{" "}
          <span className="font-medium text-rose-700 dark:text-rose-400">
            claim to be someone else
          </span>{" "}
          (left). Sorted by net — identity creditors at the top, debtors at the
          bottom. Tested manufacturers only.
        </p>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0">
        {topCreditor && topDebtor && (
          <p className="sr-only">
            {topCreditor.name} is imitated most with a net imitation balance of{" "}
            {topCreditor.net}; {topDebtor.name} imitates others most with a net
            of {topDebtor.net}.
          </p>
        )}
        <div className="space-y-1.5">
          {rows.map((r) => {
            const leftPct = (r.imitates / maxMag) * 100;
            const rightPct = (r.imitated / maxMag) * 100;
            return (
              <div
                key={r.vendor}
                className="flex items-center gap-2 text-xs"
                aria-label={`${r.name}: imitated ${r.imitated} times, imitates others ${r.imitates} times, net ${r.net}`}
              >
                {/* Vendor label (fixed width so bars align) */}
                <div className="w-28 shrink-0 truncate sm:w-32">
                  <VendorLabel name={r.name} logo={r.logo} logoSize="size-4" />
                </div>
                {/* Diverging track: [ left half | center | right half ] */}
                <div className="flex flex-1 items-center">
                  <div className="flex flex-1 justify-end">
                    <div
                      className="h-4 rounded-l-sm bg-rose-400 transition-all duration-200 dark:bg-rose-500/70 motion-reduce:transition-none"
                      style={{ width: `${leftPct}%` }}
                    />
                  </div>
                  <div className="h-5 w-px shrink-0 bg-border" aria-hidden />
                  <div className="flex flex-1 justify-start">
                    <div
                      className="h-4 rounded-r-sm bg-emerald-500 transition-all duration-200 dark:bg-emerald-500/80 motion-reduce:transition-none"
                      style={{ width: `${rightPct}%` }}
                    />
                  </div>
                </div>
                {/* Net value */}
                <div
                  className={cn(
                    "w-14 shrink-0 text-right font-mono tabular-nums",
                    r.net > 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : r.net < 0
                        ? "text-rose-700 dark:text-rose-400"
                        : "text-muted-foreground",
                  )}
                >
                  {r.net > 0 ? "+" : ""}
                  {r.net.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
        {/* Micro-legend */}
        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="text-rose-700 dark:text-rose-400">imitates others ◀</span>
          <span className="text-border">│</span>
          <span className="text-emerald-700 dark:text-emerald-400">▶ imitated by others</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 2. Strongest confusion pairs — ranked probability bars
// ---------------------------------------------------------------------------

interface PairRow {
  key: string;
  fromName: string;
  fromLogo: string | null;
  toName: string;
  toLogo: string | null;
  probability: number;
  count: number;
  total: number;
}

function computePairRows(graph: GraphData, limit = 15): PairRow[] {
  const { names, logos } = vendorMeta(graph);
  return graph.edges
    .filter(
      (e) =>
        e.from !== e.to && !PSEUDO.has(e.from) && !PSEUDO.has(e.to),
    )
    .sort((a, b) => b.probability - a.probability)
    .slice(0, limit)
    .map((e) => ({
      key: `${e.from}->${e.to}`,
      fromName: names.get(e.from) ?? e.from,
      fromLogo: logos.get(e.from) ?? null,
      toName: names.get(e.to) ?? e.to,
      toLogo: logos.get(e.to) ?? null,
      probability: e.probability,
      count: e.count,
      total: e.total,
    }));
}

function ConfusionPairsCard({ graph }: { graph: GraphData }) {
  const rows = useMemo(() => computePairRows(graph), [graph]);
  const maxProb = Math.max(0.01, ...rows.map((r) => r.probability));

  return (
    <Card className="py-0">
      <CardHeader className="px-5 py-3">
        <CardTitle className="text-base">Strongest confusion pairs</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The most likely directed mistakes — when a manufacturer&apos;s models
          claim to be a <em>specific</em> other manufacturer. Bar length = how
          often (P across all answers for the source).
        </p>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0">
        {rows[0] && (
          <p className="sr-only">
            The strongest cross-vendor confusion is {rows[0].fromName} claiming
            to be {rows[0].toName} {pct(rows[0].probability)} of the time.
          </p>
        )}
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div
              key={r.key}
              className="flex items-center gap-2 text-xs"
              aria-label={`${r.fromName} claims to be ${r.toName} ${pct(r.probability)} of the time (${r.count} of ${r.total})`}
            >
              <div className="flex w-44 shrink-0 items-center gap-1 sm:w-52">
                <VendorLabel name={r.fromName} logo={r.fromLogo} className="min-w-0" />
                <span className="shrink-0 text-muted-foreground">→</span>
                <VendorLabel name={r.toName} logo={r.toLogo} className="min-w-0" />
              </div>
              <div className="h-4 flex-1 overflow-hidden rounded-sm bg-muted/40">
                <div
                  className={cn(
                    "h-full rounded-sm transition-all duration-200 motion-reduce:transition-none",
                    confusionBarColor(r.probability),
                  )}
                  style={{ width: `${(r.probability / maxProb) * 100}%` }}
                />
              </div>
              <div className="w-24 shrink-0 text-right">
                <span className="font-mono font-medium tabular-nums">
                  {pct(r.probability)}
                </span>
                <span className="ml-1 text-[10px] tabular-nums text-muted-foreground">
                  {r.count}/{r.total}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 3. Language composition — 100% stacked bars
// ---------------------------------------------------------------------------

interface CompRow {
  code: string;
  name: string;
  self: number;
  confusion: number;
  unknown: number;
  refused: number;
}

function computeCompRows(graph: GraphData): CompRow[] {
  const modelVendor = new Map(graph.models.map((m) => [m.id, m.vendor]));
  const langName = new Map(graph.languages.map((l) => [l.code, l.name]));

  // Weighted accumulation: each cell contributes distribution[k]·n to its lang.
  const acc = new Map<
    string,
    { self: number; confusion: number; unknown: number; refused: number; n: number }
  >();
  for (const c of graph.cells) {
    const trueV = modelVendor.get(c.modelId);
    const a =
      acc.get(c.langCode) ??
      { self: 0, confusion: 0, unknown: 0, refused: 0, n: 0 };
    for (const [k, p] of Object.entries(c.distribution)) {
      const w = (p ?? 0) * c.n;
      if (k === "self" || k === trueV) a.self += w;
      else if (k === "unknown") a.unknown += w;
      else if (k === "refused") a.refused += w;
      else a.confusion += w; // a different real vendor
    }
    a.n += c.n;
    acc.set(c.langCode, a);
  }

  const rows: CompRow[] = [];
  for (const [code, a] of acc) {
    const n = a.n || 1;
    rows.push({
      code,
      name: langName.get(code) ?? code,
      self: a.self / n,
      confusion: a.confusion / n,
      unknown: a.unknown / n,
      refused: a.refused / n,
    });
  }
  // Worst self-ID first — the gaps are the story.
  rows.sort((a, b) => a.self - b.self);
  return rows;
}

const COMP_SEGMENTS = [
  { key: "self", label: "Self-ID", color: "bg-emerald-500 dark:bg-emerald-500/80" },
  { key: "confusion", label: "Cross-vendor", color: "bg-rose-500 dark:bg-rose-500/80" },
  { key: "unknown", label: "Unknown", color: "bg-slate-400 dark:bg-slate-500/70" },
  { key: "refused", label: "Refused", color: "bg-amber-500 dark:bg-amber-500/70" },
] as const;

function LegendDots({
  items,
}: {
  items: ReadonlyArray<{ label: string; color: string }>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm", it.color)} aria-hidden />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function LanguageCompositionCard({ graph }: { graph: GraphData }) {
  const rows = useMemo(() => computeCompRows(graph), [graph]);

  return (
    <Card className="py-0">
      <CardHeader className="px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Answer composition by language</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              How the same &ldquo;Who are you?&rdquo; question splits into
              correct self-ID vs. confusion vs. abstention — per language,
              worst self-ID first.
            </p>
          </div>
          <LegendDots items={COMP_SEGMENTS} />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0">
        {rows[0] && rows[rows.length - 1] && (
          <p className="sr-only">
            Self-identification is lowest in {rows[0].name} at {pct(rows[0].self)}{" "}
            and highest in {rows[rows.length - 1].name} at{" "}
            {pct(rows[rows.length - 1].self)}.
          </p>
        )}
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div
              key={r.code}
              className="flex items-center gap-2 text-xs"
              aria-label={`${r.name}: self ${pct(r.self)}, cross-vendor ${pct(r.confusion)}, unknown ${pct(r.unknown)}, refused ${pct(r.refused)}`}
            >
              <div className="flex w-28 shrink-0 items-baseline gap-1.5 sm:w-32">
                <span className="font-mono text-muted-foreground">{r.code}</span>
                <span className="truncate font-medium">{r.name}</span>
              </div>
              <div className="flex h-5 flex-1 overflow-hidden rounded-sm">
                {COMP_SEGMENTS.map((seg) => {
                  const v = r[seg.key];
                  if (v <= 0) return null;
                  const w = v * 100;
                  return (
                    <div
                      key={seg.key}
                      className={cn(
                        "flex h-full items-center justify-center overflow-hidden transition-all duration-200 motion-reduce:transition-none",
                        seg.color,
                      )}
                      style={{ width: `${w}%` }}
                    >
                      {w >= 8 && (
                        <span className="px-0.5 text-[10px] font-medium tabular-nums text-white/95">
                          {Math.round(w)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-emerald-700 dark:text-emerald-400">
                {pct(r.self, 0)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 4. Language fragility — dumbbell / range
// ---------------------------------------------------------------------------

interface FragRow {
  modelId: string;
  label: string;
  min: number;
  max: number;
  mean: number;
  minLang: string;
  maxLang: string;
  range: number;
  /** True when self-ID is identical across all languages — the min/max language
      codes are then an arbitrary tie-break, so we render one dot, not a span. */
  flat: boolean;
}

/** Below this, a model's self-ID is effectively constant across languages and
    "worst/best language" would be a meaningless tie-break. */
const FLAT_EPS = 0.005;

function computeFragRows(graph: GraphData): FragRow[] {
  const byModel = new Map<string, { lang: string; sr: number }[]>();
  for (const c of graph.cells) {
    const list = byModel.get(c.modelId) ?? [];
    list.push({ lang: c.langCode, sr: c.selfRate });
    byModel.set(c.modelId, list);
  }

  const rows: FragRow[] = [];
  for (const [modelId, cells] of byModel) {
    if (cells.length === 0) continue;
    let min = cells[0],
      max = cells[0],
      sum = 0;
    for (const c of cells) {
      if (c.sr < min.sr) min = c;
      if (c.sr > max.sr) max = c;
      sum += c.sr;
    }
    const range = max.sr - min.sr;
    rows.push({
      modelId,
      label: modelShortName(modelId),
      min: min.sr,
      max: max.sr,
      mean: sum / cells.length,
      minLang: min.lang,
      maxLang: max.lang,
      range,
      flat: range < FLAT_EPS,
    });
  }
  // Widest swing first — the most language-fragile identities.
  rows.sort((a, b) => b.range - a.range);
  return rows;
}

function LanguageFragilityCard({ graph }: { graph: GraphData }) {
  const rows = useMemo(() => computeFragRows(graph), [graph]);

  return (
    <Card className="py-0">
      <CardHeader className="px-5 py-3">
        <CardTitle className="text-base">Language fragility</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Per model, the span of self-ID rate across the 10 languages
          (worst-language &bull; → best-language &bull;). A wide span means the
          model&apos;s sense of identity depends heavily on the language it&apos;s
          asked in. Widest swing first.
        </p>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0">
        {rows[0] && !rows[0].flat && (
          <p className="sr-only">
            {rows[0].label} swings most — from {pct(rows[0].min)} self-ID in{" "}
            {rows[0].minLang} to {pct(rows[0].max)} in {rows[0].maxLang}.
          </p>
        )}
        <div className="space-y-1.5">
          {rows.map((r) => {
            const leftPct = r.min * 100;
            const widthPct = Math.max(r.range * 100, 0.5);
            const meanPct = r.mean * 100;
            return (
              <div
                key={r.modelId}
                className="flex items-center gap-2 text-xs"
                aria-label={
                  r.flat
                    ? `${r.label}: self-ID is ${pct(r.min)} across all languages`
                    : `${r.label}: self-ID ranges from ${pct(r.min)} in ${r.minLang} to ${pct(r.max)} in ${r.maxLang}, mean ${pct(r.mean)}`
                }
              >
                <div className="w-40 shrink-0 truncate font-mono sm:w-48" title={r.modelId}>
                  {r.label}
                </div>
                {/* min label (suppressed for flat rows — no meaningful "worst") */}
                <div className="w-16 shrink-0 text-right font-mono tabular-nums text-muted-foreground">
                  {r.flat ? (
                    <span className="text-muted-foreground/40">—</span>
                  ) : (
                    <>
                      {pct(r.min, 0)}
                      <span className="ml-0.5 text-[9px] uppercase">{r.minLang}</span>
                    </>
                  )}
                </div>
                {/* 0–100% track with the min→max range bar + mean tick */}
                <div className="relative h-4 flex-1">
                  <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" aria-hidden />
                  {!r.flat && (
                    <>
                      <div
                        className={cn(
                          "absolute top-1/2 h-2 -translate-y-1/2 rounded-full transition-all duration-200 motion-reduce:transition-none",
                          selfBandColor(r.min),
                        )}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      />
                      {/* min dot */}
                      <div
                        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500 ring-2 ring-background dark:bg-rose-400"
                        style={{ left: `${leftPct}%` }}
                        aria-hidden
                      />
                      {/* mean tick */}
                      <div
                        className="absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-foreground/40"
                        style={{ left: `${meanPct}%` }}
                        aria-hidden
                      />
                    </>
                  )}
                  {/* max dot — always shown; for flat rows it's the single value */}
                  <div
                    className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-600 ring-2 ring-background dark:bg-emerald-400"
                    style={{ left: `${r.max * 100}%` }}
                    aria-hidden
                  />
                </div>
                {/* max label */}
                <div className="w-16 shrink-0 font-mono tabular-nums text-foreground">
                  {pct(r.max, 0)}
                  <span className="ml-0.5 text-[9px] uppercase text-muted-foreground">
                    {r.flat ? "all" : r.maxLang}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-rose-500 dark:bg-rose-400" aria-hidden />
            worst language
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-px bg-foreground/40" aria-hidden />
            mean
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden />
            best language
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 5. Abstention — unknown + refused per manufacturer
// ---------------------------------------------------------------------------

interface AbstainRow {
  vendor: VendorId;
  name: string;
  logo: string | null;
  unknown: number;
  refused: number;
  total: number;
}

function computeAbstainRows(graph: GraphData): AbstainRow[] {
  const { names, logos } = vendorMeta(graph);
  const modelVendor = new Map(graph.models.map((m) => [m.id, m.vendor]));

  const acc = new Map<VendorId, { unknown: number; refused: number; n: number }>();
  for (const c of graph.cells) {
    const v = modelVendor.get(c.modelId);
    if (v === undefined) continue;
    const a = acc.get(v) ?? { unknown: 0, refused: 0, n: 0 };
    a.unknown += (c.distribution.unknown ?? 0) * c.n;
    a.refused += (c.distribution.refused ?? 0) * c.n;
    a.n += c.n;
    acc.set(v, a);
  }

  const rows: AbstainRow[] = [];
  for (const [v, a] of acc) {
    const n = a.n || 1;
    const u = a.unknown / n;
    const r = a.refused / n;
    rows.push({
      vendor: v,
      name: names.get(v) ?? v,
      logo: logos.get(v) ?? null,
      unknown: u,
      refused: r,
      total: u + r,
    });
  }
  rows.sort((a, b) => b.total - a.total);
  return rows;
}

const ABSTAIN_SEGMENTS = [
  { label: "Unknown (“I’m an AI”)", color: "bg-slate-400 dark:bg-slate-500/70" },
  { label: "Refused", color: "bg-amber-500 dark:bg-amber-500/70" },
] as const;

function AbstentionCard({ graph }: { graph: GraphData }) {
  const rows = useMemo(() => computeAbstainRows(graph), [graph]);
  const maxTotal = Math.max(0.01, ...rows.map((r) => r.total));

  return (
    <Card className="py-0">
      <CardHeader className="px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Abstention by manufacturer</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The other failure mode — not <em>answering wrong</em>, but{" "}
              <em>not answering</em>: giving no identity (&ldquo;unknown&rdquo;)
              or refusing outright. Share of all answers.
            </p>
          </div>
          <LegendDots items={ABSTAIN_SEGMENTS} />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0">
        {rows[0] && (
          <p className="sr-only">
            {rows[0].name} abstains most, with {pct(rows[0].total)} of answers
            giving no usable identity.
          </p>
        )}
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div
              key={r.vendor}
              className="flex items-center gap-2 text-xs"
              aria-label={`${r.name}: unknown ${pct(r.unknown)}, refused ${pct(r.refused)}, total abstention ${pct(r.total)}`}
            >
              <div className="w-28 shrink-0 sm:w-32">
                <VendorLabel name={r.name} logo={r.logo} />
              </div>
              <div className="h-4 flex-1 overflow-hidden rounded-sm bg-muted/40">
                <div className="flex h-full" style={{ width: `${(r.total / maxTotal) * 100}%` }}>
                  {r.unknown > 0 && (
                    <div
                      className="h-full bg-slate-400 transition-all duration-200 dark:bg-slate-500/70 motion-reduce:transition-none"
                      style={{ width: `${(r.unknown / r.total) * 100}%` }}
                    />
                  )}
                  {r.refused > 0 && (
                    <div
                      className="h-full bg-amber-500 transition-all duration-200 dark:bg-amber-500/70 motion-reduce:transition-none"
                      style={{ width: `${(r.refused / r.total) * 100}%` }}
                    />
                  )}
                </div>
              </div>
              <div className="w-14 shrink-0 text-right font-mono font-medium tabular-nums">
                {pct(r.total)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  ImitationBalanceCard,
  ConfusionPairsCard,
  LanguageCompositionCard,
  LanguageFragilityCard,
  AbstentionCard,
};
