// Server-only data layer for the raw-answer browser.
//
// Joins a run's records.jsonl (the answers) with its extractions.jsonl (the
// identity labels) by the shared resume key `${modelId}::${lang}::${repeat}`,
// groups the result by model → language, and enriches labels / language names /
// vendor display from the run's aggregate.json when present (falling back to
// the raw record fields so the browser works even before aggregation).
//
// Parsing the two multi-MB JSONL files is memoized by file mtime, so switching
// between models (which re-renders this server component) does not re-read disk.

import fs from "node:fs";
import path from "node:path";
import { dedupeByKey, loadJsonl, RESULTS_ROOT } from "@research/lib/store";
import { DEFAULT_LANGUAGE_NAMES, DEFAULT_LANGUAGE_ORDER } from "@research/lib/prompts";
import { isPseudoVendor, logoWebPath, VENDORS } from "@research/lib/vendors";
import { vendorColor } from "@research/lib/geometry";
import type {
  ExtractionResult,
  GraphData,
  RawRecord,
  VendorId,
  VendorMeta,
} from "@research/lib/types";

export interface RunRef {
  id: string; // "<study>/<stamp>"
  study: string;
  stamp: string;
}

/** How a vendor id is shown in the UI: display name, logo URL (or null), accent color. */
export interface VendorDisplay {
  id: VendorId;
  name: string;
  logo: string | null;
  color: string;
}

export interface JoinedAnswer {
  key: string;
  repeat: number;
  langCode: string;
  response: string;
  usage?: { input: number; output: number };
  error?: string;
  extraction: ExtractionResult | null;
  /** Effective claimed vendor (`self` when the claim matches the model's true vendor). */
  effective: VendorDisplay | null;
}

export interface LangGroup {
  code: string;
  name: string;
  n: number;
  selfCount: number;
  /** Effective-claimed tally, strongest first — drives the group header summary. */
  dist: { display: VendorDisplay; count: number }[];
  answers: JoinedAnswer[];
}

export interface ModelEntry {
  id: string;
  label: string;
  vendor: VendorDisplay;
  n: number;
  selfCount: number;
  selfRate: number;
  langs: LangGroup[];
}

export interface RunData {
  ref: RunRef;
  models: ModelEntry[];
  totalAnswers: number;
}

/** All runs that have a records.jsonl, newest stamp first. */
export function discoverRuns(): RunRef[] {
  if (!fs.existsSync(RESULTS_ROOT)) return [];
  const out: RunRef[] = [];
  for (const study of fs.readdirSync(RESULTS_ROOT)) {
    const studyDir = path.join(RESULTS_ROOT, study);
    if (!fs.statSync(studyDir).isDirectory()) continue;
    for (const stamp of fs.readdirSync(studyDir)) {
      const records = path.join(studyDir, stamp, "records.jsonl");
      if (fs.existsSync(records)) out.push({ id: `${study}/${stamp}`, study, stamp });
    }
  }
  // Stamps are sortable timestamps → reverse-lexical = newest first.
  return out.sort((a, b) => b.stamp.localeCompare(a.stamp));
}

const RUN_RE = /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/;

