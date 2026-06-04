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
    href: "/research/studio",
    icon: SlidersHorizontal,
    description: "Interactive graph workbench & image export",
    carriesRun: true,
  },
  {
    title: "Raw Answers",
    href: "/research/browse",
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
            {/* Brand → back to the hub. In icon mode only the mark shows. */}
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip="ZenMux Arena"
              className="gap-2.5"
            >
              <Link href="/">
                <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <span className="text-sm font-bold tracking-tight">Z</span>
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">
                    ZenMux Arena
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Experiments
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
        <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:hidden">
          <Image
            src="/maker-logo/ZenMux-Light.png"
            alt="ZenMux"
            width={512}
            height={125}
            className="h-4 w-auto opacity-60 dark:hidden"
          />
          <Image
            src="/maker-logo/ZenMux.png"
            alt="ZenMux"
            width={2000}
            height={512}
            className="hidden h-4 w-auto opacity-60 dark:block"
          />
        </div>
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
