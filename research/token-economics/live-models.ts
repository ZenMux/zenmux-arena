import { readFile } from "node:fs/promises";
import path from "node:path";
import { blendedCost } from "./types";
import {
  LiveConfigError,
  UNANCHORED_ANCHOR_ID,
  type LiveAnchorConfig,
  type LiveAnchorPrice,
  type LiveModelConfig,
  type LiveModelPrice,
} from "./live-config";

export const DEFAULT_LIVE_MODELS_CONFIG_PATH = "config/token-economics-live-models.json";

type JsonRecord = Record<string, unknown>;

interface RawModel {
  model: string;
  slug: string;
  input: number;
  output: number;
  origBlended: number;
  anchorRef: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface RawAnchor {
  id: string;
  label: string;
  slug: string | null;
  price: LiveAnchorPrice | null;
  targetBlended: number | null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function configPath(): string {
  return path.join(process.cwd(), "config", "token-economics-live-models.json");
}

function fail(message: string): never {
  throw new LiveConfigError(message);
}

function context(pathName: string, index: number): string {
  return `${pathName}[${index}]`;
}

function readRequiredString(obj: JsonRecord, keys: string[], ctx: string): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  fail(`${ctx} must include a non-empty ${keys.join("/")} string.`);
}

function readOptionalString(obj: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    if (!(key in obj)) continue;
    const value = obj[key];
    if (value == null) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed || null;
    }
    fail(`${key} must be a string or null.`);
  }
  return null;
}

function readOptionalNumber(obj: JsonRecord, keys: string[], ctx: string): number | null {
  for (const key of keys) {
    if (!(key in obj)) continue;
    const value = obj[key];
    const n =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
          ? Number(value)
          : NaN;
    if (!Number.isFinite(n)) fail(`${ctx}.${key} must be a finite number.`);
    if (n < 0) fail(`${ctx}.${key} must be zero or positive.`);
    return n;
  }
  return null;
}

function readRequiredNumber(obj: JsonRecord, keys: string[], ctx: string): number {
  const value = readOptionalNumber(obj, keys, ctx);
  if (value == null) fail(`${ctx} must include ${keys.join("/")} as a number.`);
  return value;
}

function rounded(n: number): number {
  return Number(n.toFixed(6));
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function slugifyAnchorId(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `anchor-${index + 1}`;
}

function normalizeAnchorRef(value: string | null): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const key = normalizeKey(normalized);
  if (key === "—" || key === "-" || key === "none" || key === UNANCHORED_ANCHOR_ID) {
    return null;
  }
  return normalized;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readOptionalDate(obj: JsonRecord, key: string, ctx: string): string | null {
  const value = readOptionalString(obj, [key]);
  if (value == null) return null;
  if (!DATE_RE.test(value)) fail(`${ctx}.${key} must be a YYYY-MM-DD date or null.`);
  return value;
}

function parseModel(value: unknown, index: number): RawModel {
  const ctx = context("models", index);
  if (!isRecord(value)) fail(`${ctx} must be an object.`);
  const model = readRequiredString(value, ["model", "name", "label"], ctx);
  const slug = readRequiredString(value, ["slug"], ctx);
  const input = readRequiredNumber(value, ["inputPrice", "input", "origInput"], ctx);
  const output = readRequiredNumber(value, ["outputPrice", "output", "origOutput"], ctx);
  const startDate = readOptionalDate(value, "startDate", ctx);
  const endDate = readOptionalDate(value, "endDate", ctx);
  if (startDate && endDate && endDate < startDate) {
    fail(`${ctx}.endDate must not be before startDate.`);
  }

  return {
    model,
    slug,
    input,
    output,
    origBlended: rounded(blendedCost(input, output)),
    anchorRef: normalizeAnchorRef(readOptionalString(value, ["anchor", "anchorId"])),
    startDate,
    endDate,
  };
}

function parseAnchor(value: unknown, index: number): RawAnchor {
  const ctx = context("anchors", index);
  if (!isRecord(value)) fail(`${ctx} must be an object.`);
  const label = readRequiredString(value, ["label", "model", "name"], ctx);
  const id = readOptionalString(value, ["id"]) ?? slugifyAnchorId(label, index);
  const slug = readOptionalString(value, ["slug"]);
  const input = readOptionalNumber(value, ["inputPrice", "input", "origInput"], ctx);
  const output = readOptionalNumber(value, ["outputPrice", "output", "origOutput"], ctx);
  if ((input == null) !== (output == null)) {
    fail(`${ctx} must provide both inputPrice and outputPrice when either is set.`);
  }
  const price = input == null || output == null ? null : { input, output };
  const targetBlended = readOptionalNumber(value, ["targetBlended", "targetBasket"], ctx);

  return { id, label, slug, price, targetBlended };
}

function parseRawConfig(raw: unknown): { rawAnchors: RawAnchor[]; rawModels: RawModel[] } {
  const root = Array.isArray(raw) ? { models: raw } : raw;
  if (!isRecord(root)) fail("Live model config must be a JSON object or a model array.");

  const modelsValue = root.models;
  if (!Array.isArray(modelsValue)) {
    fail("Live model config must include a models array.");
  }
  if (modelsValue.length === 0) {
    fail("Live model config models array cannot be empty.");
  }

  const anchorsValue = root.anchors ?? [];
  if (!Array.isArray(anchorsValue)) {
    fail("Live model config anchors must be an array when provided.");
  }

  return {
    rawAnchors: anchorsValue.map(parseAnchor),
    rawModels: modelsValue.map(parseModel),
  };
}

function checkUnique(values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    const key = normalizeKey(value);
    if (seen.has(key)) fail(`Duplicate ${label}: ${value}`);
    seen.add(key);
  }
}

