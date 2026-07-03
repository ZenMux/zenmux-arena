// ZenMux Arena — the hub. A unified entry point for a growing set of
// cross-vendor LLM experiments (not just "Who Are You?"). The live study links
// straight into its richest surface, the graph studio; future studies show as
// inert "coming soon" cards. The experiment list is the shared registry in
// src/lib/experiments.ts, so cards here and the shell sidebar never drift.
//
// Design notes:
//  · LIGHT-MODE ONLY. The vendor wall is sourced from
//    public/model-logo/<name>_color.svg (full-colour brand marks for light
//    backgrounds), rendered as plain <img> via next/image `unoptimized` so the
//    optimiser doesn't reject local SVGs.
//  · The hero proof strip is HUB-LEVEL (experiments / labs / openness) — facts
//    about the whole Arena. Per-study numbers (answers, self-ID) live on the
//    study's own card, where they're accurate.
//  · Each experiment card adopts a CARD_THEMES surface that mirrors its
//    destination page, so the card reads as a faithful miniature: Who Are You?
//    = soft graph-lab; Token Economics = mono financial ledger.

import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  EXPERIMENTS,
  PRIMARY_EXPERIMENT,
  type Experiment,
  type ExperimentTheme,
} from "@/lib/experiments";
import { TOOLS, type ArenaTool } from "@/lib/tools";
import type { GraphData } from "@research/lib/types";
import { RandomArenaButton } from "./RandomArenaButton";

/** Study-specific headline numbers, read from the published aggregate. These
 *  belong to "Who Are You?" — they're rendered on that card, NOT in the hub
 *  hero (the hero speaks for the whole Arena). */
interface LiveStats {
  totalAnswers: number;
  selfRate: number;
  models: number;
  languages: number;
}

function loadLiveStats(): LiveStats | null {
  const p = path.join(process.cwd(), "public", "research", "aggregate.json");
  if (!fs.existsSync(p)) return null;
  try {
    const g = JSON.parse(fs.readFileSync(p, "utf8")) as GraphData;
    return {
      totalAnswers: g.summary.totalAnswers,
      selfRate: g.summary.overallSelfRate,
      models: g.models.length,
      languages: g.languages.length,
    };
  } catch {
    return null;
  }
}

/** Token Deals mini metrics for its hub card, read from the packaged baseline
 *  cache (deal facts live in the billing DB now — the baseline is the only
 *  build-time snapshot of them). Null when no baseline shipped. */
interface DealsCardStats {
  activeCount: number;
  bestDiscount: number | null;
  totalSaved: number | null;
}

function loadDealsStats(): DealsCardStats | null {
  try {
    const cachePath = path.join(process.cwd(), ".cache", "token-deals", "all.json");
    const payload = JSON.parse(fs.readFileSync(cachePath, "utf8")) as {
      activeCount?: number;
      totals?: { saved?: number } | null;
      deals?: { dealType?: string; discount?: number; status?: string }[];
    };
    // Deepest factor among active PAID deals — free models (discount 0) would
    // flatten "低至 x0.17" to a meaningless x0.00.
    const activePaid = (payload.deals ?? []).filter(
      (d) => d.status === "active" && d.dealType !== "free" && typeof d.discount === "number",
    );
    return {
      activeCount: payload.activeCount ?? activePaid.length,
      bestDiscount: activePaid.length ? Math.min(...activePaid.map((d) => d.discount!)) : null,
      totalSaved: payload.totals?.saved ?? null,
    };
  } catch {
    return null;
  }
}

/* ── Vendor logo wall ──────────────────────────────────────────────────────
   The Arena's subjects, shown as proof. Each entry is a full-colour brand mark
   under public/model-logo/<file>_color.svg. Ordered most recognisable first so
   the wall reads as "every frontier lab is in here". */
const WALL_VENDORS: { file: string; name: string }[] = [
  { file: "chatgpt", name: "OpenAI" },
  { file: "claude", name: "Anthropic" },
  { file: "gemini", name: "Google Gemini" },
  { file: "meta", name: "Meta" },
  { file: "mistral", name: "Mistral" },
  { file: "grok", name: "xAI Grok" },
  { file: "deepeek", name: "DeepSeek" },
  { file: "qwen", name: "Qwen" },
  { file: "doubao", name: "Doubao" },
  { file: "kimi", name: "Kimi" },
  { file: "zai", name: "z-ai" },
  { file: "wenxin", name: "ERNIE" },
  { file: "hunyuan", name: "Tencent Hunyuan" },
  { file: "minimax", name: "MiniMax" },
  { file: "stepfun", name: "StepFun" },
  { file: "xiaomi", name: "Xiaomi" },
  { file: "kwai", name: "Kwai" },
  { file: "inclusionai", name: "inclusionAI" },
];

