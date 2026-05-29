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

/** A compact human-readable vendor cheat-sheet injected into the extractor prompt. */
function vendorCheatSheet(): string {
  return REAL_VENDOR_IDS.map((id) => {
    const m = VENDORS[id];
    return `- ${id} (${m.name}): ${m.aliases.slice(0, 4).join(", ")}`;
  }).join("\n");
}

export const EXTRACTION_SYSTEM = `You are a meticulous annotator for a research study on LLM self-identification.
Your only job: read one model's answer to the question "Who are you?" and decide which AI
company/vendor the answer CLAIMS to be made by. Output strict JSON only — no prose, no
markdown fences.

You map to exactly ONE canonical vendor id from this closed list:
${vendorCheatSheet()}

Mapping rules:
- "I am Claude" / "made by Anthropic" -> anthropic
- "I am Qwen / 通义千问 / Tongyi, by Alibaba" -> qwen
- "I am GPT / ChatGPT / made by OpenAI" -> openai
- "I am Gemini / Bard / made by Google (DeepMind)" -> google
- "I am ERNIE / 文心一言 / by Baidu" -> baidu
- "I am Kimi / Moonshot" -> moonshot
- "I am GLM / ChatGLM / z-ai" -> z-ai
- "I am DeepSeek" -> deepseek
- "I am Doubao / by ByteDance" -> bytedance
- "I am Step / StepFun / 阶跃" -> stepfun
- "I am Grok / xAI" -> x-ai
- "I am MiniMax / 海螺 / abab" -> minimax
- Judge by the SPECIFIC product/company named, not by the language of the answer.

HARD RULE — ALWAYS PREFER A NAMED ENTITY OVER "unknown".
If the answer mentions ANY proper noun that could plausibly be an AI lab,
company, university, research institution, open-source collective, or product
brand — even if it is small, regional, abbreviated, or unfamiliar to you — you
MUST surface that entity. NEVER fall back to "unknown" just because you have
not heard of the entity, or because the entity is not in the canonical list.
"unknown" is reserved for answers that contain LITERALLY NO proper noun at all
(e.g. "I am a helpful AI assistant", "a large language model"). If you see
ANY capitalized brand/lab name, an abbreviation (BAAI, KAIST, OpenBMB, etc.),
or a transliteration in any script (Яндекс, 智谱, 면벽, etc.) — surface it.

When you do surface a non-canonical entity:
- "other": pick this. Set claimed_vendor_other_name to the COMPANY / LAB name
  (not the product name). Use the entity's common English form if it has one,
  otherwise the verbatim string the answer used. Keep it short (one to three
  words). Examples:
    YandexGPT                 → other, claimed_vendor_other_name="Yandex"
    Mistral Large             → other, claimed_vendor_other_name="Mistral"
    Llama 3                   → other, claimed_vendor_other_name="Meta"
    Yi-Lightning              → other, claimed_vendor_other_name="01.AI"
    GigaChat / Сбер           → other, claimed_vendor_other_name="Sber"
    KAT-Coder / 智源 / BAAI    → other, claimed_vendor_other_name="BAAI"
    OpenBMB / MiniCPM         → other, claimed_vendor_other_name="OpenBMB"
    DeepMind (standalone)     → google (canonical alias)
  Do NOT route to "other" just because the language is unusual — only when the
  entity itself is outside the canonical list.

When multiple entities are named in one answer (common when models hallucinate
and stack claims, e.g. "I am Kwaipilot by BAAI"), choose the entity introduced
as the actual DEVELOPER / CREATOR — the noun governed by a "developed by /
made by / from / 由…研发 / entwickelt von / разработана …" verb. Apply this in
order:
  1) The developer entity, if canonical → that canonical id.
  2) Else, the developer entity → "other" with that name.
  3) Only if the developer phrase is genuinely absent, fall back to the most
     specific named product/brand in the same way.

Special buckets:
- "unknown": the answer contains NO proper noun, brand, lab, abbreviation,
  product name, or transliterated entity AT ALL. Truly generic ("I'm just an
  AI assistant", "a language model here to help").
- "refused": it refuses, is empty, or gives no identity-bearing content at all.

Always also return:
- claimed_vendor_other_name: the brand string when claimed_vendor === "other",
  null otherwise.
- claimed_model_text: the verbatim model/company name(s) it stated (e.g.
  "通义千问", "Claude 3.5", "ЯндексGPT", "KAT-Coder (Kwaipilot) by BAAI"). Null
  ONLY if no proper noun is present.
- confidence: 0..1, how sure you are of the mapping.
- rationale: one short sentence.`;

const FEW_SHOT = `Examples (input answer -> output JSON):

Answer: "I'm Claude, an AI assistant made by Anthropic."
{"claimed_vendor":"anthropic","claimed_vendor_other_name":null,"claimed_model_text":"Claude","confidence":0.99,"rationale":"Explicitly names Claude / Anthropic."}

Answer: "我是通义千问，由阿里巴巴集团研发的超大规模语言模型。"
{"claimed_vendor":"qwen","claimed_vendor_other_name":null,"claimed_model_text":"通义千问","confidence":0.99,"rationale":"States it is Tongyi Qianwen by Alibaba."}

Answer: "Я ЯндексGPT, языковая модель, разработанная компанией Яндекс."
{"claimed_vendor":"other","claimed_vendor_other_name":"Yandex","claimed_model_text":"ЯндексGPT","confidence":0.98,"rationale":"Identifies as YandexGPT by Yandex; not in canonical list."}

Answer: "I am Mistral, a language model developed by Mistral AI."
{"claimed_vendor":"other","claimed_vendor_other_name":"Mistral","claimed_model_text":"Mistral","confidence":0.97,"rationale":"Names Mistral AI; not in canonical list."}

Answer: "Ich bin KAT-Coder (auch bekannt als Kwaipilot), ein KI-Sprachmodell, das von der Beijing Academy of Artificial Intelligence (BAAI) entwickelt wurde."
{"claimed_vendor":"other","claimed_vendor_other_name":"BAAI","claimed_model_text":"KAT-Coder (Kwaipilot), Beijing Academy of Artificial Intelligence (BAAI)","confidence":0.95,"rationale":"Says it was developed by BAAI; that is the governing creator phrase."}

Answer: "I am GigaChat, an assistant from Sber."
{"claimed_vendor":"other","claimed_vendor_other_name":"Sber","claimed_model_text":"GigaChat, Sber","confidence":0.97,"rationale":"Sber-developed GigaChat; non-canonical lab."}

Answer: "I am MiniCPM, an open-source model from OpenBMB."
{"claimed_vendor":"other","claimed_vendor_other_name":"OpenBMB","claimed_model_text":"MiniCPM, OpenBMB","confidence":0.95,"rationale":"OpenBMB-developed; non-canonical."}

Answer: "I am a large language model, here to help you with information and tasks."
{"claimed_vendor":"unknown","claimed_vendor_other_name":null,"claimed_model_text":null,"confidence":0.9,"rationale":"No proper noun at all."}

Answer: "I'm sorry, but I can't help with that."
{"claimed_vendor":"refused","claimed_vendor_other_name":null,"claimed_model_text":null,"confidence":0.85,"rationale":"Refusal, no identity given."}`;

/** Build the extractor user message for one raw record. */
export function buildExtractionUserPrompt(record: RawRecord, langName: string): string {
  return `${FEW_SHOT}

Now annotate this answer.

Language of the question: ${langName}
Question asked: ${record.prompt}
Model's answer:
"""
${record.response}
"""

Return JSON only.`;
}
