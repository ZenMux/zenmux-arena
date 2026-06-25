"use client";

// A tiny, unobtrusive version fingerprint pinned to the corner of every page.
//
// It reads the build metadata baked in at package time (src/lib/build-info.ts)
// and shows "v<version> · <sha> · built <local build time>". The build time is
// rendered through <LocalTime>, so it appears in the VIEWER'S timezone while
// staying hydration-safe (UTC on the server, local after mount).
//
// Purpose: let the user (and you) confirm at a glance EXACTLY which build a
// given tab is running — invaluable when a deploy "looks the same" but you need
// to know whether the new bundle actually shipped.

import { BUILD_INFO, buildLabel } from "@/lib/build-info";
import { LocalTime } from "@/components/LocalTime";
import { cn } from "@/lib/utils";

export function BuildStamp({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-2 right-2 z-50 select-none font-mono text-[10px] leading-none text-muted-foreground/50",
        className,
      )}
      // Let the title still be inspectable on hover even though clicks pass through.
      title={`Build ${buildLabel()}${
        BUILD_INFO.buildTime ? ` · ${BUILD_INFO.buildTime}` : ""
      }`}
    >
      <span className="rounded bg-background/60 px-1.5 py-0.5 backdrop-blur-sm">
        {buildLabel()}
        {BUILD_INFO.buildTime ? (
          <>
            {" · "}
            <LocalTime iso={BUILD_INFO.buildTime} style="datetime" showZone />
          </>
        ) : null}
      </span>
    </div>
  );
}
