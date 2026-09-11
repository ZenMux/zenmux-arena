import assert from "node:assert/strict";
import test from "node:test";
import { API_URL, type ApiModel } from "@research/token-economics/scrape";
import { MANAGEMENT_KEY_ENV, MODEL_USAGE_URL } from "@research/token-economics/usage";
import { loadEconomicsData } from "./loader";

// Isolated transport fixtures only: no external IO, credentials or model calls.
const models: ApiModel[] = [{
  slug: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro",
  pricing_prompt: "2", pricing_completion: "8", all_tokens: 500,
  publish_time: "2026-01-05",
}, {
  slug: "deepseek/deepseek-v4-pro-free", name: "DeepSeek V4 Pro Free",
  pricing_prompt: 0, pricing_completion: 0, all_tokens: 100,
  publish_time: "2026-01-05", isFree: true,
}];

test("talk loader retains live listing, 24h bounded launch windows, basket and free-tier merge", async (t) => {
  const previous = process.env[MANAGEMENT_KEY_ENV];
  process.env[MANAGEMENT_KEY_ENV] = "unit-test-placeholder";
  t.after(() => { if (previous === undefined) delete process.env[MANAGEMENT_KEY_ENV]; else process.env[MANAGEMENT_KEY_ENV] = previous; });
  const calls: { url: string; init?: RequestInit & { next?: { revalidate?: number | false } } }[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === API_URL) return Response.json({ data: models });
    assert.ok(url.startsWith(MODEL_USAGE_URL));
    const query = new URL(url).searchParams;
    assert.equal(query.get("starting_at"), "2026-01-05");
    assert.equal(query.get("ending_at"), "2026-01-22");
    return Response.json({ data: { series: [{ date: "2026-01-05", value: 10 }, { date: "2026-01-06", value: 30 }, { date: "2026-01-07", value: 1000 }] } });
  });
  const result = await loadEconomicsData();
  assert.equal(calls[0].init?.next?.revalidate, 0);
  assert.ok(calls.slice(1).every((call) => call.init?.next?.revalidate === 86400));
  assert.equal(result.data.models.length, 1);
  assert.ok(Math.abs(result.data.models[0].blendedCost - 0.208) < 1e-12);
  assert.equal(result.data.models[0].avgDailyTokens, 30);
  assert.equal(result.data.models[0].usageTokens, 600);
  assert.equal(result.provenance.latestObservedUsageDate, "2026-01-07");
  assert.equal(result.provenance.observedModels, 2);
  assert.ok(!JSON.stringify(result).includes("unit-test-placeholder"));
});

test("missing management access preserves null usage and explicitly reports unavailable coverage", async (t) => {
  const previous = process.env[MANAGEMENT_KEY_ENV];
  delete process.env[MANAGEMENT_KEY_ENV];
  t.after(() => { if (previous !== undefined) process.env[MANAGEMENT_KEY_ENV] = previous; });
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({ data: models }));
  const result = await loadEconomicsData();
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(result.data.models[0].avgDailyTokens, null);
  assert.equal(result.provenance.managementConfigured, false);
  assert.equal(result.provenance.latestObservedUsageDate, null);
});

test("failed launch usage stays explicitly unobserved; listing errors reject", async (t) => {
  const previous = process.env[MANAGEMENT_KEY_ENV];
  process.env[MANAGEMENT_KEY_ENV] = "unit-test-placeholder";
  t.after(() => { if (previous === undefined) delete process.env[MANAGEMENT_KEY_ENV]; else process.env[MANAGEMENT_KEY_ENV] = previous; });
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => String(input) === API_URL
    ? Response.json({ data: models })
    : new Response("unauthorized", { status: 401 }));
  const result = await loadEconomicsData();
  assert.equal(result.provenance.observedModels, 0);
  assert.equal(result.provenance.requestedModels, 2);
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => new Response("unavailable", { status: 503 }));
  await assert.rejects(loadEconomicsData(), /503/);
});
