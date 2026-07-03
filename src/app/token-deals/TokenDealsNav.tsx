// The Token Deals ticker bar — the black strip that frames the scoreboard
// (worldcupnext's "WORLD CUP NEXT: Friday, July 3rd — 3 matches" bar). Server
// component: tabs are real routes (BOARD · LADDER · ABOUT), no client state.

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { GITHUB_MARK_PATH, REPO_URL } from "@research/lib/branding";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor">
      <path d={GITHUB_MARK_PATH} />
    </svg>
  );
}

const TAB_CLASS = (isActive: boolean) =>
  "px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors sm:px-3 " +
  (isActive
    ? "bg-white text-[#0a0a0b]"
    : "text-white/70 hover:bg-white/15 hover:text-white");

export function TokenDealsNav({ active }: { active: "board" | "ladder" | "about" }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/15 bg-[#0a0a0b]">
      <div className="mx-auto flex h-14 w-full max-w-[1800px] items-center justify-between gap-3 px-4 sm:px-8">
        {/* Wordmark → back to the Arena hub. ZenMux.png is the WHITE wordmark,
            for dark backgrounds (see src/app/page.tsx). */}
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Image
            src="/maker-logo/ZenMux.png"
            alt="ZenMux"
            width={512}
            height={125}
            priority
            className="h-5 w-auto"
          />
          <span className="hidden truncate border-l border-white/25 pl-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white sm:inline">
            Token Deals
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <nav className="flex items-center gap-0.5 sm:gap-1">
            <Link
              href="/token-deals"
              aria-current={active === "board" ? "page" : undefined}
              className={TAB_CLASS(active === "board")}
            >
              Board
            </Link>
            <Link
              href="/token-deals/ladder"
              aria-current={active === "ladder" ? "page" : undefined}
              className={TAB_CLASS(active === "ladder")}
            >
              Ladder
            </Link>
            <Link
              href="/token-deals/about"
              aria-current={active === "about" ? "page" : undefined}
              className={TAB_CLASS(active === "about")}
            >
              About
            </Link>
          </nav>

          <span className="hidden h-5 w-px bg-white/25 sm:inline-block" aria-hidden />

          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            title="GitHub — ZenMux/zenmux-arena"
            className="inline-flex items-center text-white/80 transition-colors hover:text-white"
          >
            <GithubMark className="size-[18px]" />
          </a>

          <a
            href="https://zenmux.ai/models"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/80 transition-colors hover:text-white md:inline-flex"
          >
            zenmux.ai
            <ArrowUpRight className="size-3" />
          </a>
        </div>
      </div>
    </header>
  );
}
