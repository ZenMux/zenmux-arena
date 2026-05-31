// Join raw records + extractions into GraphData (edges, per-cell distributions, summary).

import type {
  Edge,
  ExtractionResult,
  GraphData,
  ModelLangCell,
  RawRecord,
  StudyConfig,
  VendorId,
  VendorMeta,
} from "./types";
import { makeOtherVendorMeta, VENDORS } from "./vendors";

// Used for the confusion-rate denominator: a claim is "confusion" only if it's a
// real DIFFERENT vendor — never self, and never the no-identity buckets.
const PSEUDO: VendorId[] = ["self", "unknown", "refused"];

// Aggregates that are NOT placed on the ring as nodes. `unknown`/`refused` ARE
// now drawable nodes (opt-in in the picker), so only `self` (the derived
// correct-claim bucket) and the bare `other` parent are excluded here.
const NON_NODE: VendorId[] = ["self", "other"];

/** Effective claimed vendor: `self` if the claim matches the model's true vendor. */
function effectiveClaimed(claimed: VendorId, modelVendor: VendorId): VendorId {
  if (claimed === modelVendor) return "self";
  return claimed;
}

interface Joined {
  record: RawRecord;
  claimed: VendorId; // raw claimed vendor (unknown/refused/real)
  effective: VendorId; // self | unknown | refused | real-other
}

