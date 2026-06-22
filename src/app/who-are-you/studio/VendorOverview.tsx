"use client";

import Image from "next/image";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { GraphData, ModelSpec, VendorId } from "@research/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a human-readable model name from the full model id. */
function modelDisplayName(model: ModelSpec): string {
  if (model.label) return model.label;
  // "anthropic/claude-opus-4.8:anthropic" → "Claude Opus 4.8"
  const id = model.id;
  const afterSlash = id.includes("/") ? id.substring(id.indexOf("/") + 1) : id;
  const lastColon = afterSlash.lastIndexOf(":");
  const name = lastColon > 0 ? afterSlash.substring(0, lastColon) : afterSlash;
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function pct(x: number, d = 1): string {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(d)}%`;
}

// Exported for the Data Explorer aggregate strip — the run-level KPI tiles
// and the per-language / per-vendor tables reuse the same colored badge
// palette so the page reads as one consistent design system. Both helpers are
// pure functions of a number, safe to share.
export { pct };

interface Confusion {
  vendor: VendorId;
  vendorName: string;
  logoPath: string | null;
  rate: number;
  count: number;
  /** The raw weighted count (≈ n * probability). */
}

/** Aggregate per-model confusion targets across all languages (excludes self/unknown/refused). */
function getModelConfusions(
  cells: GraphData["cells"],
  modelId: string,
  vendorNames: Map<VendorId, string>,
  vendorLogos: Map<VendorId, string | null>,
): Confusion[] {
  const totals = new Map<VendorId, number>();
  let totalN = 0;
  for (const cell of cells) {
    if (cell.modelId !== modelId) continue;
    for (const [v, prob] of Object.entries(cell.distribution)) {
      if (v !== "self" && v !== "unknown" && v !== "refused") {
        totals.set(v as VendorId, (totals.get(v as VendorId) ?? 0) + (prob ?? 0) * cell.n);
      }
    }
    totalN += cell.n;
  }
  if (totalN === 0) return [];
  return [...totals.entries()]
    .map(([v, count]) => ({
      vendor: v,
      vendorName: vendorNames.get(v) ?? v,
      logoPath: vendorLogos.get(v) ?? null,
      rate: count / totalN,
      count: Math.round(count),
    }))
    .sort((a, b) => b.rate - a.rate);
}

/** Build a modelId → langCode → selfRate lookup. */
function buildSelfRateMap(cells: GraphData["cells"]) {
  const map = new Map<string, Map<string, number>>();
  for (const cell of cells) {
    let inner = map.get(cell.modelId);
    if (!inner) {
      inner = new Map();
      map.set(cell.modelId, inner);
    }
    inner.set(cell.langCode, cell.selfRate);
  }
  return map;
}

/** Background + text color for a rate badge (higher = better, calibrated for
    self-ID rates). Exported for the Data Explorer aggregate strip. */
export function rateBadgeStyle(rate: number): string {
  if (rate >= 0.95) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (rate >= 0.80) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  if (rate >= 0.50) return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
}

/**
 * Font-weight emphasis for a rate, used in dense data tables where the full
 * `rateBadgeStyle` wash would create a wall of color. Returns "font-bold" for
 * values in the abnormal band, "" otherwise.
 *
 *   - `isInverted = false` (default, self-ID): bold when rate < 0.50 — the
 *     model gets it wrong more than half the time. 0.50–0.95 are
 *     interesting but not alarming; 0.95+ is the expected good case.
 *   - `isInverted = true` (confusion rate, where HIGHER = WORSE): bold when
 *     rate >= 0.05 — 5%+ of answers are claimed under a wrong vendor.
 *
 * Exported for the Data Explorer aggregate strip.
 */
export function emphasizeRate(rate: number, isInverted = false): string {
  if (!Number.isFinite(rate)) return "";
  return isInverted
    ? rate >= 0.05
      ? "font-bold"
      : ""
    : rate < 0.5
      ? "font-bold"
      : "";
}

// ---------------------------------------------------------------------------
// Vendor logo
// ---------------------------------------------------------------------------

function VendorLogo({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={alt}
      width={28}
      height={28}
      // The wordmarks in /public/maker-logo/ are white-on-transparent (designed
      // for the dark studio graph canvas). On the data page's light cards we
      // invert them so they read as dark on light, and undo the invert in dark
      // mode where the originals look correct. No border/ring — render the
      // original pixel shape, matching the studio graph's logo style.
      className="size-7 object-contain invert dark:invert-0"
      // If the image fails to load (e.g. 404), hide it gracefully.
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Single vendor card
// ---------------------------------------------------------------------------

function VendorCard({
  vendorName,
  logoPath,
  models,
  graph,
  selfRates,
  vendorNames,
  vendorLogos,
}: {
  vendorName: string;
  logoPath: string | null;
  models: ModelSpec[];
  graph: GraphData;
  selfRates: Map<string, Map<string, number>>;
  vendorNames: Map<VendorId, string>;
  vendorLogos: Map<VendorId, string | null>;
}) {
  const languages = graph.languages;

  return (
    <Card className="py-0">
      {/* ── Header ── */}
      <CardHeader className="flex flex-row items-center gap-3 px-5 py-3">
        <VendorLogo src={logoPath} alt={vendorName} />
        <div className="flex-1">
          <CardTitle className="text-base">{vendorName}</CardTitle>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {models.length} {models.length === 1 ? "model" : "models"}
        </span>
      </CardHeader>

      <CardContent className="px-0 pb-4 pt-0">
        {/* ── Self-ID matrix (model × language) ── */}
        <div className="mb-1 px-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Self-Identification Rate
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-border bg-muted/40">
                <th className="sticky left-0 z-10 bg-muted/40 px-4 py-2 text-left font-semibold text-muted-foreground">
                  Model
                </th>
                {languages.map((l) => (
                  <th
                    key={l.code}
                    className="px-2.5 py-2 text-center font-mono font-semibold text-muted-foreground"
                    title={l.name}
                  >
                    {l.code}
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-semibold text-muted-foreground">
                  Overall
                </th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const rates = selfRates.get(m.id);
                const overall = graph.summary.perModelSelfRate[m.id] ?? 0;
                return (
                  <tr
                    key={m.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="sticky left-0 z-10 bg-card px-4 py-2 font-medium whitespace-nowrap">
                      {modelDisplayName(m)}
                    </td>
                    {languages.map((l) => {
                      const rate = rates?.get(l.code);
                      const hasData = rate !== undefined;
                      return (
                        <td
                          key={l.code}
                          className={cn(
                            "px-2.5 py-2 text-center tabular-nums font-medium",
                            hasData ? emphasizeRate(rate!) : "text-muted-foreground/50",
                          )}
                        >
                          {hasData ? pct(rate!) : "—"}
                        </td>
                      );
                    })}
                    <td
                      className={cn(
                        "px-3 py-2 text-center tabular-nums font-semibold",
                        emphasizeRate(overall),
                      )}
                    >
                      {pct(overall)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Per-model confusions (vertical stack) ── */}
        <div className="mt-4 px-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cross-Vendor Confusions
          </h3>

          <div className="space-y-4">
            {models.map((m, mi) => {
              const confusions = getModelConfusions(
                graph.cells,
                m.id,
                vendorNames,
                vendorLogos,
              );
              const selfRate = graph.summary.perModelSelfRate[m.id] ?? 0;

              return (
                <div key={m.id}>
                  {mi > 0 && <Separator className="mb-4" />}

                  {/* Model label row */}
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <span className="font-semibold">{modelDisplayName(m)}</span>
                    <span className={cn("rounded-full px-1.5 py-0.5 font-mono", rateBadgeStyle(selfRate))}>
                      {pct(selfRate)} self
                    </span>
                  </div>

                  {confusions.length === 0 ? (
                    <p className="pl-2 text-xs text-emerald-600 dark:text-emerald-400">
                      ✓ Always self-identifies correctly
                    </p>
                  ) : (
                    // Inline chips: one per confused-as vendor. Much denser than
                    // a table — same data (logo + name + rate), one line per model.
                    <div className="flex flex-wrap items-center gap-1.5 pl-2">
                      <span className="text-xs text-muted-foreground">Mistaken as:</span>
                      {confusions.map((c) => (
                        <span
                          key={c.vendor}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 py-0.5 pl-1 pr-1.5 text-xs"
                          title={`${c.vendorName}: ${pct(c.rate)}`}
                        >
                          {c.logoPath && (
                            <Image
                              src={c.logoPath}
                              alt=""
                              width={16}
                              height={16}
                              // Same invert dance as <VendorLogo> — white
                              // wordmarks need flipping on the light card.
                              // No ring/border; the chip's own rounded-full
                              // border is the visual frame.
                              className="size-4 object-contain invert dark:invert-0"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                          )}
                          <span className="font-medium">{c.vendorName}</span>
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 font-mono tabular-nums",
                              rateBadgeStyle(c.rate),
                            )}
                          >
                            {pct(c.rate)}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function VendorOverview({ graph }: { graph: GraphData }) {
  const { vendorNames, vendorLogos, selfRates, sortedVendors } = useMemo(() => {
    const vendorNames = new Map<VendorId, string>();
    const vendorLogos = new Map<VendorId, string | null>();
    for (const v of graph.vendors) {
      vendorNames.set(v.id, v.name);
      vendorLogos.set(v.id, v.logo ? `/maker-logo/${encodeURIComponent(v.logo)}` : null);
    }

    const byVendor = new Map<VendorId, ModelSpec[]>();
    for (const m of graph.models) {
      const list = byVendor.get(m.vendor) ?? [];
      list.push(m);
      byVendor.set(m.vendor, list);
    }

    // Sort: by model count desc, then alphabetically
    const sortedVendors = [...byVendor.entries()].sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
    );

    const selfRates = buildSelfRateMap(graph.cells);

    return { vendorNames, vendorLogos, selfRates, sortedVendors };
  }, [graph]);

  if (sortedVendors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No vendor data available for this run.</p>
    );
  }

  return (
    <section className="space-y-6">
      {sortedVendors.map(([vendorId, models]) => {
        const vName = vendorNames.get(vendorId) ?? vendorId;
        const logoPath = vendorLogos.get(vendorId) ?? null;

        return (
          <VendorCard
            key={vendorId}
            vendorName={vName}
            logoPath={logoPath}
            models={models}
            graph={graph}
            selfRates={selfRates}
            vendorNames={vendorNames}
            vendorLogos={vendorLogos}
          />
        );
      })}
    </section>
  );
}
