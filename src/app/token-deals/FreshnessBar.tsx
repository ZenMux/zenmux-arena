"use client";

// Shared freshness readout — last-updated clock (rendered in the browser's
// own local time zone, via Intl.DateTimeFormat with no `timeZone` override)
// + the poll cadence + a manual refresh button. One component, both surfaces
// (Board's WindowControl strip, Ladder's control row) so "how fresh is this"
// never drifts between pages.

import { RefreshCw } from "lucide-react";
import { formatStamp, localZone } from "./useDealsFeed";

export function FreshnessBar({
  generatedAt,
  refreshIntervalSeconds,
  refreshing,
  onRefresh,
}: {
  generatedAt: string;
  refreshIntervalSeconds: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 font-[family-name:var(--font-deals-mono)] text-[10px] font-semibold uppercase tracking-[0.1em] text-white/50">
      {/* suppressHydrationWarning: formatStamp/localZone render in the
          server's timezone during SSR of the packaged initialData, then
          settle to the browser's own local time on the client. */}
      <span suppressHydrationWarning>
        Updated {formatStamp(generatedAt)} {localZone()}
      </span>
      <span aria-hidden className="text-white/25">
        ·
      </span>
      <span>refreshes every {Math.max(1, Math.round(refreshIntervalSeconds / 60))}m</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        title="Refresh now"
        className="inline-flex min-h-7 cursor-pointer items-center gap-1.5 border border-white/30 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/80 transition-colors hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={"size-3 " + (refreshing ? "animate-spin" : "")} />
        Refresh
      </button>
    </div>
  );
}
