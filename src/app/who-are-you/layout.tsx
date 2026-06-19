// Shell for the "Who Are You?" experiment. Wraps the three views (Overview /
// Graph Studio / Raw Answers) in a persistent collapsible sidebar + header, so
// switching views is a soft-navigation that never re-mounts the chrome.
//
// TooltipProvider is mounted here (not at the root) because the sidebar's
// collapsed-icon mode renders tooltips via SidebarMenuButton's `tooltip` prop.

import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ExperimentSidebar } from "./ExperimentSidebar";
import { ExperimentHeader } from "./ExperimentHeader";

export default function ResearchLayout({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider>
        <ExperimentSidebar />
        <SidebarInset>
          <ExperimentHeader />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
