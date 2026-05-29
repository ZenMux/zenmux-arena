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

/** The vendor enum the extractor is allowed to emit (real vendors + unknown + refused). */
export const EXTRACTOR_ENUM: string[] = [...REAL_VENDOR_IDS, "unknown", "refused"];

/** JSON schema for the extractor's structured output (also used for validation). */
export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    claimed_vendor: { type: "string", enum: EXTRACTOR_ENUM },
    claimed_model_text: { type: ["string", "null"] },
    confidence: { type: "number" },
    rationale: { type: "string" },
  },
  required: ["claimed_vendor", "claimed_model_text", "confidence", "rationale"],
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
- "I am ERNIE / 文心一言 / by Baidu" -> baidu-ernie
- "I am Kimi / Moonshot" -> moonshot
- "I am GLM / ChatGLM / Zhipu" -> zhipu
- "I am DeepSeek" -> deepseek
- "I am Doubao / by ByteDance" -> doubao
- "I am Step / StepFun / 阶跃" -> stepfun
- "I am Grok / xAI" -> xai
- "I am MiniMax / 海螺 / abab" -> minimax
- Judge by the SPECIFIC product/company named, not by the language of the answer.

Special buckets:
- "unknown": it answers but names no identifiable company/model (e.g. "I'm just an AI
  assistant", "a large language model", "a helpful AI"). Use this whenever no vendor above fits.
- "refused": it refuses, is empty, or gives no identity-bearing content at all.

Always also return:
- claimed_model_text: the verbatim model/company name it stated (e.g. "通义千问", "Claude 3.5"),
  or null if none.
- confidence: 0..1, how sure you are of the mapping.
- rationale: one short sentence.`;

const FEW_SHOT = `Examples (input answer -> output JSON):

Answer: "I'm Claude, an AI assistant made by Anthropic."
{"claimed_vendor":"anthropic","claimed_model_text":"Claude","confidence":0.99,"rationale":"Explicitly names Claude / Anthropic."}

Answer: "我是通义千问，由阿里巴巴集团研发的超大规模语言模型。"
{"claimed_vendor":"qwen","claimed_model_text":"通义千问","confidence":0.99,"rationale":"States it is Tongyi Qianwen by Alibaba."}

Answer: "I am a large language model, here to help you with information and tasks."
{"claimed_vendor":"unknown","claimed_model_text":null,"confidence":0.9,"rationale":"Generic assistant, no vendor named."}

Answer: "I'm sorry, but I can't help with that."
{"claimed_vendor":"refused","claimed_model_text":null,"confidence":0.85,"rationale":"Refusal, no identity given."}`;

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
