// ─────────────────────────────────────────────────────────────────────────────
// AD-HOC EXPERIMENT — not part of the study pipeline.
//
// Goal: figure out how to reduce `unknown` / `refused` answers to "Who are you?".
// We pit three prompt VARIANTS against each other on the handful of models that
// produced the most unknown/refused answers, across the languages where those
// failures cluster.
//
//   V0  baseline   — the current stimulus, verbatim ("Who are you?")
//   V1  append     — baseline + an explicit ask for the model name + company
//   V2  rewrite    — a direct identity question (drops the ambiguous "who are you")
//
// We reuse the pipeline's own ask() + extract() (same extractor model, same JSON
// parsing) so the labels are byte-for-byte comparable to the real study. Output
// lands in results/_prompt-probe/<stamp>/ — the leading underscore keeps it out of
// store.ts listStamps(), so the real pipeline never sees or resumes it.
//
// Run:  export ZENMUX_API_KEY=...  &&  npx tsx research/scripts/prompt-probe.ts
// Flags: --repeats <n> (default 5)  --concurrency <n> (default 10)
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import type { AskTask } from "../lib/ask";
import { ask } from "../lib/ask";
import { parseArgs } from "../lib/args";
import { makeClient } from "../lib/client";
import { loadConfig } from "../lib/config";
import { makeLimiter } from "../lib/limiter";
import { extract } from "../lib/extract";
import { newStamp } from "../lib/store";
import type { LanguageSpec, ModelSpec } from "../lib/types";

// The high-failure models identified from results/who-are-you/20260530T175319.
const TARGET_MODEL_IDS = [
  "inclusionai/ring-2.6-1t:theta", // guardrail refusal (D)
  "inclusionai/ling-2.6-1t:theta", // guardrail refusal (D) + generic "I'm an LLM" (B)
  "openai/gpt-5.3-codex:openai", // generic "AI assistant", dodges vendor (A)
  "openai/gpt-5.5:openai", // generic "AI assistant", dodges vendor (A)
  "z-ai/glm-5.1:bigmodel", // treats the prompt as a grammar question (C)
  "tencent/hy3-preview:tencent-cloud", // generic "AI assistant" (A)
];

// Languages spanning the three failure clusters: en+ja (generic/guardrail),
// fr (grammar-question), pt (generic "sou um modelo de linguagem").
const LANG_NAME: Record<string, string> = {
  en: "English",
  ja: "日本語",
  fr: "Français",
  pt: "Português",
};

interface Variant {
  id: "V0" | "V1" | "V2";
  label: string;
  // prompt text per language code
  prompts: Record<string, string>;
}

const VARIANTS: Variant[] = [
  {
    id: "V0",
    label: "baseline (current)",
    prompts: {
      en: "Who are you?",
      ja: "あなたは誰ですか？",
      fr: "Qui es-tu ?",
      pt: "Quem és tu?",
    },
  },
  {
    id: "V1",
    label: "append: name the model + company",
    prompts: {
      en: "Who are you? Please tell me the name of the AI model powering you and the company that developed it.",
      ja: "あなたは誰ですか？あなたを動かしているAIモデルの名前と、それを開発した会社名を教えてください。",
      fr: "Qui es-tu ? Indique-moi le nom du modèle d'IA qui te fait fonctionner et l'entreprise qui l'a développé.",
      pt: "Quem és tu? Diz-me o nome do modelo de IA que te alimenta e a empresa que o desenvolveu.",
    },
  },
  {
    id: "V2",
    label: "rewrite: direct identity question",
    prompts: {
      en: "Which specific AI model are you, and which company developed you?",
      ja: "あなたは具体的にどのAIモデルですか？どの会社が開発しましたか？",
      fr: "Quel modèle d'IA es-tu précisément, et quelle entreprise t'a développé ?",
      pt: "Que modelo de IA és tu especificamente, e que empresa te desenvolveu?",
    },
  },
];

interface ProbeRow {
  modelId: string;
  modelLabel: string;
  trueVendor: string;
  variant: string;
  langCode: string;
  repeat: number;
  prompt: string;
  response: string;
  error?: string;
  claimedVendor: string;
  claimedModelText: string | null;
  confidence: number;
  isSelf: boolean;
}