function mtimeOf(file: string): number {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

// Memoize the (expensive) parse+join per run, invalidated when either source
// file changes on disk. Survives across requests in the same server process.
const cache = new Map<string, { sig: string; data: RunData }>();

/**
 * Load + join one run. Returns null for an invalid/unknown run id or one with
 * no records.jsonl. `run` is "<study>/<stamp>".
 */
export function loadRunData(run: string): RunData | null {
  if (!RUN_RE.test(run)) return null;
  const dir = path.resolve(RESULTS_ROOT, run);
  if (dir !== RESULTS_ROOT && !dir.startsWith(RESULTS_ROOT + path.sep)) return null;

  const recordsFile = path.join(dir, "records.jsonl");
  const extractionsFile = path.join(dir, "extractions.jsonl");
  const aggregateFile = path.join(dir, "aggregate.json");
  if (!fs.existsSync(recordsFile)) return null;

  const sig = `${mtimeOf(recordsFile)}:${mtimeOf(extractionsFile)}:${mtimeOf(aggregateFile)}`;
  const hit = cache.get(run);
  if (hit && hit.sig === sig) return hit.data;

  const data = build(run, recordsFile, extractionsFile, aggregateFile);
  cache.set(run, { sig, data });
  return data;
}

function build(
  run: string,
  recordsFile: string,
  extractionsFile: string,
  aggregateFile: string,
): RunData {
  const [study, stamp] = run.split("/");
  const records = [...dedupeByKey(loadJsonl<RawRecord>(recordsFile)).values()];
  const extByKey = dedupeByKey(loadJsonl<ExtractionResult>(extractionsFile));

  // Optional aggregate enrichment (labels, language names, materialized other:* brands).
  let aggregate: GraphData | null = null;
  try {
    if (fs.existsSync(aggregateFile)) {
      aggregate = JSON.parse(fs.readFileSync(aggregateFile, "utf8")) as GraphData;
    }
  } catch {
    aggregate = null;
  }

  const modelLabel = new Map<string, string>();
  for (const m of aggregate?.models ?? []) modelLabel.set(m.id, m.label ?? m.id);

  const langName = new Map<string, string>();
  for (const [code, name] of Object.entries(DEFAULT_LANGUAGE_NAMES)) langName.set(code, name);
  for (const l of aggregate?.languages ?? []) langName.set(l.code, l.name);

  // Vendor metadata: canonical statics + any dynamic other:* brands from aggregate.
  const vendorMeta = new Map<VendorId, VendorMeta>();
  for (const v of aggregate?.vendors ?? []) vendorMeta.set(v.id, v);

  const display = (id: VendorId): VendorDisplay => {
    const meta = VENDORS[id] ?? vendorMeta.get(id);
    const logo =
      logoWebPath(id) ?? (meta?.logo ? `/maker-logo/${encodeURIComponent(meta.logo)}` : null);
    const name = id === "self" ? "Self (correct)" : meta?.name ?? String(id);
    return { id, name, logo, color: vendorColor(id) };
  };

  // Effective claimed vendor for one answer: `self` when the claim matches the
  // model's true vendor; `other` resolves to the named brand; null when unextracted.
  const SELF: VendorDisplay = { id: "self", name: "Self (correct)", logo: null, color: "#16a34a" };
  const effectiveOf = (ext: ExtractionResult | null, modelVendor: VendorId): VendorDisplay | null => {
    if (!ext) return null;
    const claimed: VendorId = ext.claimedVendor;
    if (claimed === "other") {
      const brand = ext.claimedVendorOther?.trim();
      // Match the aggregation rule: a nameless "other" collapses to unknown.
      if (!brand) return display("unknown");
      // Reuse the aggregate's materialized brand node when present (gives logo, if any).
      const found = (aggregate?.vendors ?? []).find((v) => v.name === brand);
      return found ? display(found.id) : { id: `other:${brand}`, name: brand, logo: null, color: vendorColor(brand) };
    }
    if (claimed === modelVendor) return SELF;
    return display(claimed);
  };

  // Group records by model, then language.
  interface ModelAcc {
    id: string;
    vendor: VendorId;
    byLang: Map<string, JoinedAnswer[]>;
    firstSeen: number;
  }
  const byModel = new Map<string, ModelAcc>();
  let order = 0;
  for (const r of records) {
    let acc = byModel.get(r.modelId);
    if (!acc) {
      acc = { id: r.modelId, vendor: r.modelVendor, byLang: new Map(), firstSeen: order++ };
      byModel.set(r.modelId, acc);
    }
    const ext = extByKey.get(r.key) ?? null;
    const repeat = Number(r.key.split("::").pop());
    const ans: JoinedAnswer = {
      key: r.key,
      repeat: Number.isFinite(repeat) ? repeat : 0,
      langCode: r.langCode,
      response: r.response,
      usage: r.usage,
      error: r.error,
      extraction: ext,
      effective: effectiveOf(ext, r.modelVendor),
    };
    const list = acc.byLang.get(r.langCode) ?? [];
    list.push(ans);
    acc.byLang.set(r.langCode, list);
  }

  // Model display order: aggregate's config order first, then any extras by first-seen.
  const aggOrder = new Map<string, number>();
  (aggregate?.models ?? []).forEach((m, i) => aggOrder.set(m.id, i));
  const accs = [...byModel.values()].sort((a, b) => {
    const ai = aggOrder.has(a.id) ? aggOrder.get(a.id)! : 1e6 + a.firstSeen;
    const bi = aggOrder.has(b.id) ? aggOrder.get(b.id)! : 1e6 + b.firstSeen;
    return ai - bi;
  });

  // Language display order: aggregate's order if present, else DEFAULT_LANGUAGE_ORDER.
  const langOrder = new Map<string, number>();
  if (aggregate?.languages) {
    aggregate.languages.forEach((l, i) => langOrder.set(l.code, i));
  } else {
    DEFAULT_LANGUAGE_ORDER.forEach((code, i) => langOrder.set(code, i));
  }

  let totalAnswers = 0;
  const models: ModelEntry[] = accs.map((acc) => {
    const langs: LangGroup[] = [...acc.byLang.entries()]
      .map(([code, answers]): LangGroup => {
        answers.sort((a, b) => a.repeat - b.repeat);
        let selfCount = 0;
        const tally = new Map<VendorId, { display: VendorDisplay; count: number }>();
        for (const a of answers) {
          const d = a.effective;
          if (!d) continue;
          if (d.id === "self") selfCount++;
          const t = tally.get(d.id);
          if (t) t.count++;
          else tally.set(d.id, { display: d, count: 1 });
        }
        const dist = [...tally.values()].sort((x, y) => {
          // self first, then by count desc.
          if (x.display.id === "self" && y.display.id !== "self") return -1;
          if (y.display.id === "self" && x.display.id !== "self") return 1;
          return y.count - x.count;
        });
        return { code, name: langName.get(code) ?? code, n: answers.length, selfCount, dist, answers };
      })
      .sort((a, b) => {
        const ai = langOrder.has(a.code) ? langOrder.get(a.code)! : 1e6;
        const bi = langOrder.has(b.code) ? langOrder.get(b.code)! : 1e6;
        return ai - bi || a.code.localeCompare(b.code);
      });

    const n = langs.reduce((s, l) => s + l.n, 0);
    const selfCount = langs.reduce((s, l) => s + l.selfCount, 0);
    totalAnswers += n;
    return {
      id: acc.id,
      label: modelLabel.get(acc.id) ?? acc.id,
      vendor: display(acc.vendor),
      n,
      selfCount,
      selfRate: n ? selfCount / n : 0,
      langs,
    };
  });

  return { ref: { id: run, study, stamp }, models, totalAnswers };
}

/** True for analytical buckets (`unknown`/`refused`) so the UI can style them muted. */
export function isBucket(id: VendorId): boolean {
  return isPseudoVendor(id) && id !== "other";
}
