// Pool several runs of the same study into one merged ("mix") run.
//
// WHY THIS EXISTS
// ───────────────
// A study is often gathered in stages: a big 26-model run, then a follow-up that
// adds one new model, then a top-up that adds more repeats. Each lives in its own
// timestamped dir. `mix` pools them so you can read ONE final result.
//
// THE MERGE UNIT IS THE PHYSICAL API CALL, NOT THE RESUME KEY.
// The resume key `${modelId}::${langCode}::${repeat}` deliberately does NOT encode
// the run (or the prompt), so two runs of the SAME model produce COLLIDING keys
// (e.g. `minimax/minimax-m3:minimax::en::13` exists in every run that asked it).
// Naively concatenating + dedupe-by-key would silently drop the overlap. Instead we
// pool by `generationId` (the API's `message.id`, globally unique per call) and join
// each answer to its extraction via `sourceGenerationId === generationId`.
//
// THEN WE RE-NUMBER. After pooling, every surviving answer is assigned a FRESH,
// globally-unique resume key by re-numbering `repeat` per (model, lang). Records and
// their extractions are re-keyed IN LOCKSTEP. This makes the merged dir behave like a
// native run for every downstream consumer that still joins by key (aggregate, the
// web browse view, the studio export) — they need no knowledge of the mix. Each row
// keeps its ORIGINAL key + source run in `mixSource` for audit.

import type {
  ExtractionResult,
  LanguageSpec,
  MixManifest,
  MixSourceSummary,
  ModelSpec,
  RawRecord,
  StudyConfig,
  VendorId,
} from "./types";
import { makeKey } from "./ask";
import { DEFAULT_LANGUAGE_NAMES, DEFAULT_LANGUAGE_ORDER } from "./prompts";

/** One source run's loaded, per-run-key-deduped data. */
export interface MixInput {
  /** Source run id, "<study>/<stamp>". */
  run: string;
  records: RawRecord[];
  extractions: ExtractionResult[];
}

export interface MixResult {
  records: RawRecord[];
  extractions: ExtractionResult[];
  /** A validatable StudyConfig describing the union (models × languages × repeats). */
  config: StudyConfig;
  manifest: MixManifest;
}

/**
 * Pool the given source runs into one merged run.
 *
 * @param inputs     Source runs (already deduped within each run by resume key).
 * @param baseConfig A config to seed study/api/extractor metadata from — typically the
 *                   newest source run's pinned snapshot. Its `models`/`languages`/
 *                   `repeats` are REPLACED by the computed union.
 * @param mixRunId   The merged run's own id, "<study>/mix-<stamp>".
 * @param generatedAt ISO timestamp (passed in; the env forbids Date.now in some hosts).
 */
