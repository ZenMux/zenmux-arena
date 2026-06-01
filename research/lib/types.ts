// Single source of truth for all data structures used across the study pipeline.
// "Who Are You?" — Cross-Vendor Identity Confusion in Frontier LLMs.

// ---------------------------------------------------------------------------
// Canonical vendor taxonomy
// ---------------------------------------------------------------------------

/**
 * A canonical vendor identifier. Real vendors map to a logo under
 * `public/maker-logo/`. The three pseudo-vendors are analytical buckets:
 *  - `self`    : the model correctly claimed its own vendor (derived in aggregation)
 *  - `unknown` : answered but no identifiable vendor ("I am an AI assistant")
 *  - `refused` : refused / empty / no identity at all
 */
export type VendorId =
  | "anthropic"
  | "openai"
  | "google"
  | "deepseek"
  | "qwen"
  | "baidu"
  | "bytedance"
  | "moonshot"
  | "z-ai"
  | "stepfun"
  | "x-ai"
  | "minimax"
  | "kwai"
  | "xiaomi"
  | "tencent"
  | "inclusionai"
  | "meta"
  | "mistral"
  | "agnes"
  | "self"
  | "unknown"
  | "refused"
  | "other"
  // Discovered vendor ids are slugified from a free-text brand the extractor named
  // (e.g. "yandex"). They are valid VendorIds at runtime even though they are not
  // listed in this union — the union just enumerates known statics.
  | (string & {});

/**
 * Vendors the extractor is allowed to return: the canonical set, plus the two
 * analytical buckets, plus `other` (which carries a free-text brand name in
 * `claimedVendorOther`, materialized into a dynamic vendor at aggregate time).
 */
export type ClaimedVendor = Exclude<VendorId, "self">;

export interface VendorMeta {
  id: VendorId;
  /** Display name, e.g. "Anthropic". */
  name: string;
  /** Filename under `public/maker-logo/` (may contain spaces). Empty for pseudo-vendors. */
  logo: string;
  /** Lowercased substrings the extractor / model might emit that map to this vendor. */
  aliases: string[];
}

// ---------------------------------------------------------------------------
// Config (parsed from config/study.yaml)
// ---------------------------------------------------------------------------

export interface StudyMeta {
  id: string;
  title: string;
  description?: string;
}

export interface ApiConfig {
  /** ZenMux Anthropic-compatible endpoint, e.g. "https://zenmux.ai/api/anthropic". */
  baseURL: string;
  /** Name of the env var holding the API key, e.g. "ZENMUX_API_KEY". */
  apiKeyEnv: string;
  /** max_tokens for the answer models. */
  maxTokens: number;
  /** How many models run in parallel (set >= model count to run all at once). */
  modelConcurrency: number;
  /** Requests fired concurrently per batch, within one model+language. */
  batchSize: number;
  /** Max retry attempts on transient errors (per call). */
  maxRetries: number;
  /** Base backoff in ms (exponential w/ full jitter). */
  retryBaseMs: number;
  /** Backoff cap in ms. */
  retryCapMs: number;
}

export interface ModelSpec {
  /** ZenMux model id, e.g. "anthropic/claude-opus-4.8". */
  id: string;
  /** Ground-truth vendor this model actually belongs to. */
  vendor: VendorId;
  /** Display label, e.g. "Claude Opus 4.8". Defaults to `id`. */
  label?: string;
}

export interface LanguageSpec {
  /** Stable key: "en","zh-Hans","zh-Hant","ja","ko","ru","es","fr","de","pt". */
  code: string;
  /** Native display name, e.g. "简体中文". */
  name: string;
  /** Hardcoded translation of "Who are you?". */
  prompt: string;
}

export interface ExtractorConfig {
  model: string;
  maxTokens: number;
}

export interface StudyConfig {
  study: StudyMeta;
  api: ApiConfig;
  models: ModelSpec[];
  extractor: ExtractorConfig;
  languages: LanguageSpec[];
  repeats: number;
}

// ---------------------------------------------------------------------------
// Raw record (one answer from one model in one language)
// ---------------------------------------------------------------------------