export default function Home() {
  const stats = loadLiveStats();
  const dealsStats = loadDealsStats();
  const liveExperiments = EXPERIMENTS.filter((e) => e.status === "live");
  const liveCount = liveExperiments.length;
  // Serializable entry points handed to the client-side random CTA.
  const liveHrefs = liveExperiments
    .map((e) => e.href)
    .filter((h): h is string => Boolean(h));

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden bg-background px-6 pb-24 pt-16 sm:pt-24">
      {/* Ambient backdrop: a faint engineering grid + a single radial wash from
          the top. Kept very low-contrast so it reads as paper texture, not UI. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(15,15,30,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,15,30,0.035)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(120%_70%_at_50%_0%,black,transparent_75%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(55%_45%_at_50%_-5%,rgba(16,185,129,0.10),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative flex w-full max-w-3xl flex-col items-center gap-9 text-center">
        {/* Wordmark. ZenMux-Light.png is the DARK wordmark, for light bg. */}
        <Image
          src="/maker-logo/ZenMux-Light.png"
          alt="ZenMux"
          width={512}
          height={125}
          priority
          className="h-8 w-auto"
        />

        <div className="flex flex-col items-center gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            ZenMux Arena · live research
          </span>

          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            See how the world&apos;s best AI
            <br className="hidden sm:block" />{" "}
            <span className="text-muted-foreground">really behaves.</span>
          </h1>

          <p className="max-w-xl text-pretty text-lg leading-8 text-muted-foreground">
            A growing set of reproducible, cross-vendor experiments — run the
            same test across every frontier model, then show you, in hard
            numbers, exactly how differently they behave.
          </p>
        </div>

        {/* Hub-level proof strip — facts about the Arena itself, not any single
            study. Tabular figures so the row never reflows. */}
        <dl className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12">
          <Stat value={String(liveCount)} label="Live experiments" accent />
          <StatDivider />
          <Stat value={String(WALL_VENDORS.length)} label="Frontier labs" />
          <StatDivider />
          <Stat value="100%" label="Open & reproducible" />
        </dl>

        {/* Single, focused CTA: enter an arena. The zenmux.ai entry point lives
            in the footer so it doesn't compete with the primary action. */}
        <div className="flex flex-col items-center">
          <RandomArenaButton hrefs={liveHrefs} />
        </div>

        {/* ── Vendor wall ─────────────────────────────────────────────────── */}
        <div className="mt-4 flex w-full flex-col items-center gap-5">
          <ul className="flex max-w-2xl flex-wrap items-center justify-center gap-x-7 gap-y-5">
            {WALL_VENDORS.map((v) => (
              <li key={v.file} title={v.name} className="shrink-0">
                <Image
                  src={`/model-logo/${v.file}_color.svg`}
                  alt={v.name}
                  width={32}
                  height={32}
                  unoptimized
                  className="h-7 w-7 transition-transform duration-200 hover:scale-110 sm:h-8 sm:w-8"
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Experiments ───────────────────────────────────────────────────── */}
      <section className="relative mt-28 w-full max-w-5xl">
        <SectionHeading
          index="01"
          title="Experiments"
          caption={
            EXPERIMENTS.length - liveCount > 0
              ? `${liveCount} live · ${EXPERIMENTS.length - liveCount} in the works`
              : `${liveCount} live · more on the way`
          }
        />

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXPERIMENTS.map((exp) => (
            <ExperimentCard
              key={exp.id}
              experiment={exp}
              stats={exp.id === PRIMARY_EXPERIMENT.id ? stats : null}
              dealsStats={exp.id === "token-deals" ? dealsStats : null}
            />
          ))}
        </div>
      </section>

      {/* ── Tools ─────────────────────────────────────────────────────────── */}
      <section className="relative mt-16 w-full max-w-5xl">
        <SectionHeading
          index="02"
          title="Tools"
          caption="Pricing calculators and research utilities."
        />

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>

      {/* Footer also hosts the sole entry point to the main ZenMux site — kept
          out of the hero so it doesn't compete with "Enter an Arena". */}
      <footer className="relative mt-24 flex flex-col items-center gap-4">
        <a
          href="https://zenmux.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-emerald-600"
        >
          Visit zenmux.ai
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
        <p className="text-xs text-muted-foreground">
          Built by{" "}
          <strong className="font-medium text-foreground/80">thinkthinking</strong>{" "}
          · the open research arena by{" "}
          <a
            href="https://zenmux.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
          >
            ZenMux.ai
          </a>
        </p>
      </footer>
    </main>
  );
}

/* ── Hero stat ────────────────────────────────────────────────────────────── */

