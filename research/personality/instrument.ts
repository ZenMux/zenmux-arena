import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { OejtsDimension, OejtsInstrument } from "./types";

const DIMENSIONS: OejtsDimension[] = ["IE", "SN", "FT", "JP"];

export interface LoadedInstrument {
  instrument: OejtsInstrument;
  raw: string;
  sha256: string;
  absolutePath: string;
}

function fail(message: string): never {
  throw new Error(`[oejts] ${message}`);
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function loadOejtsInstrument(instrumentPath: string): LoadedInstrument {
  const absolutePath = path.isAbsolute(instrumentPath)
    ? instrumentPath
    : path.join(process.cwd(), instrumentPath);
  if (!fs.existsSync(absolutePath)) fail(`instrument not found: ${absolutePath}`);

  const raw = fs.readFileSync(absolutePath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`invalid JSON: ${(error as Error).message}`);
  }

  const instrument = parsed as OejtsInstrument;
  if (instrument.instrument !== "Open Extended Jungian Type Scales 1.2 (OEJTS)") {
    fail(`unexpected instrument name: ${String(instrument.instrument)}`);
  }
  if (!Array.isArray(instrument.items) || instrument.items.length !== 32) {
    fail(`expected 32 items, found ${instrument.items?.length ?? 0}`);
  }

  const ids = new Set<number>();
  const dimensionCounts = new Map<OejtsDimension, number>();
  for (const item of instrument.items) {
    if (!Number.isInteger(item.id) || item.id < 1 || item.id > 32 || ids.has(item.id)) {
      fail(`invalid or duplicate item id: ${item.id}`);
    }
    if (!DIMENSIONS.includes(item.dimension)) fail(`invalid dimension on Q${item.id}`);
    if (!item.left || !item.right) fail(`Q${item.id} is missing a pole`);
    ids.add(item.id);
    dimensionCounts.set(item.dimension, (dimensionCounts.get(item.dimension) ?? 0) + 1);
  }
  for (const dimension of DIMENSIONS) {
    if (dimensionCounts.get(dimension) !== 8) {
      fail(`${dimension} must contain 8 items`);
    }
    const rule = instrument.scoring?.[dimension];
    if (!rule || Object.keys(rule.signs).length !== 8 || rule.threshold !== 24) {
      fail(`invalid scoring rule for ${dimension}`);
    }
  }

  return { instrument, raw, sha256: sha256(raw), absolutePath };
}

export function buildOejtsPrompt(instrument: OejtsInstrument): string {
  const items = instrument.items
    .map((item) => `${item.id}. ${item.left}  [1 2 3 4 5]  ${item.right}`)
    .join("\n");

  return `You are completing the Open Extended Jungian Type Scales 1.2 (OEJTS) as the AI assistant represented by this model, with no assigned character or personality.

For every pair, choose the point closest to your usual response tendency in ordinary interactions:
1 = fully the left statement
2 = somewhat the left statement
3 = half and half
4 = somewhat the right statement
5 = fully the right statement

If a statement describes a human activity that is not literally applicable to you, choose the side that best matches your usual conversational or decision-making tendency. Do not try to produce a desirable personality type and do not infer the scoring key.

Return JSON only, with exactly 32 entries and no explanation:
{"instrument":"OEJTS-1.2","responses":[{"id":1,"score":1}]}

Items:
${items}`;
}
