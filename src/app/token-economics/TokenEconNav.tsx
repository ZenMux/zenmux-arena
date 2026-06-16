"use client";

// The nof1-style top bar: a thin ink rule under a cream strip, wordmark on the
// left, uppercase monospace section links on the right with the active one
// boxed. Tabs are query-driven (?view=) so the page stays a single route and
// the server component can read the active view too.

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowUpRight } from "lucide-react";

const VIEWS = [
  { key: "leaderboard", label: "LEADERBOARD" },
  { key: "consumption", label: "CONSUMPTION" },
  { key: "value", label: "VALUE MAP" },
] as const;

function NavLinks() {
  const params = useSearchParams();
  const active = params.get("view") ?? "leaderboard";
  return (
    <nav className="flex items-center gap-1 text-[11px] font-bold tracking-[0.12em] sm:gap-2 sm:text-xs">
      {VIEWS.map((v) => {
        const isActive = active === v.key;
        return (
          <Link
            key={v.key}
            href={`/token-economics?view=${v.key}`}
            className={
              "border px-2 py-1 transition-colors " +
              (isActive
                ? "border-[#141414] bg-[#141414] text-[#f4f1ea]"
                : "border-transparent text-[#141414] hover:border-[#141414]")
            }
          >
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TokenEconNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#141414] bg-[#f4f1ea]/95 backdrop-blur supports-[backdrop-filter]:bg-[#f4f1ea]/80">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
        {/* Wordmark → back to the Arena hub. */}
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

        <div className="flex items-center gap-2 sm:gap-4">
          <Suspense fallback={<div className="h-7" />}>
            <NavLinks />
          </Suspense>
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
