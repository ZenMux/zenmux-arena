// ZenMux Arena — the hub, redesigned as "A Field Guide to Frontier Models".
//
// Two editorial references, fused:
//  · searchingforbirds.visualcinnamon.com — warm cream paper, the study's
//    subjects (here: frontier-model marks, our "birds") encircling a huge,
//    light geometric title, italic serif specimen captions, a quiet centered
//    metadata line.
//  · belenjones.com — the work index as GIANT outlined display type; hover
//    fills a row with its accent ink. Corner metadata in small mono.
//
// Structure: full-height specimen-ring hero → outlined experiments index →
// instruments (tools) index → colophon footer. All data still comes from the
// shared registries (src/lib/experiments.ts, src/lib/tools.ts) and the
// published aggregate, so nothing here drifts from the sidebar/nav.
//
// Type system (loaded in layout.tsx): Jost (geometric sans, hero + smallcaps
// metadata) · Fraunces italic (specimen captions) · Archivo Black (the giant
// outlined index). Field-guide palette + keyframes live in globals.css under
// the `fg-` prefix, scoped to this page.
//
// LIGHT-MODE ONLY, like before: the specimen marks are the full-colour brand
// SVGs under public/model-logo/<name>_color.svg, rendered `unoptimized`.

import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXPERIMENTS } from "@/lib/experiments";
import { TOOLS } from "@/lib/tools";
import { SpecimenPlate } from "./specimen-plate";
import type { GraphData } from "@research/lib/types";
import { GITHUB_MARK_PATH } from "@research/lib/branding";

/* ── Live data (unchanged loaders) ────────────────────────────────────────── */

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
 *  cache (the config roster only holds deal facts; money and live status come
 *  from the aggregated ledger). Null when no baseline shipped. */
interface DealsStats {
  activeCount: number;
  bestDiscount: number | null;
}

function loadDealsStats(): DealsStats | null {
  try {
    const cachePath = path.join(process.cwd(), ".cache", "token-deals", "all.json");
    const payload = JSON.parse(fs.readFileSync(cachePath, "utf8")) as {
      activeCount?: number;
      deals?: { dealType?: string; discount?: number; status?: string }[];
    };
    // Deepest factor among active PAID deals — free models (discount 0) would
    // flatten "best cut ×0.17" to a meaningless ×0.00.
    const activePaid = (payload.deals ?? []).filter(
      (d) => d.status === "active" && d.dealType !== "free" && typeof d.discount === "number",
    );
    return {
      activeCount: payload.activeCount ?? activePaid.length,
      bestDiscount: activePaid.length ? Math.min(...activePaid.map((d) => d.discount!)) : null,
    };
  } catch {
    return null;
  }
}

/* ── The specimen ring ─────────────────────────────────────────────────────
   The hero plate (ring of marks + clickable masthead + its plumage easter
   egg) lives in ./specimen-plate.tsx as a client component — clicking the
   title borrows a random brand's colours. Specimen data moved with it. */

/* ── The index ─────────────────────────────────────────────────────────────
   Giant outlined rows, Belen-Jones style. Experiments + instruments share one
   visual system; each row carries its own accent ink for the hover fill. */

interface IndexRow {
  id: string;
  /** Display title for the giant type (may differ from registry title). */
  display: string;
  href: string | null;
  /** Fraunces-italic one-liner on the right. */
  note: string;
  /** Small mono fact line under the note (live numbers when we have them). */
  fact: string | null;
  /** Hover fill ink. */
  accent: string;
}

