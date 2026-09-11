import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { withRetry } from "../lib/limiter";
import { makePersonalityClient } from "./client";
import { loadPersonalityConfig } from "./config";
import { parseOejtsResponse } from "./score";

const questionnaire = JSON.stringify({
  responses: Array.from({ length: 32 }, (_, i) => ({ id: i + 1, score: 3 })),
});

function result(overrides: Record<string, unknown> = {}) {
  return {
    id: "resp_fixture",
    object: "response",
    status: "completed",
    error: null,
    incomplete_details: null,
    output: [
      { type: "reasoning", id: "rs_fixture", summary: [] },
      {
        type: "message", role: "assistant", status: "completed", id: "msg_fixture",
        content: [{ type: "output_text", text: questionnaire, annotations: [] }],
      },
    ],
    usage: { input_tokens: 500, output_tokens: 400, total_tokens: 900 },
    ...overrides,
  };
}

function mockClient(body: Record<string, unknown>, inspect?: (url: string, init: RequestInit) => void) {
  const config = structuredClone(loadPersonalityConfig());
  config.api.apiKeyEnv = "PERSONALITY_TEST_API_KEY";
  process.env.PERSONALITY_TEST_API_KEY = "synthetic-test-key";
  const client = makePersonalityClient(config, async (input, init) => {
    inspect?.(String(input), init!);
    const text = body.status === "completed" && JSON.stringify(body.output).includes('"output_text"')
      ? `data: ${JSON.stringify({ type: "response.output_text.delta", delta: questionnaire })}\n\n`
      : "";
    const terminal = body.status === "completed" ? "response.completed"
      : body.status === "incomplete" ? "response.incomplete" : "response.failed";
    return new Response(`${text}data: ${JSON.stringify({ type: terminal, response: body })}\n\ndata: [DONE]\n\n`, {
      status: 200,
      headers: { "content-type": "text/event-stream", "x-request-id": "req_fixture" },
    });
  });
  delete process.env.PERSONALITY_TEST_API_KEY;
  return client;
}

test("Responses works over the matching undici fetch and dispatcher", async () => {
  const server = createServer((request, response) => {
    request.resume();
    const body = result();
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      `data: ${JSON.stringify({ type: "response.output_text.delta", delta: questionnaire })}\n\n` +
      `data: ${JSON.stringify({ type: "response.completed", response: body })}\n\ndata: [DONE]\n\n`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const config = structuredClone(loadPersonalityConfig());
  config.api.baseURL = `http://127.0.0.1:${address.port}/v1`;
  config.api.apiKeyEnv = "PERSONALITY_TRANSPORT_TEST_API_KEY";
  const previous = process.env.PERSONALITY_TRANSPORT_TEST_API_KEY;
  const previousNoProxy = process.env.no_proxy;
  process.env.PERSONALITY_TRANSPORT_TEST_API_KEY = "synthetic-test-key";
  process.env.no_proxy = "127.0.0.1";
  try {
    const completion = await makePersonalityClient(config)("example/model:example", "prompt");
    assert.equal(completion.error, undefined);
    assert.equal(parseOejtsResponse(completion.response).length, 32);
  } finally {
    if (previous === undefined) delete process.env.PERSONALITY_TRANSPORT_TEST_API_KEY;
    else process.env.PERSONALITY_TRANSPORT_TEST_API_KEY = previous;
    if (previousNoProxy === undefined) delete process.env.no_proxy;
    else process.env.no_proxy = previousNoProxy;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Responses sends isolated questionnaires and retains only assistant text for scoring", async () => {
  const requests: Record<string, unknown>[] = [];
  const client = mockClient(result(), (url, init) => {
    assert.equal(url, "https://zenmux.ai/api/v1/responses");
    requests.push(JSON.parse(init.body as string));
  });
  for (let i = 0; i < 2; i++) {
    const completion = await client("openai/gpt-5.6-luna:openai", "fixed prompt");
    assert.equal(completion.generationId, "resp_fixture");
    assert.equal(completion.requestId, null);
    assert.equal(completion.apiProtocol, "responses");
    assert.equal(completion.error, undefined);
    assert.equal(parseOejtsResponse(completion.response).length, 32);
    assert.deepEqual(completion.usage, { input: 500, output: 400 });
  }
  assert.deepEqual(requests[0], requests[1]);
  assert.deepEqual(requests[0], {
    model: "openai/gpt-5.6-luna:openai",
    input: [{ role: "user", content: "fixed prompt" }],
    max_output_tokens: 16384,
    stream: true,
    store: false,
  });
});

test("reasoning is excluded from persisted raw Responses", async () => {
  const completion = await mockClient(result())("example/model:example", "prompt");
  const raw = completion.rawResponse as { output?: Array<{ type?: string }> };
  assert.ok(raw.output);
  assert.equal(raw.output.some((item) => item.type === "reasoning"), false);
});

test("incomplete Responses remain invalid even if all 32 answers are present", async () => {
  const completion = await mockClient(result({
    status: "incomplete", incomplete_details: { reason: "max_output_tokens" },
  }))("example/model:example", "prompt");
  assert.equal(parseOejtsResponse(completion.response).length, 32);
  assert.match(completion.error!, /incomplete.*max_output_tokens/);
  assert.equal(completion.stopReason, "max_output_tokens");
  assert.ok(completion.rawResponse);
});

test("refusal content is preserved and cannot be scored as a valid questionnaire", async () => {
  const completion = await mockClient(result({
    output: [{
      type: "message", role: "assistant", status: "completed", id: "msg_refusal",
      content: [{ type: "refusal", refusal: "I cannot complete this questionnaire." }],
    }],
  }))("example/model:example", "prompt");
  assert.equal(completion.refusal, "I cannot complete this questionnaire.");
  assert.match(completion.error!, /refusal/);
  assert.equal(completion.response, "");
});

test("API-level and message-level failures cannot become valid answers", async () => {
  const failed = await mockClient(result({
    status: "failed", error: { code: "server_error", message: "upstream failed" },
  }))("example/model:example", "prompt");
  assert.match(failed.error!, /server_error: upstream failed/);
  const body = result();
  body.output[1].status = "incomplete";
  const incompleteMessage = await mockClient(body)("example/model:example", "prompt");
  assert.match(incompleteMessage.error!, /incomplete output message/);
});

test("shared retry preserves HTTP classification for OpenAI and Anthropic SDKs", async () => {
  for (const SDK of [OpenAI, Anthropic]) {
    let attempts = 0;
    await assert.rejects(withRetry(async () => {
      attempts++;
      throw SDK.APIError.generate(400, { message: "bad parameter" }, "bad parameter", new Headers());
    }, { maxRetries: 3, baseMs: 0 }), /bad parameter/);
    assert.equal(attempts, 1);

    attempts = 0;
    const delays: number[] = [];
    const value = await withRetry(async () => {
      if (++attempts === 1) {
        throw SDK.APIError.generate(429, { message: "rate limited" }, "rate limited", new Headers({ "retry-after": "0" }));
      }
      return "ok";
    }, { maxRetries: 1, onRetry: ({ delayMs }) => delays.push(delayMs) });
    assert.equal(value, "ok");
    assert.deepEqual(delays, [0]);
    assert.equal(attempts, 2);
  }
});
