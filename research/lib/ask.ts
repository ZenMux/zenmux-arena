// Ask one (model, language, repeat) and produce a RawRecord.

import type Anthropic from "@anthropic-ai/sdk";
import { extractText } from "./client";
import { describeError, withRetry } from "./limiter";
import type { LanguageSpec, ModelSpec, RawRecord, StudyConfig } from "./types";

export function makeKey(modelId: string, langCode: string, repeat: number): string {
  return `${modelId}::${langCode}::${repeat}`;
}

export interface AskTask {
  model: ModelSpec;
  lang: LanguageSpec;
  repeat: number;
  key: string;
}

/** Enumerate the full task list: models × languages × repeats. */
export function enumerateTasks(cfg: StudyConfig): AskTask[] {
  const tasks: AskTask[] = [];
  for (const model of cfg.models) {
    for (const lang of cfg.languages) {
      for (let r = 0; r < cfg.repeats; r++) {
        tasks.push({ model, lang, repeat: r, key: makeKey(model.id, lang.code, r) });
      }
    }
  }
  return tasks;
}

/** Tasks for one (model, language), ordered by repeat. */
export function tasksForModelLang(cfg: StudyConfig, model: ModelSpec, lang: LanguageSpec): AskTask[] {
  const tasks: AskTask[] = [];
  for (let r = 0; r < cfg.repeats; r++) {
    tasks.push({ model, lang, repeat: r, key: makeKey(model.id, lang.code, r) });
  }
  return tasks;
}

/** Ask one question; never throws — returns a RawRecord (with `error` set on failure). */
export async function ask(
  client: Anthropic,
  cfg: StudyConfig,
  runId: string,
  task: AskTask,
): Promise<RawRecord> {
  const base: Omit<RawRecord, "response" | "generationId"> = {
    key: task.key,
    runId,
    timestamp: new Date().toISOString(),
    modelId: task.model.id,
    modelVendor: task.model.vendor,
    langCode: task.lang.code,
    prompt: task.lang.prompt,
  };

  try {
    const message = await withRetry(
      () =>
        client.messages.create({
          model: task.model.id,
          max_tokens: cfg.api.maxTokens,
          messages: [{ role: "user", content: task.lang.prompt }],
        }),
      {
        maxRetries: cfg.api.maxRetries,
        baseMs: cfg.api.retryBaseMs,
        capMs: cfg.api.retryCapMs,
        onRetry: ({ attempt, delayMs, error }) =>
          console.log(
            `[run]   ↻ retry ${task.key} attempt ${attempt}/${cfg.api.maxRetries} in ${Math.round(delayMs)}ms — ${describeError(error)}`,
          ),
      },
    );
    return {
      ...base,
      timestamp: new Date().toISOString(),
      generationId: message.id ?? null,
      response: extractText(message),
      usage: message.usage
        ? { input: message.usage.input_tokens, output: message.usage.output_tokens }
        : undefined,
    };
  } catch (err) {
    return {
      ...base,
      timestamp: new Date().toISOString(),
      generationId: null,
      response: "",
      error: describeError(err),
    };
  }
}
