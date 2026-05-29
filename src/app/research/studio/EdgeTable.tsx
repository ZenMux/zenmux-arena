"use client";

import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { edgeLangWeights, isPseudo, vendorColor } from "@research/lib/geometry";
import type { GraphData, VendorId } from "@research/lib/types";
import { cn } from "@/lib/utils";

/**
 * The authoritative, NEVER-truncated view of cross-vendor confusion: one row
 * per drawable edge (from ≠ to, real target), one column per language. Each
 * cell shows that edge's rate for that language (count/total on hover). This is
 * where "show ALL the languages" lives in full — the graph labels are the
 * pretty summary, this table is the complete data.
 */
export default function EdgeTable({
  graph,
  threshold,
}: {
  graph: GraphData;
  threshold: number;
}) {
  const rows = useMemo(() => {
    return graph.edges
      .filter((e) => e.from !== e.to && !isPseudo(e.to))
      .map((e) => {
        const langs = edgeLangWeights(e); // sorted strongest-first, all langs
        const byCode = new Map(langs.map((l) => [l.code, l]));
        const peak = langs.length ? langs[0].p : 0;
        return { e, byCode, peak };
      })
      .filter((r) => r.peak >= threshold)
      .sort((a, b) => b.peak - a.peak);
  }, [graph.edges, threshold]);

  const vname = (id: VendorId) => graph.vendors.find((v) => v.id === id)?.name ?? id;

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No cross-vendor confusion at or above the current threshold.
      </p>
    );
  }

  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead className="sticky left-0 z-10 bg-background">From</TableHead>
          <TableHead className="sticky left-0 z-10 bg-background">Claims to be</TableHead>
          {graph.languages.map((l) => (
            <TableHead key={l.code} className="text-right tabular-nums">
              {l.name}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ e, byCode }) => (
          <TableRow key={`${e.from}->${e.to}`}>
            <TableCell className="sticky left-0 z-10 bg-background font-medium">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: vendorColor(e.from) }}
                />
                {vname(e.from)}
              </span>
            </TableCell>
            <TableCell className="font-medium text-muted-foreground">{vname(e.to)}</TableCell>
            {graph.languages.map((l) => {
              const w = byCode.get(l.code);
              if (!w || w.count === 0) {
                return (
                  <TableCell key={l.code} className="text-right text-muted-foreground/30">
                    ·
                  </TableCell>
                );
              }
              const strong = w.p >= threshold;
              return (
                <TableCell
                  key={l.code}
                  title={`${w.count}/${w.total}`}
                  className={cn(
                    "text-right tabular-nums",
                    strong ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {Math.round(w.p * 100)}%
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
