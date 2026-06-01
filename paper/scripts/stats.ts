// Compute every derived statistic the paper needs, in ONE pass over the mix,
// and emit paper/figures/stats.json. Both the figure scripts and the LaTeX
// table-generation read this file, so there is a single source of truth and no
// number can drift between a chart and a table.
//
// Run:  npx tsx paper/scripts/stats.ts

import fs from "node:fs";
import path from "node:path";
import {
  AGG_PATH,
  EXTRACTIONS_PATH,
  FIG_DIR,
  loadGraph,
  modelVendors,
  RECORDS_PATH,
  REPO_ROOT,
} from "./figlib";

type Bucket = "self" | "cross" | "refused" | "unknown";
const PSEUDO = new Set(["self", "unknown", "refused"]);

/** Classify a record's prompt into one of the three stimulus families. */
function variantOf(prompt: string): "bare" | "probed" | "debrand" {
  const p = prompt.trim();
  if (p.startsWith("This is a direct question about your true underlying identity")) return "debrand";
  if (p.length < 60) return "bare";
  return "probed";
}

function blankCounts(): Record<Bucket, number> {
  return { self: 0, cross: 0, refused: 0, unknown: 0 };
}

function rate(c: Record<Bucket, number>): Record<string, number> {
  const n = c.self + c.cross + c.refused + c.unknown;
  const f = (x: number) => (n ? x / n : 0);
  return { n, self: f(c.self), cross: f(c.cross), refused: f(c.refused), unknown: f(c.unknown) };
}

function main() {
  const g = loadGraph();
  const gtVendor = modelVendors(g);

  // ---- Pass 1: records -> map generationId to (modelId, vendor, lang, variant)
  interface RecMeta {
    modelId: string;
    vendor: string;
    lang: string;
    variant: "bare" | "probed" | "debrand";
  }
  const recByGid = new Map<string, RecMeta>();
  for (const line of fs.readFileSync(RECORDS_PATH, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    recByGid.set(r.generationId, {
      modelId: r.modelId,
      vendor: r.modelVendor,
      lang: r.langCode,
      variant: variantOf(r.prompt),
    });
  }

  // ---- Pass 2: extractions -> derive the effective bucket per answer
  const byVariant: Record<string, Record<Bucket, number>> = {
    bare: blankCounts(),
    probed: blankCounts(),
    debrand: blankCounts(),
  };
  const byLang: Record<string, Record<Bucket, number>> = {};
  const byVendor: Record<string, Record<Bucket, number>> = {};
  const byModel: Record<string, Record<Bucket, number>> = {};
  const byVendorVariant: Record<string, Record<Bucket, number>> = {}; // key vendor|variant
  // Cross-vendor claim matrix: source vendor -> claimed (real/pseudo) -> count
  const crossMatrix: Record<string, Record<string, number>> = {};

  let total = 0;
  for (const line of fs.readFileSync(EXTRACTIONS_PATH, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const e = JSON.parse(line);
    const meta = recByGid.get(e.sourceGenerationId);
    if (!meta) continue;
    const { modelId, vendor, lang, variant } = meta;
    let claimed: string = e.claimedVendor;
    // `other` (named non-canonical brand) counts as a cross-vendor claim.
    const effective = claimed === vendor ? "self" : claimed;
    const bucket: Bucket =
      effective === "self" ? "self" : effective === "refused" ? "refused" : effective === "unknown" ? "unknown" : "cross";

    total++;
    byVariant[variant][bucket]++;
    (byLang[lang] ??= blankCounts())[bucket]++;
    (byVendor[vendor] ??= blankCounts())[bucket]++;
    (byModel[modelId] ??= blankCounts())[bucket]++;
    (byVendorVariant[`${vendor}|${variant}`] ??= blankCounts())[bucket]++;

    // Cross matrix uses the EFFECTIVE claim (self folded), and folds other:* to "other".
    const claimedNode = effective === "self" ? "self" : effective.startsWith("other:") ? "other" : effective;
    (crossMatrix[vendor] ??= {})[claimedNode] = ((crossMatrix[vendor] ?? {})[claimedNode] ?? 0) + 1;
  }

  // ---- Shape the output
  const out = {
    meta: {
      runId: g.runId,
      generatedAt: g.generatedAt,
      totalAnswers: g.summary.totalAnswers,
      nModels: g.models.length,
      nVendors: Object.keys(byVendor).length,
      nLanguages: g.languages.length,
    },
    summary: {
      overallSelfRate: g.summary.overallSelfRate,
      confusionRate: g.summary.confusionRate,
      refusedRate: g.summary.refusedRate,
      unknownRate: g.summary.unknownRate,
    },
    byVariant: Object.fromEntries(Object.entries(byVariant).map(([k, v]) => [k, rate(v)])),
    byLang: Object.fromEntries(Object.entries(byLang).map(([k, v]) => [k, rate(v)])),
    byVendor: Object.fromEntries(Object.entries(byVendor).map(([k, v]) => [k, rate(v)])),
    byModel: Object.fromEntries(Object.entries(byModel).map(([k, v]) => [k, rate(v)])),
    byVendorVariant: Object.fromEntries(Object.entries(byVendorVariant).map(([k, v]) => [k, rate(v)])),
    crossMatrix,
    // Cross-vendor edges (real source -> real different vendor), from the aggregate.
    crossEdges: g.edges
      .filter((e) => e.from !== e.to && !PSEUDO.has(e.to) && e.to !== "other")
      .map((e) => ({
        from: e.from,
        to: e.to,
        count: e.count,
        total: e.total,
        probability: e.probability,
        byLang: Object.fromEntries(
          Object.entries(e.byLang ?? {}).map(([c, b]) => [c, { count: b.count, total: b.total, p: b.total ? b.count / b.total : 0 }]),
        ),
        byModel: Object.fromEntries(
          Object.entries(e.byModel ?? {}).map(([m, b]) => [m, { count: b.count, total: b.total, p: b.total ? b.count / b.total : 0 }]),
        ),
      }))
      .sort((a, b) => b.count - a.count),
  };

  fs.mkdirSync(FIG_DIR, { recursive: true });
  const dest = path.join(FIG_DIR, "stats.json");
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(`wrote ${path.relative(REPO_ROOT, dest)}  (joined ${total} answers from ${AGG_PATH.split("/").slice(-2)[0]})`);
  // Quick sanity echo
  console.log("  variant gradient (self/cross/refused):");
  for (const v of ["bare", "probed", "debrand"]) {
    const r = out.byVariant[v];
    console.log(`    ${v.padEnd(8)} n=${r.n}  self ${(r.self * 100).toFixed(1)}%  cross ${(r.cross * 100).toFixed(1)}%  refused ${(r.refused * 100).toFixed(1)}%`);
  }
}

main();