function buildExperimentRows(
  stats: LiveStats | null,
  deals: DealsStats | null,
): IndexRow[] {
  const accents: Record<string, string> = {
    "who-are-you": "#2c6e49",
    "token-economics": "#b07d2b",
    "token-deals": "#c2492f",
  };
  return EXPERIMENTS.map((e) => {
    let fact: string | null = null;
    if (e.id === "who-are-you" && stats) {
      fact = `${(stats.totalAnswers / 1000).toFixed(1).replace(/\.0$/, "")}k answers · ${stats.models} models · ${stats.languages} languages · ${Math.round(stats.selfRate * 100)}% self-ID`;
    } else if (e.id === "token-economics") {
      fact = "basket 100k in + 1k out · anchored to DeepSeek V4 Pro";
    } else if (e.id === "token-deals" && deals) {
      fact =
        deals.bestDiscount != null
          ? `${deals.activeCount} deals live · best cut ×${deals.bestDiscount.toFixed(2)}`
          : `${deals.activeCount} deals live`;
    }
    return {
      id: e.id,
      display: e.title,
      href: e.status === "live" ? e.href : null,
      note: e.tagline,
      fact,
      accent: accents[e.id] ?? "var(--fg-ink)",
    };
  });
}

function buildToolRows(): IndexRow[] {
  return TOOLS.map((t) => ({
    id: t.id,
    display: t.title,
    href: t.href,
    note: t.tagline,
    fact: null,
    accent: "#41618c",
  }));
}

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function Home() {
  const stats = loadLiveStats();
  const deals = loadDealsStats();
  const experimentRows = buildExperimentRows(stats, deals);
  const toolRows = buildToolRows();

  return (
    <main className="fg-paper relative flex-1 overflow-hidden">
      {/* Paper grain + a faint warm vignette from the top. */}
      <div aria-hidden className="fg-grain pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(90%_60%_at_50%_0%,rgba(176,125,43,0.07),transparent_70%)]"
      />

      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-6 pt-6 sm:px-10">
        <Image
          src="/maker-logo/ZenMux-Light.png"
          alt="ZenMux"
          width={512}
          height={125}
          priority
          className="h-6 w-auto opacity-90"
        />
        <div className="flex items-center gap-2.5">
          <a
            href="https://github.com/ZenMux/zenmux-arena"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub — ZenMux/zenmux-arena"
            title="github.com/ZenMux/zenmux-arena"
            className="inline-flex size-8 items-center justify-center rounded-full border border-[var(--fg-ink)]/25 bg-white/40 text-[var(--fg-ink)] backdrop-blur transition-colors hover:border-[var(--fg-ink)] hover:bg-[var(--fg-ink)] hover:text-[var(--fg-paper)]"
          >
            <GithubMark className="size-3.5" />
          </a>
          <a
            href="https://zenmux.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--fg-ink)]/25 bg-white/40 px-4 py-1.5 font-(family-name:--font-jost) text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--fg-ink)] backdrop-blur transition-colors hover:border-[var(--fg-ink)] hover:bg-[var(--fg-ink)] hover:text-[var(--fg-paper)]"
          >
            zenmux.ai
            <ArrowUpRight className="size-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </header>

      {/* ── Hero: the specimen plate (client — the masthead is the egg) ──── */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-6">
        <SpecimenPlate />
      </section>

      {/* ── The index: experiments in giant outlined type ────────────────── */}
      <section className="relative z-10 mx-auto mt-10 w-full max-w-6xl px-6 sm:px-10 md:mt-0">
        <IndexHeading no="I" title="Experiments" note="field studies, running live" />
        <ol>
          {experimentRows.map((row, i) => (
            <GiantRow key={row.id} row={row} index={i + 1} />
          ))}
        </ol>

        <IndexHeading no="II" title="Instruments" note="calculators & utilities" className="mt-20" />
        <ol>
          {toolRows.map((row, i) => (
            <GiantRow key={row.id} row={row} index={experimentRows.length + i + 1} />
          ))}
        </ol>
      </section>

      {/* ── Colophon ─────────────────────────────────────────────────────── */}
      <footer className="relative z-10 mx-auto mt-28 w-full max-w-6xl px-6 pb-16 sm:px-10">
        <div className="flex flex-col gap-2 border-t border-[var(--fg-ink)]/20 pt-8">
          <p className="font-(family-name:--font-fraunces) text-[15px] italic text-[var(--fg-ink-soft)]">
            Observed in the wild, one API call at a time.
          </p>
          <p className="font-(family-name:--font-jost) text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--fg-ink-soft)]">
            Built by{" "}
            <a
              href="https://x.com/thinkthinking_"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--fg-ink)]"
            >
              thinkthinking
            </a>{" "}
            · the open research arena by{" "}
            <a
              href="https://zenmux.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--fg-ink)]"
            >
              ZenMux.ai
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}

