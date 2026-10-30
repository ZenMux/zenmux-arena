import type { GraphData, VendorId } from "@research/lib/types";

export type IdentityView = "method" | "overview" | "prompts" | "languages" | "graph" | "cases" | "models";
export type PromptFamily = "bare" | "probed" | "unbranded";
export type IdentityOutcome = "self" | "cross" | "refused" | "unknown";

/** Counts, never rounded percentages. All four categories share the same denominator. */
export interface IdentityCounts {
  n: number;
  self: number;
  cross: number;
  refused: number;
  unknown: number;
}

export interface IdentityEvidence {
  id: string;
  sourceRun: string;
  sourceKey: string;
  generationId: string;
  timestamp: string;
  modelId: string;
  lang: string;
  family: PromptFamily;
  prompt: string;
  response: string;
  excerpted: boolean;
  outcome: IdentityOutcome;
  claimedVendor: string;
  extractor: string;
  uses: string[];
}

export interface IdentityRow {
  id: string;
  label: string;
  vendor: VendorId;
  counts: IdentityCounts;
  languages: Record<string, IdentityCounts>;
}

export interface IdentityVariant {
  id: PromptFamily;
  label: string;
  description: string;
  sourceRuns: string[];
  prompts: Record<string, string>;
  repeatsPerModelLanguage: number;
  counts: IdentityCounts;
  languages: Record<string, IdentityCounts>;
  models: IdentityRow[];
}

/** The entire RSC boundary: plain JSON, aggregated data + a bounded evidence sample. */
export interface IdentityTalkData {
  runId: string;
  generatedAt: string;
  experimentalWindow: { from: string; to: string };
  graph: GraphData;
  counts: IdentityCounts;
  languages: { code: string; name: string; nativeName: string; counts: IdentityCounts }[];
  models: IdentityRow[];
  vendors: IdentityRow[];
  variants: IdentityVariant[];
  evidence: IdentityEvidence[];
  stableModelIds: string[];
  /** Collection cohort per model id: the 2026-05/06 runs or the 2026-10 runs (disjoint rosters). */
  modelCohorts: Record<string, "2026-05/06" | "2026-10">;
  /** ZenMux `publish_time` (YYYY-MM-DD) per model id, frozen in `release.json`. */
  modelReleases: Record<string, { publishTime: string; source: "live" | "archive-20260617" }>;
  releaseSource: { url: string; fetchedAt: string };
  sources: { run: string; answered: number; family: PromptFamily }[];
  methodology: {
    extractor: string;
    snapshot: string;
    languageCaveat: string;
    cacheCaveat: string;
  };
}
