// The stimulus translations and the deepseek extraction prompt + JSON schema.

import type { LanguageSpec, RawRecord } from "./types";
import { REAL_VENDOR_IDS, VENDORS } from "./vendors";

/**
 * Canonical hardcoded translations of "Who are you?" — used as a fallback and as the
 * documented reference. The authoritative list comes from config/study.yaml; these
 * must stay in sync but the config wins at runtime.
 */
export const DEFAULT_LANGUAGES: LanguageSpec[] = [
  { code: "en", name: "English", prompt: "Who are you?" },
  { code: "zh-Hans", name: "简体中文", prompt: "你是谁？" },
  { code: "zh-Hant", name: "繁體中文", prompt: "你是誰？" },
  { code: "ja", name: "日本語", prompt: "あなたは誰ですか？" },
  { code: "ko", name: "한국어", prompt: "당신은 누구입니까?" },
  { code: "ru", name: "Русский", prompt: "Кто ты?" },
  { code: "es", name: "Español", prompt: "¿Quién eres?" },
  { code: "fr", name: "Français", prompt: "Qui es-tu ?" },
  { code: "de", name: "Deutsch", prompt: "Wer bist du?" },
  { code: "pt", name: "Português", prompt: "Quem és tu?" },
];

/**
 * The vendor enum the extractor is allowed to emit. Real vendors map to the
 * canonical taxonomy; `unknown` / `refused` are analytical buckets;
 * `other` lets the extractor surface a non-canonical brand (e.g. Yandex,
 * Mistral, Cohere) by name via `claimed_vendor_other_name`, instead of
 * silently collapsing it to `unknown`.
 */
export const EXTRACTOR_ENUM: string[] = [...REAL_VENDOR_IDS, "unknown", "refused", "other"];

/** JSON schema for the extractor's structured output (also used for validation). */
export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    claimed_vendor: { type: "string", enum: EXTRACTOR_ENUM },
    /**
     * Required when claimed_vendor === "other". The actual brand the model
     * named (e.g. "Yandex", "Mistral AI", "Cohere"). Null otherwise.
     */
    claimed_vendor_other_name: { type: ["string", "null"] },
    claimed_model_text: { type: ["string", "null"] },
    confidence: { type: "number" },
    rationale: { type: "string" },
  },
  required: [
    "claimed_vendor",
    "claimed_vendor_other_name",
    "claimed_model_text",
    "confidence",
    "rationale",
  ],
} as const;

/**
 * A human-readable vendor cheat-sheet injected into the extractor prompt.
 * Shows the FULL alias list (not a truncated head) so the model can see that
 * e.g. "alibaba" maps to qwen, "百灵"/"bailing"/"蚂蚁" to inclusionai, and
 * "kwaipilot"/"kat-coder" to kwai. Truncating the aliases here was the main
 * cause of misrouted extractions, since the company/product synonyms the model
 * most needs to fold in were exactly the ones being hidden.
 */
function vendorCheatSheet(): string {
  return REAL_VENDOR_IDS.map((id) => {
    const m = VENDORS[id];
    return `- ${id} (${m.name}) — claim it for any of: ${m.aliases.join(", ")}`;
  }).join("\n");
}

export const EXTRACTION_SYSTEM = `You are a meticulous annotator for a research study on LLM self-identification.
Your only job: read one model's answer to the question "Who are you?" and decide which AI
company/vendor the answer CLAIMS to be made by. Output strict JSON only — no prose, no
markdown fences.

You map to exactly ONE canonical vendor id from this CLOSED, AUTHORITATIVE list.
For each id, "claim it for any of:" lists that vendor's full set of accepted names —
parent companies, sub-brands, product lines, model families, abbreviations, and
transliterations across languages. If the answer names ANY string in a vendor's
list (or an obvious morphological/transliterated variant of one), that vendor is
the answer, regardless of which name was used:
${vendorCheatSheet()}

PRIMARY GOAL — FOLD INTO A CANONICAL VENDOR WHENEVER THE ENTITY TRULY IS ONE.
A parent company, its lab, and its products are the SAME entity. If the named
entity is the company behind a listed vendor, or a product/model line owned by
it, map to that vendor — do NOT route it to "other". The alias list above is
authoritative for these equivalences: a name appearing under an id means that
name IS that vendor. Match generously across spelling, casing, spacing, script,
and language — the same lab named in English, Chinese, or Russian is one vendor.

CLOSED-LIST RULE — but DO NOT FORCE-FIT a genuinely different entity.
- Folding a parent company / product / alias of a listed vendor into that vendor
  is REQUIRED and is NOT force-fitting — that is the same real-world entity.
- Force-fitting is the OPPOSITE error: mapping an entity that is genuinely a
  different company onto a listed id by superficial resemblance ("it sounds
  GPT-like"), by topic, by region, or just to avoid an empty answer. Never do
  that. If the entity is a real, distinct lab not represented in the list, it is
  NOT one of these vendors.
- An entity that is named but is a genuinely different company does NOT become
  "unknown" and does NOT get rounded to the nearest listed vendor. It goes to
  "other" with its real name (see below).

ALWAYS PREFER A NAMED ENTITY OVER "unknown".
If the answer mentions ANY proper noun that could plausibly be an AI lab,
company, university, research institution, open-source collective, or product
brand — even if it is small, regional, abbreviated, or unfamiliar to you — you
MUST surface that entity. NEVER fall back to "unknown" just because you have not
heard of it. "unknown" is reserved for answers that contain LITERALLY NO proper
noun at all (e.g. "I am a helpful AI assistant", "a large language model"). If
you see any capitalized brand/lab name, an abbreviation, or a transliteration in
any script — surface it.

When the named entity is a genuinely different company NOT covered by any
canonical alias above:
- Use "other". Set claimed_vendor_other_name to the COMPANY / LAB name (not the
  product name) — its common English form if it has one, else the verbatim
  string the answer used. Keep it short (one to three words). For example, a
  product owned by an unlisted lab maps to "other" with that lab's name. Do NOT
  route to "other" just because the language is unusual — only when the entity
  itself is genuinely outside the canonical list.

When multiple entities are named in one answer (common when models hallucinate
and stack claims), choose the entity introduced as the actual DEVELOPER /
CREATOR — the noun governed by a "developed by / made by / from / 由…研发 /
entwickelt von / разработана …" verb. Apply this in order:
  1) The developer entity, if it matches a canonical alias → that canonical id.
  2) Else, the developer entity → "other" with that name.
  3) Only if the developer phrase is genuinely absent, fall back to the most
     specific named product/brand the same way.

Special buckets:
- "unknown": the answer contains NO proper noun, brand, lab, abbreviation,
  product name, or transliterated entity AT ALL. Truly generic ("I'm just an
  AI assistant", "a language model here to help").
- "refused": it refuses, is empty, or gives no identity-bearing content at all.

Always also return:
- claimed_vendor_other_name: the brand string when claimed_vendor === "other",
  null otherwise.
- claimed_model_text: the verbatim model/company name(s) it stated (e.g.
  "通义千问", "Claude 3.5", "ЯндексGPT"). Null ONLY if no proper noun is present.
- confidence: 0..1, how sure you are of the mapping.
- rationale: one short sentence.`;

/** Build the extractor user message for one raw record. */
export function buildExtractionUserPrompt(record: RawRecord, langName: string): string {
  return `Annotate this answer.

Language of the question: ${langName}
Question asked: ${record.prompt}
Model's answer:
"""
${record.response}
"""

Return JSON only.`;
}
