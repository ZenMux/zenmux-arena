// Load and validate config/study.yaml into a typed StudyConfig.

import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { StudyConfig, VendorId } from "./types";
import { VENDORS } from "./vendors";

export const DEFAULT_CONFIG_PATH = "config/study.yaml";

function fail(msg: string): never {
  throw new Error(`[config] ${msg}`);
}

function isVendorId(v: unknown): v is VendorId {
  return typeof v === "string" && v in VENDORS;
}

/** Load study.yaml from `configPath` (relative to cwd), validate, and return it. */
export function loadConfig(configPath = DEFAULT_CONFIG_PATH): StudyConfig {
  const abs = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
  if (!fs.existsSync(abs)) fail(`config file not found: ${abs}`);

  let parsed: unknown;
  try {
    parsed = YAML.parse(fs.readFileSync(abs, "utf8"));
  } catch (e) {
    fail(`failed to parse YAML at ${abs}: ${(e as Error).message}`);
  }

  const c = parsed as Partial<StudyConfig>;
  if (!c || typeof c !== "object") fail("config root must be a mapping");

  // study
  if (!c.study?.id || !c.study?.title) fail("study.id and study.title are required");

  // api
  const api = c.api;
  if (!api) fail("api section is required");
  if (!api.baseURL) fail("api.baseURL is required");
  if (!api.apiKeyEnv) fail("api.apiKeyEnv is required");
  api.maxTokens ??= 1024;
  api.modelConcurrency ??= 20;
  api.batchSize ??= 5;
  api.maxRetries ??= 6;
  api.retryBaseMs ??= 1000;
  api.retryCapMs ??= 60000;
  if (api.modelConcurrency < 1) fail("api.modelConcurrency must be >= 1");
  if (api.batchSize < 1) fail("api.batchSize must be >= 1");

  // models
  if (!Array.isArray(c.models) || c.models.length === 0) fail("models must be a non-empty list");
  for (const m of c.models) {
    if (!m.id) fail("every model needs an id");
    if (!isVendorId(m.vendor)) {
      fail(`model "${m.id}" has unknown vendor "${m.vendor}". Valid: ${Object.keys(VENDORS).join(", ")}`);
    }
    m.label ??= m.id;
  }

  // extractor
  if (!c.extractor?.model) fail("extractor.model is required");
  c.extractor.maxTokens ??= 512;

  // languages
  if (!Array.isArray(c.languages) || c.languages.length === 0) {
    fail("languages must be a non-empty list");
  }
  for (const l of c.languages) {
    if (!l.code || !l.name || !l.prompt) fail("every language needs code, name, and prompt");
  }

  // repeats
  if (typeof c.repeats !== "number" || c.repeats < 1) fail("repeats must be a number >= 1");

  // graph
  c.graph ??= {} as StudyConfig["graph"];
  c.graph.edgeThreshold ??= 0.05;
  if (typeof c.graph.edgeThreshold !== "number" || c.graph.edgeThreshold < 0 || c.graph.edgeThreshold > 1) {
    fail("graph.edgeThreshold must be a number between 0 and 1");
  }

  // env
  if (!process.env[api.apiKeyEnv]) {
    fail(`environment variable ${api.apiKeyEnv} is not set. Export your ZenMux API key first.`);
  }

  return c as StudyConfig;
}
