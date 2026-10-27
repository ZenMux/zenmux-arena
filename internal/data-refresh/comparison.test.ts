import assert from "node:assert/strict";
import test from "node:test";
import { API_URL, type ApiModel } from "@research/token-economics/scrape";
import { MODEL_USAGE_URL } from "@research/token-economics/usage";
import { buildComparison as loadEconomicsData } from "./comparison";
import { validComparison } from "@research/token-economics/comparison-snapshot";
import { safeFailure } from "./job";

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

test("comparison publication retains listing, bounded launch windows, basket and free-tier merge", async (t) => {
  const previous = process.env.ZENMUX_MANAGEMENT_API_KEY;
  process.env.ZENMUX_MANAGEMENT_API_KEY = "unit-test-placeholder";
  t.after(() => { if (previous === undefined) delete process.env.ZENMUX_MANAGEMENT_API_KEY; else process.env.ZENMUX_MANAGEMENT_API_KEY = previous; });
  const calls: { url: string; init?: RequestInit & { next?: { revalidate?: number | false } } }[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === API_URL) return Response.json({ data: models });
    assert.ok(url.startsWith(MODEL_USAGE_URL));
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer unit-test-placeholder");
    const query = new URL(url).searchParams;
    assert.equal(query.get("starting_at"), "2026-01-05");
    assert.equal(query.get("ending_at"), "2026-01-22");
    return Response.json({ data: { series: [{ date: "2026-01-05", value: 10 }, { date: "2026-01-06", value: 30 }, { date: "2026-01-07", value: 1000 }] } });
  });
  const result = await loadEconomicsData();
  assert.equal(validComparison(result), true);
  assert.equal(validComparison({ ...result, data: { ...result.data, summary: null } }), false);
  assert.equal(validComparison({ ...result, provenance: { ...result.provenance, usageAvailable: false } }), false);
  assert.equal(calls[0].init?.next?.revalidate, undefined);
  assert.ok(calls.slice(1).every((call) => !call.init?.next));
  assert.equal(result.data.models.length, 1);
  assert.ok(Math.abs(result.data.models[0].blendedCost - 0.208) < 1e-12);
  assert.equal(result.data.models[0].avgDailyTokens, 30);
  assert.equal(result.data.models[0].usageTokens, 600);
  assert.equal(result.provenance.latestObservedUsageDate, "2026-01-07");
  assert.equal(result.provenance.observedModels, 2);
  assert.ok(!JSON.stringify(result).includes("unit-test-placeholder"));
});

test("missing management access rejects publication", async (t) => {
  const previous = process.env.ZENMUX_MANAGEMENT_API_KEY;
  delete process.env.ZENMUX_MANAGEMENT_API_KEY;
  t.after(() => { if (previous !== undefined) process.env.ZENMUX_MANAGEMENT_API_KEY = previous; });
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("unexpected IO"); });
  await assert.rejects(loadEconomicsData(), /Missing ZENMUX_MANAGEMENT_API_KEY/);
  assert.equal(fetch.mock.callCount(), 0);
});
test("failed usage requests reject publication instead of overwriting data with zero usage", async (t) => {
  const previous = process.env.ZENMUX_MANAGEMENT_API_KEY;
  process.env.ZENMUX_MANAGEMENT_API_KEY = "unit-test-placeholder";
  t.after(() => { if (previous === undefined) delete process.env.ZENMUX_MANAGEMENT_API_KEY; else process.env.ZENMUX_MANAGEMENT_API_KEY = previous; });
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => String(input) === API_URL
    ? Response.json({ data: models }) : new Response("unauthorized", { status: 401 }));
  await assert.rejects(loadEconomicsData(), error => {
    assert.equal(safeFailure(error), "Model usage request failed (HTTP 401).");
    return true;
  });
});
