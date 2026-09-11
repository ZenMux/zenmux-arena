import OpenAI from "openai";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import { EnvHttpProxyAgent, fetch as undiciFetch } from "undici";
import { extractText, makeClient } from "../lib/client";
import type { PersonalityConfig, PersonalityRecord } from "./types";

type Completion = Pick<
  PersonalityRecord,
  "generationId" | "response" | "apiProtocol" | "requestId" | "responseStatus" |
  "refusal" | "rawResponse" | "usage" | "stopReason" | "error"
>;

export type PersonalityClient = (modelId: string, prompt: string) => Promise<Completion>;

/** Reasoning may be observed in the terminal but is never persisted with a questionnaire. */
function withoutReasoning(result: OpenAIResponse): OpenAIResponse {
  return { ...result, output: result.output.filter((item) => item.type !== "reasoning") };
}

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
    // Non-streaming reasoning requests can exceed Node fetch's 5-minute header
    // timeout. Use a matching fetch/dispatcher and the SDK's 10-minute deadline.
    timeout: OpenAI.DEFAULT_TIMEOUT,
    fetch: fetch ?? (undiciFetch as unknown as typeof globalThis.fetch),
    ...(fetch ? {} : {
      fetchOptions: {
        // Honor the same HTTP(S)_PROXY / NO_PROXY environment as Node fetch.
        dispatcher: new EnvHttpProxyAgent({
          headersTimeout: OpenAI.DEFAULT_TIMEOUT,
          bodyTimeout: OpenAI.DEFAULT_TIMEOUT,
        }),
      },
    }),
  });

  return async (modelId, prompt) => {
    const stream = await client.responses.create({
      model: modelId,
      input: [{ role: "user", content: prompt }],
      max_output_tokens: config.api.maxTokens,
      ...(config.api.temperature !== null ? { temperature: config.api.temperature } : {}),
      // Long reasoning responses must keep the gateway connection active rather
      // than waiting for one large non-streaming response body.
      stream: true,
      store: false,
      // No previous_response_id/conversation: every questionnaire is independent.
    });
    let streamedText = "";
    let result: OpenAIResponse | null = null;
    let streamError: string | undefined;
    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        streamedText += event.delta;
        // JSON.stringify keeps every streamed chunk legible even when 16
        // administrations write concurrently to the same terminal.
        console.log(`[personality:stream] ${modelId} ${JSON.stringify(event.delta)}`);
      }
      if (
        event.type === "response.reasoning_text.delta" ||
        event.type === "response.reasoning_summary_text.delta"
      ) {
        // Observe reasoning live for liveness diagnostics without retaining it.
        console.log(`[personality:reasoning] ${modelId} ${JSON.stringify(event.delta)}`);
      }
      if (event.type === "response.completed" || event.type === "response.incomplete" || event.type === "response.failed") {
        result = event.response;
        console.log(
          `[personality:stream] ${modelId} ${event.type} status=${event.response.status} id=${event.response.id}`,
        );
      }
      if (event.type === "error") streamError = `${event.code ?? "stream_error"}: ${event.message}`;
    }
    if (!result) {
      return {
        apiProtocol: "responses" as const,
        generationId: null,
        response: streamedText,
        stopReason: null,
        error: streamError ?? "stream ended without a terminal response event",
      };
    }

    const messages = (result.output ?? []).filter((item) => item.type === "message");
    const content = messages.flatMap((message) => message.content ?? []);
    const finalText = content
      .filter((part) => part.type === "output_text")
      .map((part) => part.text)
      .join("")
      .trim();
    const response = streamedText || finalText;
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
      requestId: (result as OpenAIResponse & { _request_id?: string })._request_id ?? null,
      responseStatus: result.status,
      response,
      refusal: refusal || undefined,
      rawResponse: withoutReasoning(result),
      stopReason: result.incomplete_details?.reason ?? result.status ?? null,
      usage: result.usage
        ? { input: result.usage.input_tokens, output: result.usage.output_tokens }
        : undefined,
      error,
    };
  };
}