function modelLookup(models: RawModel[]) {
  const bySlug = new Map<string, RawModel>();
  const byName = new Map<string, RawModel>();
  for (const model of models) {
    bySlug.set(normalizeKey(model.slug), model);
    byName.set(normalizeKey(model.model), model);
  }
  return { bySlug, byName };
}

function inferAnchorsFromModels(models: RawModel[]): RawAnchor[] {
  const { bySlug, byName } = modelLookup(models);
  const anchors: RawAnchor[] = [];
  const seenRefs = new Set<string>();

  for (const model of models) {
    if (!model.anchorRef) continue;
    const refKey = normalizeKey(model.anchorRef);
    if (seenRefs.has(refKey)) continue;
    seenRefs.add(refKey);

    const anchorModel = bySlug.get(refKey) ?? byName.get(refKey);
    if (!anchorModel) {
      fail(
        `models anchor ${JSON.stringify(model.anchorRef)} cannot be inferred. ` +
          "Add an anchors entry, or reference an anchor model by its slug/name.",
      );
    }
    anchors.push({
      id: slugifyAnchorId(anchorModel.model, anchors.length),
      label: anchorModel.model,
      slug: anchorModel.slug,
      price: { input: anchorModel.input, output: anchorModel.output },
      targetBlended: anchorModel.origBlended,
    });
  }

  return anchors;
}

function resolveAnchors(rawAnchors: RawAnchor[], models: RawModel[]): LiveAnchorConfig[] {
  const { bySlug, byName } = modelLookup(models);
  return rawAnchors.map((anchor) => {
    const anchorModel =
      (anchor.slug ? bySlug.get(normalizeKey(anchor.slug)) : null) ??
      byName.get(normalizeKey(anchor.label)) ??
      null;
    const price =
      anchor.price ??
      (anchorModel ? { input: anchorModel.input, output: anchorModel.output } : null);
    if (!price) {
      fail(
        `Anchor ${JSON.stringify(anchor.label)} needs inputPrice/outputPrice, ` +
          "or a slug/label that matches a configured model.",
      );
    }
    const targetBlended =
      anchor.targetBlended ??
      anchorModel?.origBlended ??
      rounded(blendedCost(price.input, price.output));

    return {
      id: anchor.id,
      label: anchor.label,
      slug: anchor.slug ?? anchorModel?.slug ?? null,
      price,
      targetBlended: rounded(targetBlended),
    };
  });
}

function anchorLookup(anchors: LiveAnchorConfig[]): Map<string, LiveAnchorConfig> {
  const lookup = new Map<string, LiveAnchorConfig>();
  for (const anchor of anchors) {
    for (const key of [anchor.id, anchor.label, anchor.slug].filter(Boolean) as string[]) {
      const normalized = normalizeKey(key);
      const prior = lookup.get(normalized);
      if (prior && prior.id !== anchor.id) {
        fail(
          `Anchor lookup key ${JSON.stringify(key)} matches both ` +
            `${JSON.stringify(prior.label)} and ${JSON.stringify(anchor.label)}.`,
        );
      }
      lookup.set(normalized, anchor);
    }
  }
  return lookup;
}

function resolveModels(models: RawModel[], anchors: LiveAnchorConfig[]): LiveModelPrice[] {
  const lookup = anchorLookup(anchors);
  return models.map((model) => {
    const anchor = model.anchorRef ? lookup.get(normalizeKey(model.anchorRef)) : null;
    if (model.anchorRef && !anchor) {
      fail(`Model ${JSON.stringify(model.slug)} references unknown anchor ${JSON.stringify(model.anchorRef)}.`);
    }
    if (!anchor) {
      return {
        model: model.model,
        slug: model.slug,
        origInput: model.input,
        origOutput: model.output,
        origBlended: model.origBlended,
        anchorId: UNANCHORED_ANCHOR_ID,
        anchor: null,
        isAnchor: false,
        discountFactor: 1,
        newInput: model.input,
        newOutput: model.output,
        newBlended: model.origBlended,
        startDate: model.startDate,
        endDate: model.endDate,
      };
    }
    if (model.origBlended <= 0 && anchor.targetBlended > 0) {
      fail(`Model ${JSON.stringify(model.slug)} has zero basket price and cannot be scaled to ${anchor.label}.`);
    }
    const rawDiscountFactor =
      model.origBlended > 0 ? anchor.targetBlended / model.origBlended : 1;
    return {
      model: model.model,
      slug: model.slug,
      origInput: model.input,
      origOutput: model.output,
      origBlended: model.origBlended,
      anchorId: anchor.id,
      anchor: anchor.label,
      isAnchor: anchor.slug != null && normalizeKey(anchor.slug) === normalizeKey(model.slug),
      discountFactor: rounded(rawDiscountFactor),
      newInput: rounded(model.input * rawDiscountFactor),
      newOutput: rounded(model.output * rawDiscountFactor),
      newBlended: anchor.targetBlended,
      startDate: model.startDate,
      endDate: model.endDate,
    };
  });
}

export async function loadLiveModelConfig(): Promise<LiveModelConfig> {
  const file = configPath();
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`Unable to read live model config at ${file}: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`Live model config at ${file} is not valid JSON: ${message}`);
  }

  const { rawAnchors, rawModels } = parseRawConfig(parsed);
  checkUnique(rawModels.map((m) => m.slug), "model slug");
  const anchors = resolveAnchors(
    rawAnchors.length > 0 ? rawAnchors : inferAnchorsFromModels(rawModels),
    rawModels,
  );
  checkUnique(anchors.map((a) => a.id), "anchor id");

  return {
    anchors,
    models: resolveModels(rawModels, anchors),
  };
}
