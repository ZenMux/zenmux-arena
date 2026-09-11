import type { GraphData, VendorId } from "@research/lib/types";

export type IdentityView = "method" | "overview" | "prompts" | "languages" | "graph" | "cases";
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
  sources: { run: string; answered: number; family: PromptFamily }[];
  methodology: {
    extractor: string;
    snapshot: string;
    languageCaveat: string;
    cacheCaveat: string;
  };
}
