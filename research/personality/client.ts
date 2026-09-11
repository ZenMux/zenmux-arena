import OpenAI from "openai";
import { extractText, makeClient } from "../lib/client";
import type { PersonalityConfig, PersonalityRecord } from "./types";

type Completion = Pick<
  PersonalityRecord,
  "generationId" | "response" | "apiProtocol" | "requestId" | "responseStatus" |
  "refusal" | "rawResponse" | "usage" | "stopReason" | "error"
>;

export type PersonalityClient = (modelId: string, prompt: string) => Promise<Completion>;

export function makePersonalityClient(
  config: PersonalityConfig,
  fetch?: typeof globalThis.fetch,
): PersonalityClient {
  // Preserve the transport of pre-Responses run snapshots.
  if (config.api.protocol === "messages") {
    const client = makeClient(config);
    return async (modelId, prompt) => {
      const message = await client.messages.create({
        model: modelId,
        max_tokens: config.api.maxTokens,
        ...(config.api.temperature !== null ? { temperature: config.api.temperature } : {}),
        messages: [{ role: "user", content: prompt }],
      });
      return {
        apiProtocol: "messages",
        generationId: message.id,
        response: extractText(message),
        stopReason: message.stop_reason,
        usage: { input: message.usage.input_tokens, output: message.usage.output_tokens },
      };
    };
  }

  const apiKey = process.env[config.api.apiKeyEnv];
  if (!apiKey) throw new Error(`Missing env ${config.api.apiKeyEnv}`);
  const client = new OpenAI({
    baseURL: config.api.baseURL,
    apiKey,
    maxRetries: 0, // Shared withRetry owns backoff and Retry-After.
    ...(fetch ? { fetch } : {}),
  });

  return async (modelId, prompt) => {
    const result = await client.responses.create({
      model: modelId,
      input: [{ role: "user", content: prompt }],
      max_output_tokens: config.api.maxTokens,
      ...(config.api.temperature !== null ? { temperature: config.api.temperature } : {}),
      stream: false,
      store: false,
      // No previous_response_id/conversation: every questionnaire is independent.
    });
    const messages = (result.output ?? []).filter((item) => item.type === "message");
    const content = messages.flatMap((message) => message.content ?? []);
    const response = content
      .filter((part) => part.type === "output_text")
      .map((part) => part.text)
      .join("")
      .trim();
    const refusal = content
      .filter((part) => part.type === "refusal")
      .map((part) => part.refusal)
      .join("\n");
    const error = result.error
      ? `${result.error.code}: ${result.error.message}`
      : result.status !== "completed"
        ? `response ${result.status ?? "missing status"}: ${result.incomplete_details?.reason ?? "not completed"}`
        : messages.some((message) => message.status !== "completed")
          ? "incomplete output message"
          : refusal ? `refusal: ${refusal}` : undefined;

    return {
      apiProtocol: "responses",
      generationId: result.id ?? null,
      requestId: result._request_id ?? null,
      responseStatus: result.status,
      response,
      refusal: refusal || undefined,
      rawResponse: result,
      stopReason: result.incomplete_details?.reason ?? result.status ?? null,
      usage: result.usage
        ? { input: result.usage.input_tokens, output: result.usage.output_tokens }
        : undefined,
      error,
    };
  };
}