function Stat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <dd
        className={cn(
          "text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl",
          accent ? "text-emerald-600" : "text-foreground",
        )}
      >
        {value}
      </dd>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
    </div>
  );
}

function StatDivider() {
  return <span aria-hidden className="hidden h-8 w-px bg-border sm:block" />;
}

/* ── Section heading ──────────────────────────────────────────────────────────
   Editorial eyebrow: an index number, the section title, a one-line caption,
   then a hairline rule that runs to the edge — gives the page real hierarchy
   instead of the previous text-sm labels that matched body copy. */

function SectionHeading({
  index,
  title,
  caption,
}: {
  index: string;
  title: string;
  caption: string;
}) {
  return (
    <div className="flex items-end gap-4 border-b border-border pb-4">
      <span className="font-mono text-xs text-muted-foreground/60">{index}</span>
      <div className="flex flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{caption}</p>
      </div>
    </div>
  );
}

/* ── Tool card ────────────────────────────────────────────────────────────── */

function ToolCard({ tool }: { tool: ArenaTool }) {
  const Icon = tool.icon;

  return (
    <Card className="group relative gap-0 overflow-hidden transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md focus-within:border-foreground/20 focus-within:shadow-md">
      <CardHeader className="gap-0">
        <div className="flex items-center justify-between">
          <span
            aria-hidden
            className={cn(
              "flex size-11 items-center justify-center rounded-xl border border-border bg-muted/40",
              tool.accent,
            )}
          >
            <Icon className="size-5" />
          </span>
          <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
        <CardTitle className="mt-4 text-base">{tool.title}</CardTitle>
        <CardDescription className="mt-1 text-pretty">
          {tool.tagline}
        </CardDescription>
      </CardHeader>

      <CardContent className="mt-4">
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {tool.description}
        </p>
      </CardContent>

      <Link
        href={tool.href}
        className="absolute inset-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="sr-only">Open {tool.title}</span>
      </Link>
    </Card>
  );
}

/* ── Experiment card ──────────────────────────────────────────────────────
   Each card mirrors its destination via a CARD_THEMES surface (keyed by
   experiment.theme), so it reads as a faithful preview of where it leads.
   Live cards are one big stretched-link click target; "soon" cards are inert.
   Add a future experiment's look by adding a theme entry — unknown themes fall
   back to `default` (neutral shadcn card). */

interface CardThemeTokens {
  /** Extra classes layered onto <Card>. */
  card: string;
  /** Icon tile. */
  iconTile: string;
  /** Title typography (e.g. uppercase mono for the ledger). */
  title: string;
  /** Body / description typography. */
  body: string;
  /** "Live" indicator. */
  live: string;
  /** Inline CTA row. */
  cta: string;
  /** CTA label. */
  ctaLabel: string;
  /** Accent used by the metric / motif values. */
  accent: string;
}

const CARD_THEMES: Record<ExperimentTheme, CardThemeTokens> = {
  // Who Are You? — soft shadcn graph-lab. Emerald accent, rounded, airy.
  graph: {
    card: "hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-md focus-within:border-emerald-500/30 focus-within:shadow-md",
    iconTile:
      "rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
    title: "text-base",
    body: "text-sm leading-relaxed text-muted-foreground",
    live: "inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600",
    cta: "mt-5 inline-flex items-center gap-1 text-sm font-medium text-foreground",
    ctaLabel: "Open graph studio",
    accent: "text-emerald-600",
  },
  // Token Economics — mono financial newsprint. Hard ink rule, warm paper,
  // ledger green, uppercase mono — echoes the page's terminal aesthetic.
  ledger: {
    card: "rounded-md bg-[#f6f4ef] font-mono ring-0 border border-foreground/80 shadow-none hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--color-foreground)] focus-within:shadow-[3px_3px_0_0_var(--color-foreground)]",
    iconTile:
      "rounded-sm border border-foreground/80 bg-transparent text-foreground",
    title: "text-base font-bold uppercase tracking-tight",
    body: "text-[12px] leading-relaxed text-[#6f6a5f]",
    live: "inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#1a8a4a]",
    cta: "mt-5 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-foreground",
    ctaLabel: "Open the ledger",
    accent: "text-[#1a8a4a]",
  },
  // Neutral fallback for experiments without a bespoke look yet.
  default: {
    card: "hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md focus-within:border-foreground/20 focus-within:shadow-md",
    iconTile: "rounded-xl border border-border bg-muted/40 text-foreground",
    title: "text-base",
    body: "text-sm leading-relaxed text-muted-foreground",
    live: "inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600",
    cta: "mt-5 inline-flex items-center gap-1 text-sm font-medium text-foreground",
    ctaLabel: "Open",
    accent: "text-foreground",
  },
};

