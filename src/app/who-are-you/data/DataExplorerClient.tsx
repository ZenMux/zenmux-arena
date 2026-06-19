"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { GraphData } from "@research/lib/types";
import VendorOverview from "../studio/VendorOverview";
import DataAggregate from "./DataAggregate";

export interface RunRef {
  id: string; // "<study>/<stamp>"
  study: string;
  stamp: string;
}

export default function DataExplorerClient({
  runs,
  selectedRun,
  graph,
}: {
  runs: RunRef[];
  selectedRun: string;
  graph: GraphData;
}) {
  const router = useRouter();
  const [navPending, startNav] = useTransition();

  const onRunChange = (id: string) => {
    startNav(() => router.push(`/who-are-you/data?run=${encodeURIComponent(id)}`));
  };

  const s = graph.summary;

  // Total cross-vendor confusion events (excludes self/unknown/refused).
  const totalConfusions = graph.edges
    .filter((e) => e.from !== e.to && !["self", "unknown", "refused"].includes(e.to))
    .reduce((sum, e) => sum + e.count, 0);

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {/* ── Header row ── */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Data Explorer</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Per-model self-identification rates across languages, grouped by vendor.
              {totalConfusions > 0 && (
                <>
                  {" "}
                  {totalConfusions.toLocaleString()} cross-vendor confusion
                  {totalConfusions === 1 ? "" : "s"} detected.
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick stats */}
            <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
              <span className="tabular-nums font-mono">{s.totalAnswers.toLocaleString()} answers</span>
              <span className="text-border">·</span>
              <span className="tabular-nums">{graph.models.length} models</span>
              <span className="text-border">·</span>
              <span className="tabular-nums">{graph.languages.length} languages</span>
            </div>

            {/* Run selector */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Run</Label>
              <Select value={selectedRun} onValueChange={onRunChange} disabled={navPending}>
                <SelectTrigger size="sm" className="w-[280px] font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="font-mono text-xs">
                      {r.study} · {r.stamp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <DataAggregate graph={graph} />
        <VendorOverview graph={graph} />
      </div>
    </div>
  );
}
