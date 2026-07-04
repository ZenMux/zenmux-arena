"use client";

// The ledger date-window control — preset chips (ALL / 30D / 7D) + native
// from/to date inputs, styled like the board's SegmentedControl (bordered
// white-on-black). Native <input type="date"> on purpose: zero dependencies,
// correct mobile keyboards/pickers, and [color-scheme:dark] keeps the picker
// chrome on-theme. Filtering is pure client-side slicing (see lib.ts) — no
// request is made when the window changes.

import { useMemo } from "react";
import { DEALS_LAUNCH_DATE, todayUtcDate, type DateWindow } from "./lib";

const PRESET_DAYS = [
  { key: "all", label: "ALL", days: null, title: "Full ledger — since ZenMux launch (2025-09-29)" },
  { key: "30d", label: "30D", days: 30, title: "Last 30 days" },
  { key: "7d", label: "7D", days: 7, title: "Last 7 days" },
] as const;

function presetWindow(days: number | null, today: string): DateWindow {
  if (days == null) return { from: DEALS_LAUNCH_DATE, to: today };
  const fromMs = Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86_400_000;
  const from = new Date(fromMs).toISOString().slice(0, 10);
  return { from: from < DEALS_LAUNCH_DATE ? DEALS_LAUNCH_DATE : from, to: today };
}

export function WindowControl({
  value,
  onChange,
}: {
  value: DateWindow;
  onChange: (win: DateWindow) => void;
}) {
  const today = todayUtcDate();
  const activePreset = useMemo(() => {
    for (const p of PRESET_DAYS) {
      const w = presetWindow(p.days, today);
      if (w.from === value.from && w.to === value.to) return p.key;
    }
    return null;
  }, [value, today]);

  const clamp = (date: string, min: string, max: string): string =>
    date < min ? min : date > max ? max : date;

  const setFrom = (raw: string) => {
    if (!raw) return; // cleared input — keep the current window
    const from = clamp(raw, DEALS_LAUNCH_DATE, today);
    onChange({ from, to: value.to < from ? from : value.to });
  };
  const setTo = (raw: string) => {
    if (!raw) return;
    const to = clamp(raw, DEALS_LAUNCH_DATE, today);
    onChange({ from: value.from > to ? to : value.from, to });
  };

  const inputClass =
    "min-h-8 cursor-pointer border border-white/30 bg-transparent px-2 font-[family-name:var(--font-deals-mono)] text-[11px] font-semibold uppercase tracking-[0.06em] text-white [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2"
      role="group"
      aria-label="Ledger date window"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
        Window
      </span>
      <div className="flex items-center border border-white/30">
        {PRESET_DAYS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(presetWindow(p.days, today))}
            title={p.title}
            aria-pressed={activePreset === p.key}
            className={
              "min-h-8 cursor-pointer px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors sm:px-3 " +
              (activePreset === p.key
                ? "bg-white text-[#0a0a0b]"
                : "text-white/70 hover:bg-white/15 hover:text-white")
            }
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
            From
          </span>
          <input
            type="date"
            value={value.from}
            min={DEALS_LAUNCH_DATE}
            max={value.to}
            onChange={(e) => setFrom(e.target.value)}
            className={inputClass}
          />
        </label>
        <span aria-hidden className="text-white/40">
          →
        </span>
        <label className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
            To
          </span>
          <input
            type="date"
            value={value.to}
            min={value.from}
            max={today}
            onChange={(e) => setTo(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
    </div>
  );
}
