"use client";

// Cross-cut aggregates for the Data Explorer — sits ABOVE the per-vendor
// <VendorOverview> cards, giving the reader a one-glance picture of the whole
// run before drilling into the per-vendor detail.
//
// Tables (this file):
//   • Run summary  — 5 KPI tiles (answers, self-id, cross-vendor, unknown, refused)
//   • By language  — 10 rows × 4 cols: code, self-rate, refused-rate, top confusion
//   • By vendor    — N rows × 5 cols: logo+name, #models, #answers, self-rate,
//                                     top cross-vendor target chip
//
// Charts (./DataInsights), woven into the render order so the page reads as one
// narrative — "who fakes whom" first, then the language story, then abstention:
//   • Imitation balance        — diverging bar: imitated (+) vs imitates (−)
//   • Strongest confusion pairs — ranked P bars: "X claims to be Y"
//   • Answer composition by lang — 100% stacked: self/confusion/unknown/refused
//   • Language fragility        — dumbbell: per-model self-ID min→max across langs
//   • Abstention by manufacturer — stacked: unknown + refused share
//
// All numbers come from the GraphData the parent already loaded — no new I/O.

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  GraphData,
  LanguageSpec,
  ModelSpec,
  VendorId,
  VendorMeta,
} from "@research/lib/types";
import { pct, rateBadgeStyle, emphasizeRate } from "../studio/VendorOverview";
import {
  ImitationBalanceCard,
  ConfusionPairsCard,
  LanguageCompositionCard,
  LanguageFragilityCard,
  AbstentionCard,
} from "./DataInsights";

// Pseudo-vendors are analytical buckets, not real brands. Skip them in the
// per-vendor rollup (the data explorer should answer "which real vendor has
// the worst self-ID", not "how big is the unknown bucket").
const PSEUDO_VENDORS: ReadonlySet<VendorId> = new Set([
  "self",
  "unknown",
  "refused",
]);

/** Inverted rate palette: HIGHER is WORSE — for the "cross-vendor" tile
    where a high rate is bad news. Mirrors `rateBadgeStyle`'s band cuts but
    with green/red swapped. */
function confusionBadgeStyle(rate: number): string {
  if (rate >= 0.10) return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  if (rate >= 0.05) return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
  if (rate >= 0.02) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
}

// ---------------------------------------------------------------------------
// 1. Run summary
// ---------------------------------------------------------------------------

