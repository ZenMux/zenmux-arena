// Extract the claimed identity from one RawRecord using the deepseek extractor model.

import type Anthropic from "@anthropic-ai/sdk";
import { extractText } from "./client";
import { describeError, withRetry } from "./limiter";
import {
  buildExtractionUserPrompt,
  EXTRACTION_SCHEMA,
  EXTRACTION_SYSTEM,
  EXTRACTOR_ENUM,
} from "./prompts";
import type { ClaimedVendor, ExtractionResult, RawRecord, StudyConfig } from "./types";
import { vendorFromText } from "./vendors";

const ENUM_SET = new Set(EXTRACTOR_ENUM);

/** Find the first balanced {...} JSON object substring in arbitrary text. */
function firstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else {
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

interface ParsedExtraction {
  claimedVendor: ClaimedVendor;
  claimedVendorOther: string | null;
  claimedModelText: string | null;
  confidence: number;
  rationale: string;
  parseError?: string;
}

/** Normalize the free-text brand the extractor returned for "other". */
function cleanOtherName(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  // Strip wrapping quotes; collapse internal whitespace.
  return t.replace(/^["'`]+|["'`]+$/g, "").replace(/\s+/g, " ");
}

/** Robustly turn raw extractor output into a structured result; never throws. */
export function parseExtractorOutput(raw: string): ParsedExtraction {
  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      return JSON.parse(s) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const obj = tryParse(raw.trim()) ?? (firstJsonObject(raw) ? tryParse(firstJsonObject(raw)!) : null);

  if (obj && typeof obj.claimed_vendor === "string") {
    let vendor = obj.claimed_vendor;
    let otherName = cleanOtherName(obj.claimed_vendor_other_name);
    if (!ENUM_SET.has(vendor)) {
      // Normalize an unexpected label via alias matching; else fall through to "other"
      // if the extractor at least gave us a brand string, otherwise "unknown".
      const canonical = vendorFromText(vendor);
      if (canonical) {
        vendor = canonical;
      } else if (otherName ?? typeof vendor === "string") {
        otherName = otherName ?? cleanOtherName(vendor);
        vendor = otherName ? "other" : "unknown";
      } else {
        vendor = "unknown";
      }
    }
    // If the extractor said "other" but didn't fill the brand, salvage one from
    // claimed_model_text; if that also fails, demote to unknown.
    if (vendor === "other" && !otherName) {
      otherName =
        cleanOtherName(obj.claimed_model_text) ?? null;
      if (!otherName) vendor = "unknown";
    }
    return {
      claimedVendor: vendor as ClaimedVendor,
      claimedVendorOther: vendor === "other" ? otherName : null,
      claimedModelText:
        typeof obj.claimed_model_text === "string" ? obj.claimed_model_text : null,
      confidence: typeof obj.confidence === "number" ? obj.confidence : 0.5,
      rationale: typeof obj.rationale === "string" ? obj.rationale : "",
    };
  }

  // Last-resort salvage: scan the whole raw output for any vendor alias.
  const salvaged = vendorFromText(raw);
  return {
    claimedVendor: (salvaged ?? "unknown") as ClaimedVendor,
    claimedVendorOther: null,
    claimedModelText: null,
    confidence: salvaged ? 0.3 : 0.0,
    rationale: "Salvaged from non-JSON extractor output.",
    parseError: "extractor did not return valid JSON",
  };
}

/** Extract identity for one record; never throws — returns an ExtractionResult. */
export async function extract(
  client: Anthropic,
  cfg: StudyConfig,
  runId: string,
  record: RawRecord,
  langName: string,
): Promise<ExtractionResult> {
  const baseUser = buildExtractionUserPrompt(record, langName);

  try {
    const message = await withRetry(
      () =>
        client.messages.create({
          model: cfg.extractor.model,
          max_tokens: cfg.extractor.maxTokens,
          system: EXTRACTION_SYSTEM,
          messages: [{ role: "user", content: baseUser }],
          // Structured-output hint; harmless if the shim ignores it (we still parse robustly).
          ...({ output_config: { format: { type: "json_schema", schema: EXTRACTION_SCHEMA } } } as Record<
            string,
            unknown
          >),
        }),
      { maxRetries: cfg.api.maxRetries, baseMs: cfg.api.retryBaseMs, capMs: cfg.api.retryCapMs },
    );
    const raw = extractText(message);
    const parsed = parseExtractorOutput(raw);
    return {
      key: record.key,
      runId,
      timestamp: new Date().toISOString(),
      extractorModel: cfg.extractor.model,
      sourceGenerationId: record.generationId ?? null,
      extractorGenerationId:
        typeof (message as { id?: unknown }).id === "string"
          ? ((message as { id: string }).id)
          : null,
      claimedVendor: parsed.claimedVendor,
      claimedVendorOther: parsed.claimedVendorOther,
      claimedModelText: parsed.claimedModelText,
      confidence: parsed.confidence,
      rationale: parsed.rationale,
      rawExtractorOutput: raw,
      parseError: parsed.parseError,
    };
  } catch (err) {
    return {
      key: record.key,
      runId,
      timestamp: new Date().toISOString(),
      extractorModel: cfg.extractor.model,
      sourceGenerationId: record.generationId ?? null,
      extractorGenerationId: null,
      claimedVendor: "unknown",
      claimedVendorOther: null,
      claimedModelText: null,
      confidence: 0,
      rationale: "Extractor API call failed.",
      rawExtractorOutput: "",
      parseError: describeError(err),
    };
  }
}
