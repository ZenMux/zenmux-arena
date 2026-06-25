"use client";

// Renders an instant in the VIEWER'S local timezone — without tripping React's
// hydration check.
//
// THE PROBLEM. A timestamp formatted with the browser's local zone is, by
// definition, machine-dependent. If the server renders "14:00 UTC" and the
// client renders "22:00 GMT+8", React sees a text mismatch on hydration and
// warns (and discards the server markup). Date formatting is one of the classic
// hydration hazards.
//
// THE FIX. Render a DETERMINISTIC value on the server and on the very first
// client render (the UTC fallback, identical on both), then switch to the local
// rendering in an effect that only runs in the browser. The post-mount swap is a
// normal re-render, not a hydration step, so there's no mismatch — just a
// one-frame settle from UTC to local. `suppressHydrationWarning` covers the
// instant before the effect lands.

import { useSyncExternalStore } from "react";

type Style = "datetime" | "date" | "time" | "stamp";

const FORMAT_OPTIONS: Record<Style, Intl.DateTimeFormatOptions> = {
  // "Jun 25, 2026, 14:30"
  datetime: {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  },
  // "2026-06-25" (ISO-like date, locale-independent ordering)
  date: { year: "numeric", month: "2-digit", day: "2-digit" },
  // "14:30"
  time: { hour: "2-digit", minute: "2-digit", hour12: false },
  // "Jun 25, 14:30:05" — matches the live tape's detailed stamp
  stamp: {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  },
};

/** Short timezone label for the current environment, e.g. "GMT+8" / "UTC". */
function localZoneAbbrev(): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** Deterministic server/first-render fallback: format in UTC. The 'date' style
 *  yields YYYY-MM-DD; the rest read like the local formats but pinned to UTC. */
function formatUtc(date: Date, style: Style): string {
  if (style === "date") return date.toISOString().slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    ...FORMAT_OPTIONS[style],
    timeZone: "UTC",
  }).format(date);
}

function formatLocal(date: Date, style: Style): string {
  if (style === "date") {
    // Keep YYYY-MM-DD ordering but in local time (en-CA renders ISO-style).
    return new Intl.DateTimeFormat("en-CA", FORMAT_OPTIONS.date).format(date);
  }
  return new Intl.DateTimeFormat(undefined, FORMAT_OPTIONS[style]).format(date);
}

// "Am I running in the browser, post-hydration?" expressed as an external store
// rather than a setState-in-effect — the latter trips the React Compiler's
// cascading-render lint. The subscribe is a no-op (the answer never changes once
// mounted); the server snapshot is `false` and the client snapshot is `true`, so
// React renders the deterministic UTC fallback during SSR + the first client
// paint, then re-renders into local time. This mirrors the useSyncExternalStore
// pattern already used in TokenEconClient.tsx for SSR-safe URL state.
const noopSubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function LocalTime({
  iso,
  style = "datetime",
  showZone = false,
  className,
}: {
  /** Any value `new Date()` accepts — typically an ISO-8601 UTC string. */
  iso: string | number | Date;
  style?: Style;
  /** Append a short zone label (e.g. "GMT+8") once mounted on the client. */
  showZone?: boolean;
  className?: string;
}) {
  const date = iso instanceof Date ? iso : new Date(iso);
  const valid = !Number.isNaN(date.getTime());

  // `mounted` is true only in the browser, after hydration — that's our cue to
  // re-render in local time. SSR and the first client paint both see false.
  const mounted = useMounted();

  if (!valid) return <span className={className}>—</span>;

  const text = mounted ? formatLocal(date, style) : formatUtc(date, style);
  const zone = mounted ? localZoneAbbrev() : "UTC";

  return (
    <time
      dateTime={date.toISOString()}
      title={date.toISOString()}
      suppressHydrationWarning
      className={className}
    >
      {text}
      {showZone && zone ? ` ${zone}` : ""}
    </time>
  );
}
