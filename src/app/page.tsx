// ZenMux Arena — the hub. A unified entry point for a growing set of
// cross-vendor LLM experiments (not just "Who Are You?"). The live study links
// straight into its richest surface, the graph studio; future studies show as
// inert "coming soon" cards. The experiment list is the shared registry in
// src/lib/experiments.ts, so cards here and the shell sidebar never drift.

import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EXPERIMENTS, PRIMARY_EXPERIMENT, type Experiment } from "@/lib/experiments";
import type { GraphData } from "@research/lib/types";
import { RandomArenaButton } from "./RandomArenaButton";

/** Headline numbers for the live experiment's card, read from the published aggregate. */
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

export default function Home() {
  const stats = loadLiveStats();
  const liveExperiments = EXPERIMENTS.filter((e) => e.status === "live");
  const liveCount = liveExperiments.length;
  // Serializable entry points handed to the client-side random CTA.
  const liveHrefs = liveExperiments
    .map((e) => e.href)
    .filter((h): h is string => Boolean(h));

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden bg-background px-6 pb-24 pt-20 sm:pt-28">
      {/* Soft ambient backdrop — a single radial wash, kept subtle. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_0%,rgba(120,120,255,0.07),transparent_70%)] dark:[background:radial-gradient(60%_50%_at_50%_0%,rgba(140,140,255,0.10),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative flex w-full max-w-2xl flex-col items-center gap-8 text-center">
        {/* Wordmark — theme-aware. ZenMux-Light.png is the DARK wordmark (light
            bg), ZenMux.png is the WHITE one (dark bg) — same as the graph export. */}
        <div>
          <Image
            src="/maker-logo/ZenMux-Light.png"
            alt="ZenMux"
            width={512}
            height={125}
            priority
            className="h-9 w-auto dark:hidden"
          />
          <Image
            src="/maker-logo/ZenMux.png"
            alt="ZenMux"
            width={2000}
            height={512}
            priority
            className="hidden h-9 w-auto dark:block"
          />
        </div>

        <div className="flex flex-col items-center gap-5">
          <Badge variant="outline" className="gap-1.5 py-1 pl-2 pr-2.5">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            ZenMux Arena
          </Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            The world&apos;s best AI,
            <br className="hidden sm:block" /> put to playful tests.
          </h1>
          <p className="max-w-md text-pretty text-lg leading-8 text-muted-foreground">
            ZenMux Arena runs the same fun, reproducible experiments across every
            frontier model — then shows you exactly how differently they behave.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <RandomArenaButton hrefs={liveHrefs} />
          <Button asChild variant="outline" size="lg" className="h-12 rounded-full px-6">
            <a href="https://zenmux.ai" target="_blank" rel="noopener noreferrer">
              Visit zenmux.ai
              <ArrowUpRight data-icon="inline-end" />
            </a>
          </Button>
        </div>
      </section>

      {/* ── Experiments ───────────────────────────────────────────────────── */}
      <section className="relative mt-20 w-full max-w-5xl">
        <div className="mb-5 flex items-end justify-between gap-4 px-1">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Experiments
            </h2>
            <p className="text-sm text-muted-foreground">
              {EXPERIMENTS.length - liveCount > 0
                ? `${liveCount} live · ${EXPERIMENTS.length - liveCount} in the works`
                : `${liveCount} live · more on the way`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXPERIMENTS.map((exp) => (
            <ExperimentCard
              key={exp.id}
              experiment={exp}
              stats={exp.id === PRIMARY_EXPERIMENT.id ? stats : null}
            />
          ))}
        </div>
      </section>

      <footer className="relative mt-20 text-xs text-muted-foreground">
        Built by{" "}
        <strong className="font-medium text-foreground/80">thinkthinking</strong>{" "}
        ·{" "}
        <a
          href="https://zenmux.ai"
          className="underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
        >
          ZenMux.ai
        </a>
      </footer>
    </main>
  );
}

/* ── Experiment card ──────────────────────────────────────────────────────
   Live cards are one big stretched-link click target (whole card → studio);
   "soon" cards are inert with a Coming soon badge. */

function ExperimentCard({
  experiment,
  stats,
}: {
  experiment: Experiment;
  stats: LiveStats | null;
}) {
  const live = experiment.status === "live" && experiment.href;
  const Icon = experiment.icon;

  return (
    <Card
      className={cn(
        "group relative gap-0 overflow-hidden transition-all",
        live
          ? "hover:border-foreground/20 hover:shadow-md focus-within:border-foreground/20 focus-within:shadow-md"
          : "opacity-75",
      )}
    >
      <CardHeader className="gap-0">
        <div className="flex items-center justify-between">
          <span
            aria-hidden
            className={cn(
              "flex size-11 items-center justify-center rounded-xl border border-border bg-muted/40",
              experiment.accent,
            )}
          >
            <Icon className="size-5" />
          </span>
          {live ? (
            <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          ) : (
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              Coming soon
            </Badge>
          )}
        </div>
        <CardTitle className="mt-4 text-base">{experiment.title}</CardTitle>
        <CardDescription className="mt-1 text-pretty">
          {experiment.tagline}
        </CardDescription>
      </CardHeader>

      <CardContent className="mt-4">
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {experiment.description}
        </p>

        {/* Live stats strip — only when we have published numbers. */}
        {live && stats && (
          <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-border/70 pt-4">
            <Metric label="Answers" value={fmt(stats.totalAnswers)} />
            <Metric label="Self-ID" value={`${Math.round(stats.selfRate * 100)}%`} accent />
            <Metric label="Models" value={String(stats.models)} />
            <Metric label="Langs" value={String(stats.languages)} />
          </dl>
        )}
      </CardContent>

      {/* Stretched link: makes the whole card one click target while keeping
          semantic Card markup. The label carries the full accessible name. */}
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

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <dd
        className={cn(
          "text-sm font-bold tabular-nums",
          accent ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
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

/** 2600 → "2.6k", small numbers unchanged. */
function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}
