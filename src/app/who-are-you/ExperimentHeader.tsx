"use client";

// Sticky top bar for the experiment shell: the sidebar toggle + a breadcrumb
// that reflects the current view. Path-driven (usePathname), so it updates on
// every soft-navigation without the individual pages owning a header anymore.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PRIMARY_EXPERIMENT } from "@/lib/experiments";

const VIEW_LABEL: Record<string, string> = {
  "/who-are-you/studio": "Graph Studio",
  "/who-are-you/browse": "Raw Answers",
};

export function ExperimentHeader() {
  const pathname = usePathname();
  const view = VIEW_LABEL[pathname] ?? "Overview";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden sm:block">
              <BreadcrumbLink asChild>
                <Link href="/">ZenMux Arena</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:block" />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/who-are-you/studio">{PRIMARY_EXPERIMENT.title}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{view}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="ml-auto px-4">
        <Link
          href="/tools/discount-to-deepseek"
          className="rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
        >
          Tools
        </Link>
      </div>
    </header>
  );
}
