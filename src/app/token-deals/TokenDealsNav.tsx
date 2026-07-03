// The Token Deals top bar — TokenEconNav's structure (wordmark · tabs · repo
// cluster) with this experiment's own tab set: DEALS · ABOUT. Both tabs are
// real routes (no ?view= state), so this stays a server-renderable component.

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
  "cursor-pointer border px-2 py-1 transition-colors " +
  (isActive
    ? "border-[#141414] bg-[#141414] text-[#f4f1ea]"
    : "border-transparent text-[#141414] hover:border-[#141414]");

export function TokenDealsNav({ active }: { active: "deals" | "about" }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#141414] bg-[#f4f1ea]/95 backdrop-blur supports-[backdrop-filter]:bg-[#f4f1ea]/80">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
        {/* Wordmark → back to the Arena hub. ZenMux-Light.png is the DARK
            wordmark, for light backgrounds (see src/app/page.tsx). */}
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
            Token Deals
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="flex items-center gap-1 text-[11px] font-bold tracking-[0.12em] sm:gap-2 sm:text-xs">
            <Link
              href="/token-deals"
              aria-current={active === "deals" ? "page" : undefined}
              className={TAB_CLASS(active === "deals")}
            >
              DEALS
            </Link>
            <Link
              href="/token-deals/about"
              aria-current={active === "about" ? "page" : undefined}
              className={TAB_CLASS(active === "about")}
            >
              ABOUT
            </Link>
          </nav>

          <span className="hidden h-5 w-px bg-[#141414]/20 sm:inline-block" aria-hidden />

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
