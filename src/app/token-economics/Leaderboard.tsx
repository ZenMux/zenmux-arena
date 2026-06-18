"use client";

// Surface 1 — the PRICE LEADERBOARD. A dense, sortable nof1-style table ranking
// every model by the standardized basket cost (100K input + 1K output). Cheap is
// green, dear is red (vs the median). Click a header to re-sort; the basket-cost
// column drives the default ranking.

import { useMemo, useState } from "react";
import type { ModelEconomics, TokenEconomicsData } from "@research/token-economics/types";
import {
  usd,
  perM,
  tokens,
  perDollarDay,
  ctx,
  date,
  sortModels,
  type SortKey,
} from "./lib";
import { VendorGlyph } from "./components";

interface Column {
  key: SortKey;
  label: string;
  /** Default sort direction when this column is first clicked. */
  defaultDir: "asc" | "desc";
  hint: string;
}

const COLUMNS: Column[] = [
  { key: "blendedCost", label: "BASKET", defaultDir: "asc", hint: "100K in + 1K out, total $" },
  { key: "inputPrice", label: "INPUT", defaultDir: "asc", hint: "$ / 1M input tokens" },
  { key: "outputPrice", label: "OUTPUT", defaultDir: "asc", hint: "$ / 1M output tokens" },
  { key: "avgDailyTokens", label: "MED/DAY", defaultDir: "desc", hint: "median tokens on an active day across the first 14 working days post-launch (spike-robust)" },
  { key: "usageTokens", label: "ALL-TIME", defaultDir: "desc", hint: "all-time observed tokens served" },
  { key: "avgDailyPerDollar", label: "VALUE", defaultDir: "desc", hint: "median daily tokens served per $ of basket" },
  { key: "contextWindow", label: "CONTEXT", defaultDir: "desc", hint: "context window (tokens)" },
  { key: "publishTime", label: "RELEASED", defaultDir: "desc", hint: "listing publish date (YYYY-MM-DD)" },
];

export function Leaderboard({ data }: { data: TokenEconomicsData }) {
  // Default ranking: newest release first (publishTime descending). Nulls sink
  // to the bottom via sortModels' empty-string mapping.
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "publishTime",
    dir: "desc",
  });

  const median = data.summary.medianBlendedCost;
  // data.models is already free-merged upstream in compute() (mergeFreeModels),
  // so every surface shares one consistent set — just sort it here.
  const rows = useMemo(
    () => sortModels(data.models, sort.key, sort.dir),
    [data.models, sort],
  );

  const onSort = (col: Column) =>
    setSort((s) =>
      s.key === col.key
        ? { key: col.key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key: col.key, dir: col.defaultDir },
    );

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.14em]">
            Price Leaderboard
          </h2>
          <p className="mt-0.5 text-[11px] text-[#6f6a5f]">
            {rows.length} models · newest releases first · basket ={" "}
            <b className="text-[#141414]">100K input + 1K output</b> tokens ·
            green = cheaper than median ({usd(median)}), red = dearer ·{" "}
            <b className="text-[#141414]">MED/DAY</b> = median active-day launch
            velocity (first 14 working days),{" "}
            <span className="text-[#cf3636]">*</span> = partial window
          </p>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6f6a5f]">
          ▲▼ click a column to sort
        </p>
      </div>

      <div className="overflow-x-auto border border-[#141414] bg-[#fbf9f4]">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#141414] bg-[#ece8dd] text-[10px] uppercase tracking-[0.08em]">
              <th className="px-2 py-2 text-right font-bold text-[#6f6a5f]">#</th>
              <th className="sticky left-0 z-10 bg-[#ece8dd] px-2 py-2 text-left font-bold">
                Model
              </th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-right font-bold hover:bg-[#e2ddcf]"
                  onClick={() => onSort(c)}
                  title={c.hint}
                  aria-sort={
                    sort.key === c.key
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  {c.label}
                  <span className="ml-1 inline-block w-2 text-[#141414]">
                    {sort.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <Row key={m.slug} model={m} rank={i + 1} median={median} sortKey={sort.key} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({
  model,
  rank,
  median,
  sortKey,
}: {
  model: ModelEconomics;
  rank: number;
  median: number;
  sortKey: SortKey;
}) {
  const cheap = model.blendedCost <= median;
  // Subtle alternating tint band, like the reference leaderboard.
  const band = rank % 2 === 0 ? "bg-[#f4f1ea]" : "bg-[#fbf9f4]";
  const cell = (active: boolean) =>
    "whitespace-nowrap px-3 py-1.5 text-right tabular-nums " +
    (active ? "font-bold" : "");

  return (
    <tr className={`border-b border-[#141414]/12 last:border-0 transition-colors hover:bg-[#efe9da] ${band}`}>
      <td className="px-2 py-1.5 text-right tabular-nums text-[#6f6a5f]">{rank}</td>
      <td className={`sticky left-0 z-10 px-2 py-1.5 ${band}`}>
        <span className="flex items-center gap-1.5">
          <VendorGlyph vendor={model.vendor} alt={model.vendorName} className="size-4" />
          <span className="font-bold">{model.shortName}</span>
          <span className="hidden text-[10px] text-[#6f6a5f] sm:inline">
            {model.vendorName}
          </span>
        </span>
      </td>
      <td className={cell(sortKey === "blendedCost")}>
        <span style={{ color: cheap ? "#1a8a4a" : "#cf3636" }}>{usd(model.blendedCost)}</span>
      </td>
      <td className={cell(sortKey === "inputPrice")}>{perM(model.inputPrice)}</td>
      <td className={cell(sortKey === "outputPrice")}>{perM(model.outputPrice)}</td>
      <td className={cell(sortKey === "avgDailyTokens") + " text-[#141414]"}>
        <span
          title={
            model.avgDailyWindow
              ? `median of ${model.avgDailyWindow.workingDaysWithData} active ` +
                `of ${model.avgDailyWindow.elapsedWorkingDays} elapsed working days ` +
                `(target ${model.avgDailyWindow.targetWorkingDays}; ` +
                `${model.avgDailyWindow.from} → ${model.avgDailyWindow.to})` +
                (model.avgDailyWindow.partial ? " · partial window" : "")
              : "no launch-window data"
          }
        >
          {tokens(model.avgDailyTokens)}
          {model.avgDailyWindow?.partial && (
            <span className="ml-0.5 text-[#cf3636]" aria-hidden>*</span>
          )}
        </span>
      </td>
      <td className={cell(sortKey === "usageTokens") + " text-[#6f6a5f]"}>
        {tokens(model.usageTokens)}
      </td>
      <td className={cell(sortKey === "avgDailyPerDollar") + " text-[#6f6a5f]"}>
        {perDollarDay(model.avgDailyPerDollar)}
      </td>
      <td className={cell(sortKey === "contextWindow") + " text-[#6f6a5f]"}>
        {ctx(model.contextWindow)}
      </td>
      <td className={cell(sortKey === "publishTime") + " text-[#6f6a5f]"}>
        {date(model.publishTime)}
      </td>
    </tr>
  );
}
