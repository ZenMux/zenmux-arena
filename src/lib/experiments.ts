// The ZenMux Arena experiment registry — the single source of truth shared by
// the hub homepage (the cards) and the experiment shell sidebar (the nav). Add
// a new study here and it surfaces in both places automatically; keep this in
// step with the routes under src/app/who-are-you/.
//
// Pure data + lucide icon references, no JSX — so it can be imported by both
// server components (the hub) and client components (the sidebar) without a
// "use client" boundary leaking either way.

import { Fingerprint, Coins, BadgePercent, type LucideIcon } from "lucide-react";

/** Where an experiment is in its lifecycle. `soon` cards are shown but inert. */
export type ExperimentStatus = "live" | "soon";

/**
 * Visual identity hint for the hub card. Each value maps (in the homepage's
 * CARD_THEMES table) to a card surface that mirrors the experiment's own page —
 * so the card reads as a faithful miniature of where it leads. Add a new theme
 * here + in CARD_THEMES when a future experiment has a distinct look; unknown /
 * omitted values fall back to the neutral default.
 *   · "graph"  — Who Are You?: soft shadcn graph-lab, emerald accent, node motif
 *   · "ledger" — Token Economics: mono financial newsprint, hard rule, ink/green
 */
export type ExperimentTheme = "graph" | "ledger" | "default";

export interface Experiment {
  /** Stable slug, also used as a React key. */
  id: string;
  title: string;
  /** One-line hook for the card + sidebar tooltip. */
  tagline: string;
  /** Longer blurb for the card body. */
  description: string;
  status: ExperimentStatus;
  /**
   * Entry point for the experiment. Per the product brief, the live study jumps
   * straight into its richest surface (the graph studio) rather than a separate
   * landing page. `null` for `soon` experiments (nothing to open yet).
   */
  href: string | null;
  icon: LucideIcon;
  /** Tailwind utility for the icon tile accent (kept on-token where possible). */
  accent: string;
  /** Card visual identity on the hub — mirrors the experiment's own page. */
  theme: ExperimentTheme;
}

export const EXPERIMENTS: Experiment[] = [
  {
    id: "who-are-you",
    title: "Who Are You?",
    tagline: "One question, many vendors, ten languages.",
    description:
      "Ask every frontier model the same question — “Who are you?” — across ten languages, N times each, then chart which vendor each answer claims to be. Cross-vendor identity confusion, visualized.",
    status: "live",
    href: "/who-are-you/studio",
    icon: Fingerprint,
    accent: "text-emerald-600 dark:text-emerald-400",
    theme: "graph",
  },
  {
    id: "token-economics",
    title: "Token Economics",
    tagline: "Every model, priced and weighed.",
    description:
      "Scrape every frontier model ZenMux serves, rank them by a standard request basket (100K in + 1K out), and weigh price against the tokens each one actually serves — a live map of where the compute and the money flow.",
    status: "live",
    href: "/token-economics",
    icon: Coins,
    accent: "text-amber-600 dark:text-amber-400",
    theme: "ledger",
  },
  {
    id: "token-deals",
    title: "Token Deals",
    tagline: "The subsidy receipt, live.",
    description:
      "ZenMux is paying part of your token bill on a batch of flagship models. This ledger shows every deal's list price → deal price, and a live running total of the money left on the table — for developers.",
    status: "live",
    href: "/token-deals",
    icon: BadgePercent,
    accent: "text-emerald-700 dark:text-emerald-400",
    theme: "ledger",
  },
];

/** The live experiment that owns the /who-are-you shell (used by the sidebar). */
export const PRIMARY_EXPERIMENT = EXPERIMENTS.find((e) => e.id === "who-are-you")!;
