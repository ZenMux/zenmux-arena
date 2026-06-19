"use client";

// The experiment shell's left rail. Persists across soft-navigations between
// the three views (it lives in research/layout.tsx, which mounts once), so it's
// the home for cross-view navigation: Overview (report) ↔ Graph Studio ↔ Raw
// answers, plus the route back out to the Arena hub.
//
// Active state comes from usePathname (no render bail-out). The `?run=` query
// is preserved across the studio↔browse jump so switching views doesn't drop
// the run you're inspecting — that read is isolated in a Suspense boundary
// because useSearchParams opts the subtree into client rendering.

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  ChevronLeft,
  ListChecks,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { PRIMARY_EXPERIMENT } from "@/lib/experiments";

interface View {
  title: string;
  /** Base path; the run query is appended at render time when relevant. */
  href: string;
  icon: LucideIcon;
  description: string;
  /** Whether this view reads the `?run=` query (so we should carry it over). */
  carriesRun: boolean;
}

const VIEWS: View[] = [
  {
    title: "Graph Studio",
    href: "/who-are-you/studio",
    icon: SlidersHorizontal,
    description: "Interactive graph workbench & image export",
    carriesRun: true,
  },
  {
    title: "Data Explorer",
    href: "/who-are-you/data",
    icon: BarChart3,
    description: "Per-vendor self-ID rates, matrices, and cross-vendor confusions",
    carriesRun: true,
  },
  {
    title: "Raw Answers",
    href: "/who-are-you/browse",
    icon: ListChecks,
    description: "Every model's answers with extraction labels",
    carriesRun: true,
  },
];

export function ExperimentSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Brand → back to the hub. In icon mode only the mark shows.
                Theme-aware single-letter mark:
                  zenmux-single-light-bg.png = DARK mark (light bg)
                  zenmux-single-black-bg.png = WHITE mark (dark bg)
                Same counterintuitive naming as the wordmark pair. */}
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip={PRIMARY_EXPERIMENT.title}
              className="gap-2.5"
            >
              <Link href="/">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                  <Image
                    src="/maker-logo/zenmux-single-light-bg.png"
                    alt="ZenMux"
                    width={64}
                    height={64}
                    className="h-8 w-8 dark:hidden"
                  />
                  <Image
                    src="/maker-logo/zenmux-single-black-bg.png"
                    alt="ZenMux"
                    width={64}
                    height={64}
                    className="hidden h-8 w-8 dark:block"
                  />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">
                    {PRIMARY_EXPERIMENT.title}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    ZenMux Arena
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{PRIMARY_EXPERIMENT.title}</SidebarGroupLabel>
          <Suspense fallback={<ViewMenu run={null} />}>
            <ViewMenuWithRun />
          </Suspense>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to Arena">
              <Link href="/" className="text-muted-foreground">
                <ChevronLeft />
                <span>Back to Arena</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

/** Reads the active run from the URL and renders the nav carrying it forward. */
function ViewMenuWithRun() {
  const params = useSearchParams();
  return <ViewMenu run={params.get("run")} />;
}

function ViewMenu({ run }: { run: string | null }) {
  const pathname = usePathname();
  return (
    <SidebarMenu>
      {VIEWS.map((view) => {
        // Exact match for the report root; prefix-free since the three paths
        // don't nest under each other.
        const active = pathname === view.href;
        const href =
          view.carriesRun && run
            ? `${view.href}?run=${encodeURIComponent(run)}`
            : view.href;
        return (
          <SidebarMenuItem key={view.href}>
            <SidebarMenuButton asChild isActive={active} tooltip={view.title}>
              <Link href={href}>
                <view.icon />
                <span>{view.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
