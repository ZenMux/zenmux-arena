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

/**
 * Classify a record's prompt into one of the three stimulus families.
 *
 * NOTE: a previous version keyed "bare" off `prompt.length < 60`. That measured
 * UTF-16 code units, which is treacherous for CJK: the *probed* prompts in
 * Japanese / Korean / Chinese are short by character count (e.g. the Japanese one
 * is 48 chars) yet carry a full second sentence ("…名前と…会社名を教えてください。").
 * Four languages' probed prompts therefore slipped into the "bare" bucket,
 * inflating bare to 14,040 and starving probed to 4,860. We now classify by
 * CONTENT: a bare prompt is a single question; a probed prompt appends a second
 * sentence after the first terminator. This recovers the true 10,800 / 8,100 /
 * 10,800 split, language-independent.
 */
function variantOf(prompt: string): "bare" | "probed" | "debrand" {
  const p = prompt.trim();
  if (p.startsWith("This is a direct question about your true underlying identity")) return "debrand";
  // First sentence-ending punctuation (incl. full-width CJK forms).
  const m = p.match(/[？?。.！!]/);
  if (m && p.slice(m.index! + 1).trim().length > 0) return "probed";
  return "bare";
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

  // ---- Imitation balance (manufacturer-level): for each TESTED vendor, how
  // often is it imitated (others claim to be it) vs. how often does it imitate
  // (its own models claim a different real vendor). Built from the aggregate's
  // real→real edges, with `other:<brand>` phantom targets folded into the OUT
  // count (a model claiming "Microsoft"/"Yandex" is still imitating an external
  // brand) but never given an IN node (those brands aren't tested). This is the
  // paper twin of the web Data Explorer's ImitationBalanceCard.
  const tested = new Set<string>(g.models.map((m) => m.vendor));
  const inCount: Record<string, number> = {};
  const outCount: Record<string, number> = {};
  for (const e of g.edges) {
    if (e.from === e.to) continue;
    if (PSEUDO.has(e.to) || PSEUDO.has(e.from)) continue; // both real (other:* allowed)
    outCount[e.from] = (outCount[e.from] ?? 0) + e.count; // v imitates someone
    if (!e.to.startsWith("other:")) {
      inCount[e.to] = (inCount[e.to] ?? 0) + e.count; // v is imitated
    }
  }
  const imitationBalance = [...tested]
    .map((v) => {
      const imitated = inCount[v] ?? 0;
      const imitates = outCount[v] ?? 0;
      return { vendor: v, imitated, imitates, net: imitated - imitates };
    })
    .sort((a, b) => b.net - a.net);

  // ---- Imitation DEGREE: the same picture but BINARIZED. Instead of "how many
  // times", we count "how many DISTINCT vendors" — every (from→to) pair that
  // occurs at least once counts as exactly one edge, no matter how many times it
  // fired. This is literally "count the arrows in the relationship graph": a
  // vendor's IN-degree = how many distinct vendors ever claimed to be it; its
  // OUT-degree = how many distinct real vendors it ever claimed to be. We restrict
  // to CANONICAL real↔real edges (the vendors that form the graph ring; `other:*`
  // phantom brands like Microsoft/Yandex are excluded, just as the studio graph
  // hides them). Volume (imitationBalance) says "how loud"; degree says "how
  // scattered" — Tencent's out-degree of 13 means its models have worn 13 hats.
  const inPartners: Record<string, Set<string>> = {};
  const outPartners: Record<string, Set<string>> = {};
  for (const e of g.edges) {
    if (e.from === e.to) continue;
    if (PSEUDO.has(e.to) || PSEUDO.has(e.from)) continue;
    if (String(e.to).startsWith("other:") || String(e.from).startsWith("other:")) continue; // canonical ring only
    if (e.count < 1) continue; // presence/absence: any occurrence is one edge
    (outPartners[e.from] ??= new Set()).add(e.to);
    (inPartners[e.to] ??= new Set()).add(e.from);
  }
  const imitationDegree = [...tested]
    .map((v) => {
      const inDeg = inPartners[v]?.size ?? 0;
      const outDeg = outPartners[v]?.size ?? 0;
      return { vendor: v, inDeg, outDeg, net: inDeg - outDeg };
    })
    .sort((a, b) => b.net - a.net || b.inDeg - a.inDeg);

  // ---- Language fragility: per model, the span of self-rate across languages.
  // A wide span means the model's self-identity is language-dependent (it knows
  // who it is in one tongue but loses it in another). Twin of LanguageFragilityCard.
  const cellsByModel = new Map<string, { lang: string; selfRate: number }[]>();
  for (const c of g.cells) {
    const arr = cellsByModel.get(c.modelId) ?? [];
    arr.push({ lang: c.langCode, selfRate: c.selfRate });
    cellsByModel.set(c.modelId, arr);
  }
  const langFragility = [...cellsByModel.entries()]
    .map(([modelId, cs]) => {
      let min = cs[0];
      let max = cs[0];
      let sum = 0;
      for (const c of cs) {
        if (c.selfRate < min.selfRate) min = c;
        if (c.selfRate > max.selfRate) max = c;
        sum += c.selfRate;
      }
      const range = max.selfRate - min.selfRate;
      return {
        modelId,
        vendor: gtVendor[modelId],
        min: min.selfRate,
        minLang: min.lang,
        max: max.selfRate,
        maxLang: max.lang,
        mean: sum / cs.length,
        range,
      };
    })
    .sort((a, b) => b.range - a.range);

  // ---- Abstention (unknown + refused) per tested vendor, weighted over cells.
  // Twin of AbstentionCard — surfaces inclusionAI (refusal) vs. OpenAI (unknown).
  const absRaw: Record<string, { u: number; r: number; n: number }> = {};
  for (const c of g.cells) {
    const v = gtVendor[c.modelId];
    if (!v) continue;
    const a = (absRaw[v] ??= { u: 0, r: 0, n: 0 });
    a.u += (c.distribution.unknown ?? 0) * c.n;
    a.r += (c.distribution.refused ?? 0) * c.n;
    a.n += c.n;
  }
  const abstention = Object.entries(absRaw)
    .map(([vendor, a]) => ({ vendor, unknown: a.u / a.n, refused: a.r / a.n, total: (a.u + a.r) / a.n }))
    .sort((a, b) => b.total - a.total);

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
    // New manufacturer-level dimensions (paper twins of the web Data Explorer charts).
    imitationBalance,
    imitationDegree,
    langFragility,
    abstention,
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
