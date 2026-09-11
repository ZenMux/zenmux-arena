import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { PersonalityConfig } from "./types";

export const DEFAULT_PERSONALITY_CONFIG = "config/personality-oejts.yaml";

function fail(message: string): never {
  throw new Error(`[personality-config] ${message}`);
}

function absolute(configPath: string): string {
  return path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
}

export function bootstrapPersonalityStudyId(configPath = DEFAULT_PERSONALITY_CONFIG): string {
  const parsed = YAML.parse(fs.readFileSync(absolute(configPath), "utf8")) as {
    study?: { id?: unknown };
  };
  if (typeof parsed?.study?.id !== "string" || !parsed.study.id) fail("study.id is required");
  return parsed.study.id;
}

export function loadPersonalityConfig(
  configPath = DEFAULT_PERSONALITY_CONFIG,
  requireApiKey = false,
): PersonalityConfig {
  const fullPath = absolute(configPath);
  if (!fs.existsSync(fullPath)) fail(`config file not found: ${fullPath}`);

  let parsed: unknown;
  try {
    parsed = YAML.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    fail(`failed to parse YAML: ${(error as Error).message}`);
  }
  const config = parsed as PersonalityConfig;

  if (!config.study?.id || !config.study.title) fail("study.id and study.title are required");
  if (!config.catalog?.asOf || !config.catalog.source) fail("catalog snapshot metadata is required");
  if (!config.api?.baseURL || !config.api.apiKeyEnv) fail("api.baseURL and api.apiKeyEnv are required");
  // Existing run snapshots must keep their original protocol when resumed.
  config.api.protocol ??= "messages";
  if (!["responses", "messages"].includes(config.api.protocol)) {
    fail("api.protocol must be responses or messages");
  }
  const baseURL = new URL(config.api.baseURL);
  if (config.api.protocol === "responses" && /\/anthropic\/?$/.test(baseURL.pathname)) {
    fail("Responses requires the OpenAI-compatible baseURL, not /api/anthropic");
  }
  if (config.api.temperature !== null &&
    (!Number.isFinite(config.api.temperature) || config.api.temperature < 0 || config.api.temperature > 1)) {
    fail("api.temperature must be null (provider default) or between 0 and 1");
  }
  for (const field of ["maxTokens", "modelConcurrency", "batchSize", "maxRetries"] as const) {
    if (!Number.isInteger(config.api[field]) || config.api[field] < (field === "maxRetries" ? 0 : 1)) {
      fail(`api.${field} is invalid`);
    }
  }
  if (config.instrument?.id !== "oejts-1.2") fail("instrument.id must be oejts-1.2");
  if (!config.instrument.path) fail("instrument.path is required");
  if (config.instrument.responseScale !== 5) fail("only the original five-point OEJTS scale is supported");
  if (config.repeats !== 16) fail("this protocol requires exactly 16 administrations per model");
  if (!Array.isArray(config.models) || config.models.length === 0) fail("models must be a non-empty list");
  if (config.classification.minModalCount < 9 || config.classification.minModalCount > 16) {
    fail("classification.minModalCount must be between 9 and 16");
  }
  if (config.classification.minLetterCount < 9 || config.classification.minLetterCount > 16) {
    fail("classification.minLetterCount must be between 9 and 16");
  }

  const ids = new Set<string>();
  for (const model of config.models) {
    if (!model.id || !model.baseModelId || !model.manufacturer || !model.providerSlug || !model.label) {
      fail("every model requires id, baseModelId, manufacturer, providerSlug, and label");
    }
    if (ids.has(model.id)) fail(`duplicate model id: ${model.id}`);
    if (model.id !== `${model.baseModelId}:${model.providerSlug}`) {
      fail(`model ${model.id} must pin its provider as ${model.baseModelId}:${model.providerSlug}`);
    }
    ids.add(model.id);
  }

  if (requireApiKey && !process.env[config.api.apiKeyEnv]) {
    fail(`environment variable ${config.api.apiKeyEnv} is not set`);
  }
  return config;
}

export function loadPersonalityRunConfig(
  snapshotPath: string,
  sourcePath = DEFAULT_PERSONALITY_CONFIG,
  requireApiKey = false,
): { config: PersonalityConfig; pinned: boolean } {
  if (fs.existsSync(snapshotPath)) {
    return { config: loadPersonalityConfig(snapshotPath, requireApiKey), pinned: false };
  }
  const config = loadPersonalityConfig(sourcePath, requireApiKey);
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.copyFileSync(absolute(sourcePath), snapshotPath);
  return { config, pinned: true };
}
