import type {
  DimensionAggregate,
  OejtsDimension,
  OejtsInstrument,
} from "@research/personality/types";

export type MbtiView = "method" | "overview" | "gallery" | "explorer" | "stability" | "dimensions";
export type MbtiDimension = OejtsDimension;

export interface MbtiModel {
  id: string;
  name: string;
  provider: string;
  logo: string;
  n: number;
  status: "stable" | "no_stable_type";
  stableType: string | null;
  modalType: string | null;
  modalCount: number;
  reasons: string[];
  distribution: { type: string; count: number; illustration: string }[];
  letterCounts: Record<string, number>;
  dimensions: Record<MbtiDimension, DimensionAggregate>;
  replicates: {
    repeat: number;
    type: string;
    scores: Record<MbtiDimension, number>;
  }[];
}

/** Plain JSON only: safe to pass once from the talk's server page to its client shell. */
export interface MbtiTalkData {
  runId: string;
  generatedAt: string;
  repeats: number;
  classification: { minModalCount: number };
  instrument: OejtsInstrument;
  models: MbtiModel[];
  summary: {
    modelCount: number;
    questionnaireCount: number;
    stableCount: number;
    unstableCount: number;
    unanimousCount: number;
    stableGroups: { type: string; count: number; modelIds: string[]; illustration: string }[];
    onlySnVariationCount: number;
    dimensionVariations: { dimension: MbtiDimension; count: number }[];
  };
  runNotes: { title: string; detail: string }[];
}
