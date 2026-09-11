import assert from "node:assert/strict";
import test from "node:test";
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
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json", "x-request-id": "req_fixture" },
    });
  });
  delete process.env.PERSONALITY_TEST_API_KEY;
  return client;
}

test("Responses sends isolated questionnaires and retains only assistant text for scoring", async () => {
  const requests: Record<string, unknown>[] = [];
  const client = mockClient(result(), (url, init) => {
    assert.equal(url, "https://zenmux.ai/api/v1/responses");
    requests.push(JSON.parse(init.body as string));
  });
  for (let i = 0; i < 2; i++) {
    const completion = await client("openai/gpt-5.6-luna:openai", "fixed prompt");
    assert.equal(completion.generationId, "resp_fixture");
    assert.equal(completion.requestId, "req_fixture");
    assert.equal(completion.apiProtocol, "responses");
    assert.equal(completion.error, undefined);
    assert.equal(parseOejtsResponse(completion.response).length, 32);
    assert.deepEqual(completion.usage, { input: 500, output: 400 });
  }
  assert.deepEqual(requests[0], requests[1]);
  assert.deepEqual(requests[0], {
    model: "openai/gpt-5.6-luna:openai",
    input: [{ role: "user", content: "fixed prompt" }],
    max_output_tokens: 8192,
    stream: false,
    store: false,
  });
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