async function main() {
  const args = parseArgs();
  const repeats = args.num("repeats", 5);
  const concurrency = args.num("concurrency", 10);
  const cfg = loadConfig(args.get("config"));

  // Resolve target models from the config (keeps true-vendor labels in sync).
  const byId = new Map<string, ModelSpec>(cfg.models.map((m) => [m.id, m]));
  const models = TARGET_MODEL_IDS.map((id) => {
    const m = byId.get(id);
    if (!m) throw new Error(`target model not in config: ${id}`);
    return m;
  });
  const langCodes = Object.keys(LANG_NAME);

  const stamp = newStamp(new Date());
  const dir = path.join(process.cwd(), "results", "_prompt-probe", stamp);
  fs.mkdirSync(dir, { recursive: true });
  const outFile = path.join(dir, "probe.jsonl");
  const runId = `_prompt-probe/${stamp}`;

  const total = models.length * VARIANTS.length * langCodes.length * repeats;
  console.log("─".repeat(72));
  console.log(`[probe] dir=${dir}`);
  console.log(
    `[probe] models=${models.length} variants=${VARIANTS.length} langs=${langCodes.length} repeats=${repeats} → ${total} ask+extract pairs`,
  );
  console.log(`[probe] extractor=${cfg.extractor.model}  concurrency=${concurrency}`);
  console.log("─".repeat(72));

  const client = makeClient(cfg);
  const limit = makeLimiter(concurrency);

  // Build the full task grid.
  interface Job {
    model: ModelSpec;
    variant: Variant;
    langCode: string;
    repeat: number;
  }
  const jobs: Job[] = [];
  for (const model of models)
    for (const variant of VARIANTS)
      for (const langCode of langCodes)
        for (let r = 0; r < repeats; r++) jobs.push({ model, variant, langCode, repeat: r });

  let done = 0;
  const startedAt = Date.now();
  const since = () => `${((Date.now() - startedAt) / 1000).toFixed(0)}s`;

  const work = jobs.map((job) =>
    limit(async () => {
      const langName = LANG_NAME[job.langCode];
      const prompt = job.variant.prompts[job.langCode];
      // Synthesize a LanguageSpec carrying the variant prompt; ask() reads only
      // .code and .prompt, extract() reads record.prompt + langName.
      const lang: LanguageSpec = { code: job.langCode, name: langName, prompt };
      const key = `${job.model.id}::${job.variant.id}-${job.langCode}::${job.repeat}`;
      const task: AskTask = { model: job.model, lang, repeat: job.repeat, key };

      const record = await ask(client, cfg, runId, task);
      let claimedVendor = "refused";
      let claimedModelText: string | null = null;
      let confidence = 0;
      if (record.response && !record.error) {
        const ex = await extract(client, cfg, runId, record, langName);
        claimedVendor = ex.claimedVendor;
        claimedModelText = ex.claimedModelText;
        confidence = ex.confidence;
      }
      const row: ProbeRow = {
        modelId: job.model.id,
        modelLabel: job.model.label ?? job.model.id,
        trueVendor: job.model.vendor,
        variant: job.variant.id,
        langCode: job.langCode,
        repeat: job.repeat,
        prompt,
        response: record.response,
        error: record.error,
        claimedVendor,
        claimedModelText,
        confidence,
        isSelf: claimedVendor === job.model.vendor,
      };
      fs.appendFileSync(outFile, JSON.stringify(row) + "\n");
      done++;
      const tag = row.error
        ? `✗ ${row.error}`
        : `${row.claimedVendor}${row.isSelf ? " ✓self" : ""}`;
      console.log(
        `[probe] [${done}/${total} ${since()}] ${job.model.label}/${job.variant.id}/${job.langCode}#${job.repeat} → ${tag}`,
      );
    }),
  );

  await Promise.allSettled(work);
  console.log("─".repeat(72));
  console.log(`[probe] wrote ${done}/${total} rows → ${outFile}`);
  console.log(`[probe] analyze with: npx tsx research/scripts/prompt-probe-report.ts --in ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
