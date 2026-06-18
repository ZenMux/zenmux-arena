"use client";

// The nof1-style top bar: a thin ink rule under a cream strip, wordmark on the
// left, uppercase monospace section tabs on the right with the active one boxed.
// Tabs are CONTROLLED — the active view + its setter come from TokenEconClient
// state, so a click switches the surface instantly (no server navigation). The
// URL is mirrored separately via history.replaceState there, so tabs stay
// shareable without a round-trip. See TokenEconClient for the rationale.

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { GITHUB_MARK_PATH, REPO_URL } from "@research/lib/branding";

export type View = "leaderboard" | "consumption" | "value" | "vendor-value";

/** Inline GitHub mark — lucide-react 1.16 ships no `Github` icon, so we draw it
 *  from the shared branding path (same source the research badge uses). */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor">
      <path d={GITHUB_MARK_PATH} />
    </svg>
  );
}

const VIEWS: { key: View; label: string }[] = [
  { key: "leaderboard", label: "LEADERBOARD" },
  { key: "vendor-value", label: "VALUE LADDER" },
  { key: "value", label: "VALUE MAP" },
  { key: "consumption", label: "CONSUMPTION" },
];

const TAB_CLASS = (isActive: boolean) =>
  "cursor-pointer border px-2 py-1 transition-colors " +
  (isActive
    ? "border-[#141414] bg-[#141414] text-[#f4f1ea]"
    : "border-transparent text-[#141414] hover:border-[#141414]");

/**
 * The view tabs. Two modes:
 *   · controlled (onViewChange given, on the main page) → instant <button>s that
 *     flip client state, no navigation.
 *   · link mode (no onViewChange, e.g. the About page) → <Link>s back to the main
 *     page with the chosen ?view=, which it reads on load. Nothing is "active".
 */
function NavLinks({
  view,
  onViewChange,
  isAbout = false,
}: {
  view?: View;
  onViewChange?: (v: View) => void;
  isAbout?: boolean;
}) {
  return (
    <nav className="flex items-center gap-1 text-[11px] font-bold tracking-[0.12em] sm:gap-2 sm:text-xs">
      {VIEWS.map((v) =>
        onViewChange ? (
          <button
            key={v.key}
            type="button"
            onClick={() => onViewChange(v.key)}
            aria-current={view === v.key ? "page" : undefined}
            className={TAB_CLASS(view === v.key)}
          >
            {v.label}
          </button>
        ) : (
          <Link
            key={v.key}
            href={`/token-economics?view=${v.key}`}
            className={TAB_CLASS(false)}
          >
            {v.label}
          </Link>
        ),
      )}
      {/* About sits alongside the view tabs (it's a route, not a view, so always
          a Link). `isAbout` lets the About page itself mark it active. */}
      <Link href="/token-economics/about" className={TAB_CLASS(isAbout)}>
        ABOUT
      </Link>
    </nav>
  );
}

export function TokenEconNav({
  view,
  onViewChange,
  isAbout = false,
}: {
  view?: View;
  onViewChange?: (v: View) => void;
  /** True on the About page so its tab renders active. */
  isAbout?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#141414] bg-[#f4f1ea]/95 backdrop-blur supports-[backdrop-filter]:bg-[#f4f1ea]/80">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
        {/* Wordmark → back to the Arena hub (a real route nav — keep as Link). */}
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/maker-logo/ZenMux-Light.png"
            alt="ZenMux"
            width={512}
            height={125}
            priority
            className="h-5 w-auto"
          />
          <span className="hidden border-l border-[#141414]/30 pl-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#141414] sm:inline">
            Token Economics
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <NavLinks view={view} onViewChange={onViewChange} isAbout={isAbout} />

          {/* Repo cluster, set off by a thin ink divider. */}
          <span className="hidden h-5 w-px bg-[#141414]/20 sm:inline-block" aria-hidden />

          {/* Project source. */}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            title="GitHub — ZenMux/zenmux-arena"
            className="inline-flex items-center text-[#141414] transition-opacity hover:opacity-70"
          >
            <GithubMark className="size-[18px]" />
          </a>

          <a
            href="https://zenmux.ai/models"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#141414] underline decoration-[#141414]/40 underline-offset-4 hover:decoration-[#141414] md:inline-flex"
          >
            zenmux.ai
            <ArrowUpRight className="size-3" />
          </a>
        </div>
      </div>
    </header>
  );
}
