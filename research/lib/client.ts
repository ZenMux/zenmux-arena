// Anthropic SDK client factory, pointed at the ZenMux Messages endpoint.

import Anthropic from "@anthropic-ai/sdk";
import type { StudyConfig } from "./types";

/**
 * Build an Anthropic client targeting ZenMux. We set `maxRetries: 0` because retry/backoff
 * is owned by limiter.ts (withRetry) for unified logging, jitter, and error classification.
 */
export function makeClient(cfg: StudyConfig): Anthropic {
  const apiKey = process.env[cfg.api.apiKeyEnv];
  if (!apiKey) throw new Error(`Missing env ${cfg.api.apiKeyEnv}`);
  return new Anthropic({
    baseURL: cfg.api.baseURL,
    apiKey,
    maxRetries: 0,
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
  return content
    .filter((b): b is Anthropic.TextBlock => b?.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
