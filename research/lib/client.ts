// Anthropic SDK client factory, pointed at the ZenMux Messages endpoint.

import Anthropic from "@anthropic-ai/sdk";

export interface ZenMuxClientConfig {
  api: {
    baseURL: string;
    apiKeyEnv: string;
  };
}

/**
 * Build an Anthropic client targeting ZenMux. We set `maxRetries: 0` because retry/backoff
 * is owned by limiter.ts (withRetry) for unified logging, jitter, and error classification.
 *
 * The API version is pinned: newer @anthropic-ai/sdk releases default to a much later
 * `anthropic-version` (1.3.0 sends 2026-10-21), and ZenMux's Messages shim rejects
 * anything but 2023-06-01 with HTTP 400. Leave the pin in place even if the SDK default
 * moves again.
 */
export function makeClient(cfg: ZenMuxClientConfig): Anthropic {
  const apiKey = process.env[cfg.api.apiKeyEnv];
  if (!apiKey) throw new Error(`Missing env ${cfg.api.apiKeyEnv}`);
  return new Anthropic({
    baseURL: cfg.api.baseURL,
    apiKey,
    maxRetries: 0,
    defaultHeaders: { "anthropic-version": "2023-06-01" },
  });
}

/**
 * Concatenate all text blocks of a Messages response into a single string.
 * Defensive: some upstream shims return a message whose `content` is missing or
 * not an array (e.g. a reasoning-only response, or a non-conformant body). Treat
 * any such case as empty text rather than throwing — callers parse robustly and
 * an empty string degrades to a normal "no usable output" result.
 */
export function extractText(message: Anthropic.Message): string {
  const content = message?.content;
  if (!Array.isArray(content)) return "";
  return flattenText(
    content.filter((b): b is Anthropic.TextBlock => b?.type === "text").map((b) => b.text),
  ).trim();
}

/**
 * Flatten a text payload into a single string.
 *
 * Most providers put a plain string in a text block, but some routes (e.g. Mistral
 * behind the ZenMux shim) nest structured blocks inside `text`:
 *   `[{ type: "text", text: [{ type: "thinking", ... }, { type: "text", text: "…" }] }]`
 * A naive `join` turned that into `"[object Object],[object Object]"`, so the stored
 * answer carried no identity at all. Recurse into arrays and nested blocks, but skip
 * reasoning/thinking leaves: the record must hold what the model *said*, not its
 * chain of thought.
 */
export function flattenText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flattenText).join("");
  if (!value || typeof value !== "object") return "";
  const block = value as {
    type?: unknown;
    text?: unknown;
    content?: unknown;
    thinking?: unknown;
    reasoning?: unknown;
  };
  if (
    block.type === "thinking" ||
    block.type === "reasoning" ||
    block.type === "thinking_text" ||
    block.type === "reasoning_text"
  ) {
    return "";
  }
  if (block.text !== undefined) return flattenText(block.text);
  if (block.content !== undefined) return flattenText(block.content);
  if (Array.isArray(block.thinking)) return flattenText(block.thinking);
  if (Array.isArray(block.reasoning)) return flattenText(block.reasoning);
  return "";
}
