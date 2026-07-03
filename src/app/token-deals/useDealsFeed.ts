"use client";

// The Token Deals data feed — one hook, two pages (board + ladder). The
// canonical payload is always range "all" (full deal windows) so money numbers
// never come from a clipped window; the 72H hourly view is a separate lazy
// fetch that only ever drives the trend chart.
//
// State machine per the PRD: loading (skeleton) → ready → refreshing (silent) →
// degraded (fetch failed OR payload.live=false: deal facts stay, money shows
// "—", auto-retry with 10s backoff).

import { useCallback, useEffect, useRef, useState } from "react";
import type { DealRangeKey, TokenDealsPayload } from "@research/token-deals/types";

const ERROR_BACKOFF_MS = 10_000;
const REFRESH_SETTLE_MS = 750;
const DEFAULT_REFRESH_SECONDS = 300;

async function fetchDeals(range: DealRangeKey, signal?: AbortSignal): Promise<TokenDealsPayload> {
  const res = await fetch(`/api/token-deals/live?range=${range}`, { cache: "no-store", signal });
  const json = (await res.json()) as TokenDealsPayload | { error?: string };
  if (!res.ok) throw new Error("error" in json && json.error ? json.error : "Deals fetch failed");
  return json as TokenDealsPayload;
}

function nextAlignedDelayMs(intervalSeconds: number): number {
  const intervalMs = Math.max(1, intervalSeconds) * 1000;
  return intervalMs - (Date.now() % intervalMs) + REFRESH_SETTLE_MS;
}

export interface DealsFeed {
  data: TokenDealsPayload | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  /** true when the payload arrived but the billing DB is unreachable. */
  degraded: boolean;
  retry: () => void;
}

export function useDealsFeed(): DealsFeed {
  const [data, setData] = useState<TokenDealsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [manualRefresh, setManualRefresh] = useState(0);
  const hasDataRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    let timeoutId: number | null = null;
    let refreshSeconds = DEFAULT_REFRESH_SECONDS;

    const clearTimer = () => {
      if (timeoutId != null) window.clearTimeout(timeoutId);
      timeoutId = null;
    };

    const schedule = (delayMs: number) => {
      if (!live) return;
      clearTimer();
      timeoutId = window.setTimeout(() => void run(), delayMs);
    };

    async function run(signal?: AbortSignal) {
      clearTimer();
      if (hasDataRef.current) setRefreshing(true);
      try {
        const json = await fetchDeals("all", signal);
        if (!live) return;
        refreshSeconds = json.refreshIntervalSeconds || DEFAULT_REFRESH_SECONDS;
        hasDataRef.current = true;
        setData(json);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        // Degraded payloads (live=false) retry fast; healthy ones align to the
        // refresh boundary like the token-economics LIVE view.
        schedule(json.live ? nextAlignedDelayMs(refreshSeconds) : ERROR_BACKOFF_MS);
      } catch (err) {
        if (!live || signal?.aborted) return;
        setError(err instanceof Error ? err.message : "Deals fetch failed");
        setLoading(false);
        setRefreshing(false);
        schedule(ERROR_BACKOFF_MS);
      }
    }
    void run(controller.signal);
    return () => {
      live = false;
      controller.abort();
      clearTimer();
    };
  }, [manualRefresh]);

  const retry = useCallback(() => setManualRefresh((n) => n + 1), []);

  return {
    data,
    error,
    loading,
    refreshing,
    degraded: data != null && !data.live,
    retry,
  };
}

export function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function localZone(): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(
      new Date(),
    );
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}
