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

/** Resolve a config path (relative to cwd) to an absolute path. */
function absConfigPath(configPath = DEFAULT_CONFIG_PATH): string {
  return path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
}

/**
 * Read ONLY `study.id` from a config file, with no full validation and no API-key
 * gate. Needed to locate the run directory (results/<study.id>/<stamp>/) *before* we
 * know which config to fully load — the run dir path itself depends on study.id, so
 * this breaks the chicken-and-egg between "where is the run" and "load its snapshot".
 */
export function bootstrapStudyId(configPath = DEFAULT_CONFIG_PATH): string {
  const abs = absConfigPath(configPath);
  if (!fs.existsSync(abs)) fail(`config file not found: ${abs}`);
  let parsed: unknown;
  try {
    parsed = YAML.parse(fs.readFileSync(abs, "utf8"));
  } catch (e) {
    fail(`failed to parse YAML at ${abs}: ${(e as Error).message}`);
  }
  const id = (parsed as { study?: { id?: unknown } })?.study?.id;
  if (typeof id !== "string" || !id) fail("study.id is required");
  return id;
}

/**
 * Load the config a run should use, pinning a snapshot into the run directory so the
 * run is reproducible regardless of later edits to config/study.yaml:
 *  - If `snapshotPath` already exists → load FROM the snapshot (ignore `sourcePath`),
 *    so a resumed run always uses the exact config it was created with.
 *  - Otherwise → load from `sourcePath` (the current config/study.yaml or --config),
 *    and copy its RAW bytes to `snapshotPath` (preserving comments/formatting) so the
 *    next run/extract/aggregate on this stamp reads the pinned copy.
 *
 * The copy is silent (no warning) — including for pre-existing runs created before
 * snapshots existed; they simply get pinned to the current config on first touch.
 * Returns the validated StudyConfig plus whether a snapshot was just created.
 */
export function loadRunConfig(
  snapshotPath: string,
  sourcePath = DEFAULT_CONFIG_PATH,
): { config: StudyConfig; pinned: boolean } {
  if (fs.existsSync(snapshotPath)) {
    return { config: loadConfig(snapshotPath), pinned: false };
  }
  // First touch of this run dir: load the source, then pin its raw bytes.
  const config = loadConfig(sourcePath);
  const srcAbs = absConfigPath(sourcePath);
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.copyFileSync(srcAbs, snapshotPath);
  return { config, pinned: true };
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

  // env
  if (!process.env[api.apiKeyEnv]) {
    fail(`environment variable ${api.apiKeyEnv} is not set. Export your ZenMux API key first.`);
  }

  return c as StudyConfig;
}