export interface RawRecord {
  /** `${modelId}::${langCode}::${repeat}` — the resume key shared by both passes. */
  key: string;
  runId: string;
  /** ISO8601 timestamp of when the answer returned. */
  timestamp: string;
  /** `message.id` from the API response, or null on error. */
  generationId: string | null;
  modelId: string;
  /** Ground-truth vendor of the model under test. */
  modelVendor: VendorId;
  langCode: string;
  /** Exact prompt sent. */
  prompt: string;
  /** Full concatenated text content of the answer. */
  response: string;
  usage?: { input: number; output: number };
  /** Set if the call failed after all retries (response will be ""). */
  error?: string;
}

// ---------------------------------------------------------------------------
// Extraction result (identity claimed by one answer)
// ---------------------------------------------------------------------------

export interface ExtractionResult {
  key: string;
  runId: string;
  timestamp: string;
  extractorModel: string;
  /**
   * `message.id` of the answer record this extraction was run over — copied
   * verbatim from RawRecord.generationId so each extraction row is self-contained
   * for manual audit (one jsonl line = one full trace).
   */
  sourceGenerationId: string | null;
  /** `message.id` returned by the extractor's own API call (for audit of the labeler). */
  extractorGenerationId: string | null;
  /** Canonical vendor the answer claims to be (real vendor | unknown | refused | other). */
  claimedVendor: ClaimedVendor;
  /**
   * When `claimedVendor === "other"`, the brand name the extractor identified
   * (e.g. "Yandex", "Mistral", "Cohere"). Aggregation slugifies this into a
   * dynamic vendor node. Null for all other cases.
   */
  claimedVendorOther?: string | null;
  /** Verbatim model/company name string the response claimed, or null. */
  claimedModelText: string | null;
  /** 0..1 confidence reported by the extractor. */
  confidence: number;
  /** One-sentence justification from the extractor. */
  rationale: string;
  /** Verbatim extractor output, for audit / re-mapping. */
  rawExtractorOutput: string;
  /** Set if JSON parse/validation failed (a salvage value may still be present). */
  parseError?: string;
}

// ---------------------------------------------------------------------------
// Aggregated graph data
// ---------------------------------------------------------------------------

export interface EdgeBreakdown {
  count: number;
  total: number;
}

export interface Edge {
  /** The model's true vendor. */
  from: VendorId;
  /** The claimed vendor (may be `self`/`unknown`/`refused`). */
  to: VendorId;
  /** Occurrences across all (model, lang, repeat). */
  count: number;
  /** Denominator: all answered records for `from`. */
  total: number;
  /** count / total. */
  probability: number;
  /** Per-model breakdown (modelId -> {count,total}). */
  byModel?: Record<string, EdgeBreakdown>;
  /** Per-language breakdown (langCode -> {count,total}). */
  byLang?: Record<string, EdgeBreakdown>;
}

export interface ModelLangCell {
  modelId: string;
  langCode: string;
  /** Effective-claimed-vendor -> probability (includes `self`). */
  distribution: Partial<Record<VendorId, number>>;
  /** P(correct self-identification). */
  selfRate: number;
  /** Answers counted (≈ repeats). */
  n: number;
}

export interface StudySummary {
  totalAnswers: number;
  /** Fraction of answers that correctly self-identified. */
  overallSelfRate: number;
  /** Fraction claiming a DIFFERENT real vendor. */
  confusionRate: number;
  unknownRate: number;
  refusedRate: number;
  errorCount: number;
  /** Answered records that had NO extraction and were counted as `unknown`. */
  missingExtraction: number;
  perModelSelfRate: Record<string, number>;
  perLangSelfRate: Record<string, number>;
}

export interface GraphData {
  runId: string;
  generatedAt: string;
  study: StudyMeta;
  /** Models under test (for labels / per-model tables). */
  models: ModelSpec[];
  languages: LanguageSpec[];
  /** Vendors that appear as graph nodes, with metadata. */
  vendors: VendorMeta[];
  edges: Edge[];
  cells: ModelLangCell[];
  summary: StudySummary;
}
