import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { TOOLS } from "@/lib/tools";

export const metadata: Metadata = {
  title: "Tools - ZenMux Arena",
  description: "Small pricing and research utilities for ZenMux Arena.",
};

export default function ToolsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <Image
              src="/maker-logo/ZenMux-Light.png"
              alt="ZenMux"
              width={512}
              height={125}
              priority
              className="h-5 w-auto dark:hidden"
            />
            <Image
              src="/maker-logo/ZenMux.png"
              alt="ZenMux"
              width={2000}
              height={512}
              priority
              className="hidden h-5 w-auto dark:block"
            />
            <span className="hidden border-l border-border pl-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:inline">
              Tools
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em]">
            {TOOLS.map((tool) => (
              <Link
                key={tool.id}
                href={tool.href}
                className="rounded-lg border border-transparent px-2.5 py-1.5 text-foreground transition-colors hover:border-border hover:bg-muted"
              >
                {tool.title}
              </Link>
            ))}
            <a
              href="https://zenmux.ai/models"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1 rounded-lg px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:inline-flex"
            >
              Models
              <ArrowUpRight data-icon="inline-end" />
            </a>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
