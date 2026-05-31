// The ZenMux Arena experiment registry — the single source of truth shared by
// the hub homepage (the cards) and the experiment shell sidebar (the nav). Add
// a new study here and it surfaces in both places automatically; keep this in
// step with the routes under src/app/research/.
//
// Pure data + lucide icon references, no JSX — so it can be imported by both
// server components (the hub) and client components (the sidebar) without a
// "use client" boundary leaking either way.

import {
  Fingerprint,
  Languages,
  ScanFace,
  type LucideIcon,
} from "lucide-react";

/** Where an experiment is in its lifecycle. `soon` cards are shown but inert. */
export type ExperimentStatus = "live" | "soon";

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
}

export const EXPERIMENTS: Experiment[] = [
  {
    id: "who-are-you",
    title: "Who Are You?",
    tagline: "One question, many vendors, ten languages.",
    description:
      "Ask every frontier model the same question — “Who are you?” — across ten languages, N times each, then chart which vendor each answer claims to be. Cross-vendor identity confusion, visualized.",
    status: "live",
    href: "/research/studio",
    icon: Fingerprint,
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "lost-in-translation",
    title: "Lost in Translation",
    tagline: "Does a model's persona survive the language it speaks?",
    description:
      "Probe how a model's self-description, tone, and refusals shift as the prompt language changes — holding the question fixed and varying only the tongue.",
    status: "soon",
    href: null,
    icon: Languages,
    accent: "text-sky-600 dark:text-sky-400",
  },
  {
    id: "mirror-test",
    title: "The Mirror Test",
    tagline: "Can a model recognize its own output?",
    description:
      "Show models their own and rivals' generations and ask them to pick which one they wrote — measuring self-recognition across the frontier.",
    status: "soon",
    href: null,
    icon: ScanFace,
    accent: "text-violet-600 dark:text-violet-400",
  },
];

/** The live experiment that owns the /research shell (used by the sidebar). */
export const PRIMARY_EXPERIMENT = EXPERIMENTS.find((e) => e.id === "who-are-you")!;