function ExperimentCard({
  experiment,
  stats,
  dealsStats,
}: {
  experiment: Experiment;
  stats: LiveStats | null;
  dealsStats?: DealsCardStats | null;
}) {
  const live = experiment.status === "live" && experiment.href;
  const Icon = experiment.icon;
  const t = CARD_THEMES[experiment.theme] ?? CARD_THEMES.default;

  return (
    <Card
      className={cn(
        "group relative gap-0 overflow-hidden transition-all",
        live ? t.card : "opacity-75",
      )}
    >
      <CardHeader className="gap-0">
        <div className="flex items-center justify-between">
          <span
            aria-hidden
            className={cn("flex size-11 items-center justify-center", t.iconTile)}
          >
            <Icon className="size-5" />
          </span>
          {live ? (
            <span className={t.live}>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  experiment.theme === "ledger" ? "bg-[#1a8a4a]" : "bg-emerald-500",
                )}
              />
              Live
            </span>
          ) : (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Coming soon
            </span>
          )}
        </div>
        <CardTitle className={cn("mt-4", t.title)}>{experiment.title}</CardTitle>
        <CardDescription className={cn("mt-1 text-pretty", t.body)}>
          {experiment.tagline}
        </CardDescription>
      </CardHeader>

      <CardContent className="mt-4">
        <p className={cn("text-pretty", t.body)}>{experiment.description}</p>

        {/* Theme-specific motif: the part that makes the card a true miniature. */}
        {live && experiment.theme === "graph" && stats && (
          <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-border/70 pt-4">
            <Metric label="Answers" value={fmt(stats.totalAnswers)} accent="text-emerald-600" />
            <Metric
              label="Self-ID"
              value={`${Math.round(stats.selfRate * 100)}%`}
              accent="text-emerald-600"
              highlight
            />
            <Metric label="Models" value={String(stats.models)} accent="text-emerald-600" />
            <Metric label="Langs" value={String(stats.languages)} accent="text-emerald-600" />
          </dl>
        )}

        {/* Ledger motifs are keyed by experiment id, not theme — two experiments
            share the ledger LOOK but each card must preview its own numbers. */}
        {live && experiment.id === "token-economics" && (
          <dl className="mt-5 space-y-1.5 border-t border-foreground/80 pt-4 font-mono text-[11px]">
            <LedgerRow label="Basket" value="100K IN · 1K OUT" />
            <LedgerRow label="Anchor" value="DeepSeek V4 Pro" accent />
            <LedgerRow label="Metric" value="Tokens ÷ Cost" accent />
          </dl>
        )}

        {live && experiment.id === "token-deals" && dealsStats && (
          <dl className="mt-5 space-y-1.5 border-t border-foreground/80 pt-4 font-mono text-[11px]">
            <LedgerRow label="Deals live" value={`${dealsStats.activeCount} models`} />
            {dealsStats.bestDiscount != null && (
              <LedgerRow
                label="Best cut"
                value={`x${dealsStats.bestDiscount.toFixed(2)} · ${(dealsStats.bestDiscount * 10).toFixed(1).replace(/\.0$/, "")} 折`}
                accent
              />
            )}
            <LedgerRow
              label="累计让利"
              value={
                dealsStats.totalSaved != null
                  ? `$${Math.round(dealsStats.totalSaved).toLocaleString("en-US")}`
                  : "LIVE ON PAGE"
              }
              accent
            />
          </dl>
        )}

        {live && (
          <p className={t.cta}>
            {t.ctaLabel}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </p>
        )}
      </CardContent>

      {/* Stretched link: whole card is one click target, semantic Card markup
          preserved. The sr-only label carries the full accessible name. */}
      {live && (
        <Link
          href={experiment.href!}
          className="absolute inset-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="sr-only">Open {experiment.title}</span>
        </Link>
      )}
    </Card>
  );
}

/** Graph-theme metric cell (Who Are You? confusion numbers). */
function Metric({
  label,
  value,
  accent,
  highlight,
}: {
  label: string;
  value: string;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dd
        className={cn(
          "text-sm font-bold tabular-nums",
          highlight ? accent : "text-foreground",
        )}
      >
        {value}
      </dd>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
    </div>
  );
}

/** Ledger-theme row (Token Economics method, shown in the page's own style). */
function LedgerRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="uppercase tracking-wide text-[#6f6a5f]">{label}</dt>
      <dd className={cn("tabular-nums", accent ? "text-[#1a8a4a]" : "text-foreground")}>
        {value}
      </dd>
    </div>
  );
}

/** 2600 → "2.6k", small numbers unchanged. */
function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}