function KpiTile({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  /** Extra classes for the value (e.g. colored rate badge). */
  valueClassName?: string;
}) {
  return (
    <div>
      <div
        className={cn(
          "text-xl font-bold tabular-nums sm:text-2xl",
          valueClassName,
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function RunSummary({ graph }: { graph: GraphData }) {
  const s = graph.summary;
  return (
    <Card className="py-0">
      <CardHeader className="flex flex-row items-center justify-between px-5 py-3">
        <CardTitle className="text-base">Run summary</CardTitle>
        <span className="text-xs tabular-nums text-muted-foreground">
          {graph.models.length} models · {graph.languages.length} languages
        </span>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <KpiTile
            label="Answers"
            value={s.totalAnswers.toLocaleString()}
          />
          <KpiTile
            label="Self-ID"
            value={pct(s.overallSelfRate)}
            valueClassName={cn("rounded px-1.5 py-0.5", rateBadgeStyle(s.overallSelfRate))}
          />
          <KpiTile
            label="Cross-vendor"
            value={pct(s.confusionRate)}
            valueClassName={cn(
              "rounded px-1.5 py-0.5",
              confusionBadgeStyle(s.confusionRate),
            )}
          />
          <KpiTile
            label="Unknown"
            value={pct(s.unknownRate)}
          />
          <KpiTile
            label="Refused"
            value={pct(s.refusedRate)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 2. By language
// ---------------------------------------------------------------------------

interface LanguageRow {
  lang: LanguageSpec;
  selfRate: number;
  refusedRate: number;
  /** { vendorId, name, logoPath, rate, count } for the dominant confusion, or null. */
  topConfusion: {
    vendor: VendorId;
    name: string;
    logoPath: string | null;
    rate: number;
  } | null;
}

function computeLanguageRows(graph: GraphData): LanguageRow[] {
  // Per-language refused rate: weighted over all cells in that language.
  const refusedNumer = new Map<string, number>();
  const refusedDenom = new Map<string, number>();
  for (const cell of graph.cells) {
    const refusedProb = cell.distribution.refused ?? 0;
    refusedNumer.set(
      cell.langCode,
      (refusedNumer.get(cell.langCode) ?? 0) + refusedProb * cell.n,
    );
    refusedDenom.set(cell.langCode, (refusedDenom.get(cell.langCode) ?? 0) + cell.n);
  }

  // Vendor meta for chip rendering.
  const vendorNames = new Map<VendorId, string>();
  const vendorLogos = new Map<VendorId, string | null>();
  for (const v of graph.vendors) {
    vendorNames.set(v.id, v.name);
    vendorLogos.set(v.id, v.logo ? `/maker-logo/${encodeURIComponent(v.logo)}` : null);
  }

  const rows: LanguageRow[] = graph.languages.map((lang) => {
    const denom = refusedDenom.get(lang.code) ?? 0;
    const refusedRate = denom > 0 ? (refusedNumer.get(lang.code) ?? 0) / denom : 0;
    const selfRate = graph.summary.perLangSelfRate[lang.code] ?? 0;

    // Top "mistaken as": across all edges that have a per-lang breakdown for
    // this language, pick the one with the largest `byLang[code].count`, restricted
    // to real (non-self/non-unknown/non-refused) targets.
    let top: LanguageRow["topConfusion"] = null;
    let topCount = 0;
    for (const e of graph.edges) {
      if (PSEUDO_VENDORS.has(e.to) || e.from === e.to) continue;
      const bl = e.byLang?.[lang.code];
      if (!bl) continue;
      if (bl.count > topCount) {
        topCount = bl.count;
        top = {
          vendor: e.to,
          name: vendorNames.get(e.to) ?? e.to,
          logoPath: vendorLogos.get(e.to) ?? null,
          rate: bl.total > 0 ? bl.count / bl.total : 0,
        };
      }
    }
    return { lang, selfRate, refusedRate, topConfusion: top };
  });

  // Worst self-ID first (most informative ordering — "where are the gaps").
  rows.sort((a, b) => a.selfRate - b.selfRate);
  return rows;
}

function TopConfusionChip({
  top,
}: {
  top: LanguageRow["topConfusion"] | VendorRow["topConfusion"];
}) {
  if (!top) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 py-0.5 pl-1 pr-1.5 text-xs">
      {top.logoPath && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={top.logoPath}
          alt=""
          className="size-4 object-contain invert dark:invert-0"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <span className="font-medium">{top.name}</span>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 font-mono tabular-nums",
          // Vendor-row top confusion: higher = worse → confusion palette.
          // Language-row top confusion: higher = more common mistake at this
          // language, but it's still a *confusion* by definition → confusion palette.
          confusionBadgeStyle(top.rate),
        )}
      >
        {pct(top.rate)}
      </span>
    </span>
  );
}

function ByLanguageCard({ rows }: { rows: LanguageRow[] }) {
  return (
    <Card className="py-0">
      <CardHeader className="px-5 py-3">
        <CardTitle className="text-base">By language</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Self-ID and refusal rates per language, plus the most common
          cross-vendor confusion at that language.
        </p>
      </CardHeader>
      <CardContent className="px-0 pb-4 pt-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-border bg-muted/40">
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground">
                  Language
                </th>
                <th className="px-3 py-2 text-center font-semibold text-muted-foreground">
                  Self-ID
                </th>
                <th className="px-3 py-2 text-center font-semibold text-muted-foreground">
                  Refused
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                  Top confusion
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.lang.code}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-2 font-medium whitespace-nowrap">
                    <span className="font-mono">{row.lang.code}</span>
                    <span className="ml-2 text-muted-foreground">
                      {row.lang.name}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-center font-medium tabular-nums",
                      rateBadgeStyle(row.selfRate),
                    )}
                  >
                    {pct(row.selfRate)}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    {pct(row.refusedRate)}
                  </td>
                  <td className="px-3 py-2">
                    <TopConfusionChip top={row.topConfusion} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 3. By vendor rollup
// ---------------------------------------------------------------------------

interface VendorRow {
  vendor: VendorMeta;
  models: ModelSpec[];
  /** Total answers across all (model, lang, repeat) for this vendor's models. */
  totalAnswers: number;
  /** Mean per-model self-rate over the vendor's models. NaN-safe. */
  selfRate: number;
  topConfusion: {
    vendor: VendorId;
    name: string;
    logoPath: string | null;
    rate: number;
  } | null;
}

function computeVendorRows(graph: GraphData): VendorRow[] {
  // Group models by vendor.
  const byVendor = new Map<VendorId, ModelSpec[]>();
  for (const m of graph.models) {
    const list = byVendor.get(m.vendor) ?? [];
    list.push(m);
    byVendor.set(m.vendor, list);
  }

  // Per-model total answers (sum of n over all langs).
  const answersByModel = new Map<string, number>();
  for (const c of graph.cells) {
    answersByModel.set(c.modelId, (answersByModel.get(c.modelId) ?? 0) + c.n);
  }

  // Vendor meta for chip rendering.
  const vendorNames = new Map<VendorId, string>();
  const vendorLogos = new Map<VendorId, string | null>();
  for (const v of graph.vendors) {
    vendorNames.set(v.id, v.name);
    vendorLogos.set(v.id, v.logo ? `/maker-logo/${encodeURIComponent(v.logo)}` : null);
  }

  const rows: VendorRow[] = [];
  for (const v of graph.vendors) {
    if (PSEUDO_VENDORS.has(v.id)) continue;
    const models = byVendor.get(v.id) ?? [];

    // Per-vendor total answers.
    let totalAnswers = 0;
    for (const m of models) totalAnswers += answersByModel.get(m.id) ?? 0;

    // Per-vendor self-rate = mean of per-model self-rates.
    let selfSum = 0;
    let selfCount = 0;
    for (const m of models) {
      const r = graph.summary.perModelSelfRate[m.id];
      if (typeof r === "number" && Number.isFinite(r)) {
        selfSum += r;
        selfCount += 1;
      }
    }
    const selfRate = selfCount > 0 ? selfSum / selfCount : 0;

    // Top cross-vendor target: argmax over edges where from === v.id and
    // to is a different real vendor.
    let top: VendorRow["topConfusion"] = null;
    let topCount = 0;
    for (const e of graph.edges) {
      if (e.from !== v.id) continue;
      if (PSEUDO_VENDORS.has(e.to) || e.to === v.id) continue;
      if (e.count > topCount) {
        topCount = e.count;
        top = {
          vendor: e.to,
          name: vendorNames.get(e.to) ?? e.to,
          logoPath: vendorLogos.get(e.to) ?? null,
          rate: e.total > 0 ? e.count / e.total : 0,
        };
      }
    }

    rows.push({ vendor: v, models, totalAnswers, selfRate, topConfusion: top });
  }

  // Largest fleet first, then worst-self-ID within the same size — surfaces
  // the most informative rows (the ones that move the run-level numbers).
  rows.sort(
    (a, b) =>
      b.models.length - a.models.length || a.selfRate - b.selfRate,
  );
  return rows;
}

function ByVendorCard({ rows }: { rows: VendorRow[] }) {
  return (
    <Card className="py-0">
      <CardHeader className="px-5 py-3">
        <CardTitle className="text-base">By vendor</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Rollup per real vendor — model count, total answers, mean self-ID
          rate, and the most common cross-vendor confusion target.
        </p>
      </CardHeader>
      <CardContent className="px-0 pb-4 pt-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-border bg-muted/40">
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground">
                  Vendor
                </th>
                <th className="px-3 py-2 text-center font-semibold text-muted-foreground">
                  Models
                </th>
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">
                  Answers
                </th>
                <th className="px-3 py-2 text-center font-semibold text-muted-foreground">
                  Self-ID
                </th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                  Top confusion
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const logoPath = row.vendor.logo
                  ? `/maker-logo/${encodeURIComponent(row.vendor.logo)}`
                  : null;
                return (
                  <tr
                    key={row.vendor.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        {logoPath && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={logoPath}
                            alt=""
                            className="size-5 object-contain invert dark:invert-0"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                        <span className="font-medium">{row.vendor.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {row.models.length}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.totalAnswers.toLocaleString()}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-center font-medium tabular-nums",
                        emphasizeRate(row.selfRate),
                      )}
                    >
                      {pct(row.selfRate)}
                    </td>
                    <td className="px-3 py-2">
                      <TopConfusionChip top={row.topConfusion} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function DataAggregate({ graph }: { graph: GraphData }) {
  // Compute each rollup once per graph. The expensive per-vendor card below
  // also memoizes; this keeps the parent page's render budget flat.
  const languageRows = useMemo(() => computeLanguageRows(graph), [graph]);
  const vendorRows = useMemo(() => computeVendorRows(graph), [graph]);

  return (
    <section className="space-y-6">
      <RunSummary graph={graph} />
      {/* Who-fakes-whom — the headline finding, manufacturer level */}
      <ImitationBalanceCard graph={graph} />
      <ConfusionPairsCard graph={graph} />
      {/* The language story */}
      <ByLanguageCard rows={languageRows} />
      <LanguageCompositionCard graph={graph} />
      <LanguageFragilityCard graph={graph} />
      {/* The other failure mode + per-vendor rollup */}
      <AbstentionCard graph={graph} />
      <ByVendorCard rows={vendorRows} />
    </section>
  );
}