/* ── Index heading — small roman numeral + rule ───────────────────────────── */

function IndexHeading({
  no,
  title,
  note,
  className,
}: {
  no: string;
  title: string;
  note: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 border-b border-[var(--fg-ink)]/25 pb-3",
        className,
      )}
    >
      <div className="flex items-baseline gap-3">
        <span className="font-(family-name:--font-fraunces) text-sm italic text-[var(--fg-ink-soft)]">
          {no}.
        </span>
        <h2 className="font-(family-name:--font-jost) text-sm font-medium uppercase tracking-[0.3em] text-[var(--fg-ink)]">
          {title}
        </h2>
      </div>
      <p className="hidden font-(family-name:--font-fraunces) text-sm italic text-[var(--fg-ink-soft)] sm:block">
        {note}
      </p>
    </div>
  );
}

/* ── Giant outlined row ───────────────────────────────────────────────────── */

function GiantRow({ row, index }: { row: IndexRow; index: number }) {
  const live = Boolean(row.href);

  const inner = (
    <div className="flex flex-col gap-x-8 gap-y-2 py-7 sm:py-9 md:flex-row md:items-baseline md:justify-between">
      <span
        className={cn(
          "fg-outline font-(family-name:--font-archivo-black) text-[clamp(2.3rem,7.5vw,5.6rem)] uppercase leading-[0.95] tracking-tight",
          !live && "opacity-40",
        )}
      >
        {row.display}
      </span>
      <span className="flex shrink-0 flex-col gap-1 md:items-end md:text-right">
        <span className="font-(family-name:--font-fraunces) text-[15px] italic leading-snug text-[var(--fg-ink-soft)]">
          {row.note}
        </span>
        {row.fact && (
          <span className="font-mono text-[11px] tracking-tight text-[var(--fg-ink)]/70">
            {row.fact}
          </span>
        )}
        {!live && (
          <span className="font-(family-name:--font-jost) text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--fg-ink-soft)]">
            Coming soon
          </span>
        )}
      </span>
    </div>
  );

  if (!live) {
    return (
      <li className="border-b border-[var(--fg-ink)]/15">
        <div className="flex items-baseline gap-4 sm:gap-8">
          <RowNumber n={index} />
          <div className="min-w-0 flex-1">{inner}</div>
        </div>
      </li>
    );
  }

  return (
    <li
      className="fg-index-row group border-b border-[var(--fg-ink)]/15"
      style={{ "--fg-row-accent": row.accent } as React.CSSProperties}
    >
      <Link
        href={row.href!}
        className="flex items-baseline gap-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg-ink)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--fg-paper)] sm:gap-8"
      >
        <RowNumber n={index} />
        <div className="min-w-0 flex-1">{inner}</div>
      </Link>
    </li>
  );
}

function RowNumber({ n }: { n: number }) {
  return (
    <span className="hidden w-10 shrink-0 pt-2 font-mono text-xs tracking-widest text-[var(--fg-ink-soft)] sm:block">
      {String(n).padStart(2, "0")}
    </span>
  );
}

/* ── GitHub mark — lucide-react ships none, drawn from the shared branding
   path (research/lib/branding.ts) so it matches the icon used elsewhere
   (StudyBadge, AuthorCard). ────────────────────────────────────────────── */

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor">
      <path d={GITHUB_MARK_PATH} />
    </svg>
  );
}