export function mixRuns(
  inputs: MixInput[],
  baseConfig: StudyConfig,
  mixRunId: string,
  generatedAt: string,
): MixResult {
  // ── 1. Pool ANSWERED records by generationId (last-write-wins on collision; there
  //       are none in practice since message.id is unique, but be defensive). ────────
  const recByGen = new Map<string, { rec: RawRecord; run: string }>();
  const sourceSummaries: MixSourceSummary[] = [];

  for (const input of inputs) {
    const answered = input.records.filter((r) => r.response && !r.error && r.generationId);
    const models = new Set<string>();
    const langs = new Set<string>();
    for (const r of answered) {
      models.add(r.modelId);
      langs.add(r.langCode);
      // First run in CLI order wins a genId tie; identical message.id means identical
      // call, so either copy is fine. We keep the first to make the merge order-stable.
      if (!recByGen.has(r.generationId!)) recByGen.set(r.generationId!, { rec: r, run: input.run });
    }
    sourceSummaries.push({
      run: input.run,
      answered: answered.length,
      models: models.size,
      languages: langs.size,
    });
  }

  // ── 2. Pool extractions by sourceGenerationId (the ANSWER they label), keeping a
  //       clean parse over a parseError, else the latest. Dedup here is by the answer,
  //       NOT by extractorGenerationId — re-extracting one answer must not double-count
  //       it. ────────────────────────────────────────────────────────────────────────
  const extByGen = new Map<string, ExtractionResult>();
  for (const input of inputs) {
    for (const e of input.extractions) {
      const src = e.sourceGenerationId;
      if (!src) continue;
      const prev = extByGen.get(src);
      if (!prev) {
        extByGen.set(src, e);
        continue;
      }
      // A clean extraction supersedes a parseError one; otherwise keep the incumbent.
      if (prev.parseError && !e.parseError) extByGen.set(src, e);
    }
  }

  // ── 3. Re-number resume keys per (model, lang), re-keying records + extractions in
  //       lockstep. Iterate in a STABLE order so the merged file is reproducible:
  //       group by (modelId, langCode), then by original run order, then origKey. ─────
  const pooled = [...recByGen.values()];
  pooled.sort((a, b) => {
    const r = a.rec;
    const s = b.rec;
    return (
      r.modelId.localeCompare(s.modelId) ||
      r.langCode.localeCompare(s.langCode) ||
      a.run.localeCompare(b.run) ||
      r.key.localeCompare(s.key)
    );
  });

  const repeatCounter = new Map<string, number>(); // `${modelId}::${langCode}` -> next repeat
  const outRecords: RawRecord[] = [];
  const outExtractions: ExtractionResult[] = [];

  for (const { rec, run } of pooled) {
    const cellKey = `${rec.modelId}::${rec.langCode}`;
    const repeat = repeatCounter.get(cellKey) ?? 0;
    repeatCounter.set(cellKey, repeat + 1);
    const newKey = makeKey(rec.modelId, rec.langCode, repeat);

    const mixSource = { run, origKey: rec.key };
    outRecords.push({ ...rec, key: newKey, runId: mixRunId, mixSource });

    // Carry the matching extraction across with the SAME new key (lockstep).
    const ext = extByGen.get(rec.generationId!);
    if (ext) {
      outExtractions.push({ ...ext, key: newKey, runId: mixRunId, mixSource });
    }
  }

  // ── 4. Build the union config (models, languages) + the prompt-variant audit. ──────
  const { models, languages, promptVariants, warnings } = buildUnion(pooled.map((p) => p.rec));

  // `repeats` must cover the densest cell so the (now-relaxed) gate / enumerateTasks
  // never under-counts; a mix is ragged, so this is an upper bound, not a guarantee.
  const maxRepeat = Math.max(1, ...[...repeatCounter.values()]);

  const config: StudyConfig = {
    ...baseConfig,
    models,
    languages,
    repeats: maxRepeat,
  };

  const manifest: MixManifest = {
    runId: mixRunId,
    generatedAt,
    sources: sourceSummaries,
    totalAnswered: outRecords.length,
    cells: repeatCounter.size,
    promptVariants,
    warnings,
  };

  return { records: outRecords, extractions: outExtractions, config, manifest };
}

/**
 * Compute the model + language union from pooled records, detect cross-prompt mixes,
 * and surface warnings. Model/language display metadata (label, vendor, name, prompt)
 * is taken from the records themselves so we never depend on a source config that may
 * have been edited since.
 */
function buildUnion(records: RawRecord[]): {
  models: ModelSpec[];
  languages: LanguageSpec[];
  promptVariants: Record<string, string[]>;
  warnings: string[];
} {
  // Models: union by id, keep ground-truth vendor; label falls back to id.
  const modelMap = new Map<string, ModelSpec>();
  for (const r of records) {
    if (!modelMap.has(r.modelId)) {
      modelMap.set(r.modelId, { id: r.modelId, vendor: r.modelVendor as VendorId });
    }
  }
  const models = [...modelMap.values()].sort((a, b) => a.id.localeCompare(b.id));

  // Languages: union by code. Track every distinct prompt seen per language; the
  // merged config uses the MOST COMMON prompt for that language as its representative.
  const langPromptCounts = new Map<string, Map<string, number>>();
  for (const r of records) {
    let m = langPromptCounts.get(r.langCode);
    if (!m) {
      m = new Map();
      langPromptCounts.set(r.langCode, m);
    }
    m.set(r.prompt, (m.get(r.prompt) ?? 0) + 1);
  }

  const promptVariants: Record<string, string[]> = {};
  const warnings: string[] = [];
  const languages: LanguageSpec[] = [];

  for (const [code, counts] of langPromptCounts) {
    const variants = [...counts.entries()].sort((a, b) => b[1] - a[1]); // most-common first
    promptVariants[code] = variants.map(([p]) => p);
    const representativePrompt = variants[0][0];
    languages.push({
      code,
      name: DEFAULT_LANGUAGE_NAMES[code] ?? code,
      prompt: representativePrompt,
    });
    if (variants.length > 1) {
      warnings.push(
        `language "${code}": pooled ${variants.length} DISTINCT stimulus prompts ` +
          `(e.g. ${JSON.stringify(variants[0][0]).slice(0, 50)}… vs ` +
          `${JSON.stringify(variants[1][0]).slice(0, 50)}…). Mixing stimulus families — ` +
          `cross-vendor rates are not directly comparable across them.`,
      );
    }
  }

  // Stable language order: canonical order first, then any extras alphabetically.
  languages.sort((a, b) => {
    const ai = DEFAULT_LANGUAGE_ORDER.indexOf(a.code);
    const bi = DEFAULT_LANGUAGE_ORDER.indexOf(b.code);
    const an = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
    const bn = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
    return an - bn || a.code.localeCompare(b.code);
  });

  return { models, languages, promptVariants, warnings };
}
