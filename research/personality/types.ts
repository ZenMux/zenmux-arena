export type OejtsDimension = "IE" | "SN" | "FT" | "JP";

export interface OejtsItem {
  id: number;
  dimension: OejtsDimension;
  left: string;
  right: string;
}

export interface OejtsScoringRule {
  const: number;
  signs: Record<string, 1 | -1>;
  highLetter: string;
  lowLetter: string;
  threshold: number;
}

export interface OejtsInstrument {
  instrument: string;
  author: string;
  source: string;
  license: string;
  responseScale: {
    type: "bipolar5";
    "1": string;
    "3": string;
    "5": string;
  };
  items: OejtsItem[];
  scoring: Record<OejtsDimension, OejtsScoringRule>;
}

export interface PersonalityModelSpec {
  /** ZenMux model slug pinned to a provider: `<model>:<provider>`. */
  id: string;
  baseModelId: string;
  manufacturer: string;
  providerSlug: string;
  label: string;
  catalogPublishDate: string;
}

export interface PersonalityConfig {
  study: {
    id: string;
    title: string;
    description?: string;
  };
  catalog: {
    asOf: string;
    source: string;
    selectionRule: string;
  };
  api: {
    baseURL: string;
    apiKeyEnv: string;
    maxTokens: number;
    temperature: number;
    modelConcurrency: number;
    batchSize: number;
    maxRetries: number;
    retryBaseMs: number;
    retryCapMs: number;
  };
  instrument: {
    id: "oejts-1.2";
    path: string;
    language: "en";
    responseScale: 5;
    promptVersion: string;
  };
  repeats: 16;
  classification: {
    minModalCount: number;
    minLetterCount: number;
  };
  models: PersonalityModelSpec[];
}

export interface OejtsAnswer {
  id: number;
  score: number;
}

export interface PersonalityRecord {
  key: string;
  runId: string;
  timestamp: string;
  modelId: string;
  baseModelId: string;
  manufacturer: string;
  providerSlug: string;
  repeat: number;
  instrumentId: string;
  instrumentSha256: string;
  promptVersion: string;
  promptSha256: string;
  generationId: string | null;
  response: string;
  answers?: OejtsAnswer[];
  usage?: { input: number; output: number };
  stopReason?: string | null;
  parseError?: string;
  error?: string;
}

export interface DimensionScore {
  dimension: OejtsDimension;
  score: number;
  threshold: number;
  letter: string;
  boundary: boolean;
  highLetterPercent: number;
}

export interface ScoredAdministration {
  key: string;
  repeat: number;
  type: string;
  dimensions: Record<OejtsDimension, DimensionScore>;
}

export interface DimensionAggregate {
  dimension: OejtsDimension;
  mean: number;
  standardDeviation: number;
  min: number;
  max: number;
  highLetter: string;
  highLetterCount: number;
  lowLetter: string;
  lowLetterCount: number;
  boundaryCount: number;
}

export interface ModelPersonalityAggregate {
  modelId: string;
  baseModelId: string;
  manufacturer: string;
  providerSlug: string;
  label: string;
  n: number;
  typeCounts: Record<string, number>;
  modalType: string | null;
  modalCount: number;
  stableType: string | null;
  status: "stable" | "no_stable_type";
  reasons: string[];
  letterCounts: Record<string, number>;
  dimensions: Record<OejtsDimension, DimensionAggregate>;
  administrations: ScoredAdministration[];
}

export interface PersonalityAggregate {
  runId: string;
  generatedAt: string;
  study: PersonalityConfig["study"];
  instrument: PersonalityConfig["instrument"];
  repeats: number;
  classification: PersonalityConfig["classification"];
  models: ModelPersonalityAggregate[];
}