export function aggregate(
  cfg: StudyConfig,
  records: RawRecord[],
  extractions: ExtractionResult[],
  runId: string,
  generatedAt: string,
): GraphData {
  const extByKey = new Map(extractions.map((e) => [e.key, e]));

  const answered = records.filter((r) => r.response && !r.error);
  const errorCount = records.filter((r) => r.error).length;

  // Dynamic brand registry: extractor-discovered vendors named via
  // `claimedVendorOther` are materialized as `other:<slug>` nodes so they
  // appear as named circles in the graph instead of being lumped into "unknown".
  // We pick the canonical display name as the first non-empty form seen for a
  // given slug (subsequent variants like "Yandex." / "yandex" collapse to it).
  const otherVendors = new Map<VendorId, VendorMeta>();
  const registerOther = (rawName: string | null | undefined): VendorId | null => {
    if (!rawName) return null;
    const trimmed = rawName.trim();
    if (!trimmed) return null;
    const meta = makeOtherVendorMeta(trimmed);
    if (!otherVendors.has(meta.id)) otherVendors.set(meta.id, meta);
    return meta.id;
  };

  const joined: Joined[] = [];
  for (const record of answered) {
    const ext = extByKey.get(record.key);
    if (!ext) continue; // not yet extracted
    let claimed: VendorId = ext.claimedVendor;
    if (claimed === "other") {
      const dyn = registerOther(ext.claimedVendorOther);
      // If the extractor said "other" but failed to name a brand, treat as unknown
      // rather than letting a nameless dynamic node into the graph.
      claimed = dyn ?? "unknown";
    }
    joined.push({ record, claimed, effective: effectiveClaimed(claimed, record.modelVendor) });
  }

  const total = joined.length;

  // ----- Edges: from = true vendor, to = effective claimed. -----
  // Denominator per `from` vendor = all joined answers for that vendor.
  const fromTotals = new Map<VendorId, number>();
  for (const j of joined) {
    fromTotals.set(j.record.modelVendor, (fromTotals.get(j.record.modelVendor) ?? 0) + 1);
  }

  const edgeMap = new Map<string, Edge>();
  for (const j of joined) {
    const from = j.record.modelVendor;
    const to = j.effective;
    const ek = `${from}->${to}`;
    let edge = edgeMap.get(ek);
    if (!edge) {
      edge = { from, to, count: 0, total: fromTotals.get(from) ?? 0, probability: 0, byModel: {}, byLang: {} };
      edgeMap.set(ek, edge);
    }
    edge.count++;
    const bm = (edge.byModel![j.record.modelId] ??= { count: 0, total: 0 });
    bm.count++;
    const bl = (edge.byLang![j.record.langCode] ??= { count: 0, total: 0 });
    bl.count++;
  }
  // Fill byModel/byLang totals and probabilities.
  const modelTotals = countBy(joined, (j) => j.record.modelId);
  const langTotalsByFrom = new Map<string, number>(); // key: from|lang
  for (const j of joined) {
    const k = `${j.record.modelVendor}|${j.record.langCode}`;
    langTotalsByFrom.set(k, (langTotalsByFrom.get(k) ?? 0) + 1);
  }
  for (const edge of edgeMap.values()) {
    edge.probability = edge.total ? edge.count / edge.total : 0;
    for (const [mid, b] of Object.entries(edge.byModel!)) b.total = modelTotals.get(mid) ?? 0;
    for (const [lc, b] of Object.entries(edge.byLang!)) {
      b.total = langTotalsByFrom.get(`${edge.from}|${lc}`) ?? 0;
    }
  }
  const edges = [...edgeMap.values()].sort((a, b) => b.probability - a.probability);

  // ----- Per (model, language) cells. -----
  const cellMap = new Map<string, { dist: Map<VendorId, number>; n: number; self: number }>();
  for (const j of joined) {
    const ck = `${j.record.modelId}|${j.record.langCode}`;
    let cell = cellMap.get(ck);
    if (!cell) {
      cell = { dist: new Map(), n: 0, self: 0 };
      cellMap.set(ck, cell);
    }
    cell.n++;
    cell.dist.set(j.effective, (cell.dist.get(j.effective) ?? 0) + 1);
    if (j.effective === "self") cell.self++;
  }
  const cells: ModelLangCell[] = [];
  for (const [ck, cell] of cellMap) {
    const [modelId, langCode] = ck.split("|");
    const distribution: Partial<Record<VendorId, number>> = {};
    for (const [v, c] of cell.dist) distribution[v] = c / cell.n;
    cells.push({ modelId, langCode, distribution, selfRate: cell.n ? cell.self / cell.n : 0, n: cell.n });
  }

  // ----- Summary metrics. -----
  const selfCount = joined.filter((j) => j.effective === "self").length;
  const unknownCount = joined.filter((j) => j.effective === "unknown").length;
  const refusedCount = joined.filter((j) => j.effective === "refused").length;
  const confusionCount = joined.filter(
    (j) => j.effective !== "self" && !PSEUDO.includes(j.effective),
  ).length;

  const perModelSelfRate = ratioBy(
    joined,
    (j) => j.record.modelId,
    (j) => j.effective === "self",
  );
  const perLangSelfRate = ratioBy(
    joined,
    (j) => j.record.langCode,
    (j) => j.effective === "self",
  );

  // ----- Vendor nodes that appear in the graph. -----
  const nodeIds = new Set<VendorId>();
  for (const edge of edges) {
    nodeIds.add(edge.from);
    if (!NON_NODE.includes(edge.to)) nodeIds.add(edge.to);
  }
  for (const m of cfg.models) nodeIds.add(m.vendor);
  const vendors: VendorMeta[] = [...nodeIds]
    .map((id) => VENDORS[id] ?? otherVendors.get(id))
    .filter(Boolean) as VendorMeta[];

  return {
    runId,
    generatedAt,
    study: cfg.study,
    models: cfg.models,
    languages: cfg.languages,
    vendors,
    edges,
    cells,
    summary: {
      totalAnswers: total,
      overallSelfRate: total ? selfCount / total : 0,
      confusionRate: total ? confusionCount / total : 0,
      unknownRate: total ? unknownCount / total : 0,
      refusedRate: total ? refusedCount / total : 0,
      errorCount,
      perModelSelfRate,
      perLangSelfRate,
    },
  };
}

// ---- small helpers ----

function countBy<T>(items: T[], key: (t: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return m;
}

function ratioBy<T>(
  items: T[],
  key: (t: T) => string,
  hit: (t: T) => boolean,
): Record<string, number> {
  const num = new Map<string, number>();
  const den = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    den.set(k, (den.get(k) ?? 0) + 1);
    if (hit(it)) num.set(k, (num.get(k) ?? 0) + 1);
  }
  const out: Record<string, number> = {};
  for (const [k, d] of den) out[k] = d ? (num.get(k) ?? 0) / d : 0;
  return out;
}
