import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import type { LiveTokenEconomicsPayload, LiveUsagePoint } from "@research/token-economics/live-config";
import { payloadHash } from "@research/cache/payload";
import { LiveLeaderboard } from "../../../token-economics/LiveLeaderboard";
import { deepSeekChallengeHistory } from "./index";
import { HISTORY_FROM, HISTORY_TO, selectHistoricalWindow } from "./window";

function fixture(): LiveTokenEconomicsPayload {
  const source = structuredClone(deepSeekChallengeHistory.payload);
  const base = source.anchors[0].models[0];
  const point = (t: string, tokens: number): LiveUsagePoint => ({
    t, tokens, cost: tokens / 10, requests: tokens, promptTokens: tokens, completionTokens: 0, reasoningTokens: 0,
  });
  base.points = [
    point("2026-06-22T00:00:00.000Z", 1000),
    point("2026-06-23T00:00:00.000Z", 3),
    point("2026-06-24T00:00:00.000Z", 7),
    point("2026-06-25T00:00:00.000Z", 9000),
  ];
  // Deliberately invalid all-time rollups must never escape into selected data.
  base.totalTokens = 999999;
  base.totalCost = 999999;
  base.totalRequests = 999999;
  base.peakTokens = 999999;
  source.anchors = [{ ...source.anchors[0], models: [base], totalTokens: 999999 }];
  source.unanchored = [];
  source.from = "2026-06-22T00:00:00.000Z";
  source.to = "2026-06-26T00:00:00.000Z";
  return source;
}

test("frozen artifact has every model/day, exact inclusive end, and matching content hash", () => {
  const artifact = deepSeekChallengeHistory;
  assert.equal(artifact.window.from, HISTORY_FROM);
  assert.equal(artifact.window.to, HISTORY_TO);
  assert.equal(artifact.window.endDateInclusive, "2026-08-23");
  assert.equal(artifact.window.days, 62);
  assert.equal(artifact.provenance.sourceTo, "2026-09-11T00:00:00.000Z");
  assert.equal(payloadHash(artifact.payload), artifact.provenance.selectedPayloadSha256);
  const verified = selectHistoricalWindow(artifact.payload);
  assert.equal(verified.coverage.length, 25);
  assert.equal(verified.coverage.reduce((n, model) => n + model.days, 0), 1550);
  for (const model of verified.coverage) {
    assert.equal(model.first, HISTORY_FROM);
    assert.equal(model.last, "2026-08-23T00:00:00.000Z");
  }
  assert.deepEqual(verified.payload, artifact.payload);
});

test("window totals/peaks/latest rebase from raw daily observations, excluding both outside tails", () => {
  const source = fixture();
  const original = structuredClone(source);
  const { payload } = selectHistoricalWindow(source, HISTORY_FROM, "2026-06-25T00:00:00.000Z");
  const model = payload.anchors[0].models[0];
  assert.deepEqual(model.points.map((point) => point.tokens), [3, 7]);
  assert.equal(model.totalTokens, 10);
  assert.equal(model.totalCost, 1);
  assert.equal(model.totalRequests, 10);
  assert.equal(model.latestTokens, 7);
  assert.equal(model.peakTokens, 7);
  assert.equal(payload.anchors[0].totalTokens, 10);
  assert.equal(payload.anchors[0].peakCost, 0.7);
  assert.deepEqual(source, original, "export must not mutate its persisted source");
});

test("incomplete coverage, missing/duplicate days, wrong granularity and invalid metrics fail closed", () => {
  const cases: ((source: LiveTokenEconomicsPayload) => void)[] = [
    (source) => { source.from = "2026-06-24T00:00:00.000Z"; },
    (source) => { source.to = "2026-06-24T00:00:00.000Z"; },
    (source) => { source.bucketSeconds = 300; },
    (source) => { source.range = "72h"; },
    (source) => { source.anchors[0].models[0].points.splice(1, 1); },
    (source) => { source.anchors[0].models[0].points[2].t = HISTORY_FROM; },
    (source) => { source.anchors[0].models[0].points[1].tokens = NaN; },
  ];
  for (const mutate of cases) {
    const source = fixture();
    mutate(source);
    assert.throws(() => selectHistoricalWindow(source, HISTORY_FROM, "2026-06-25T00:00:00.000Z"));
  }
});

test("history mounts no live fetch/poll effect and exposes only fixed-period controls", async (t) => {
  // Execute mount effects captured during the real React server render. This
  // catches accidentally mounting RealtimeLeaderboard/useDealsFeed: their
  // fetch effects would run here. Measurement effects see unmounted null refs.
  const react = createRequire(import.meta.url)("react") as typeof import("react");
  const effects: (() => void | (() => void))[] = [];
  t.mock.method(react, "useEffect", (effect: () => void | (() => void)) => { effects.push(effect); });
  const network = t.mock.method(globalThis, "fetch", async () => { throw new Error("History must not fetch"); });
  const timers = t.mock.method(globalThis, "setTimeout", () => { throw new Error("History must not poll"); });
  const html = renderToStaticMarkup(<LiveLeaderboard presentation historicalData={deepSeekChallengeHistory} />);
  assert.ok(effects.length > 0, "test must capture mount effects, not just SSR output");
  const cleanup = effects.map((effect) => effect());
  await Promise.resolve();
  for (const dispose of cleanup) if (typeof dispose === "function") dispose();
  assert.equal(network.mock.callCount(), 0);
  assert.equal(timers.mock.callCount(), 0);
  assert.match(html, />DAILY</);
  assert.match(html, />TOTAL</);
  assert.match(html, />TOKENS</);
  assert.match(html, />COST</);
  assert.match(html, /2026-06-23/);
  assert.match(html, /2026-08-23/);
  assert.doesNotMatch(html, />LIVE<|>ALL<|>72H<|>Refresh<|repeatCount="indefinite"/);
});

test("omitting historicalData retains the original live controls", () => {
  const html = renderToStaticMarkup(<LiveLeaderboard presentation />);
  assert.match(html, />LIVE</);
  assert.match(html, />ALL</);
  assert.match(html, />72H</);
  assert.match(html, /Refresh/);
});

test("campaign status uses the final included millisecond, not the later source generation", () => {
  const history = structuredClone(deepSeekChallengeHistory);
  history.payload.anchors = [history.payload.anchors[0]];
  history.payload.anchors[0].models = [history.payload.anchors[0].models[0]];
  const model = history.payload.anchors[0].models[0];
  model.endDate = "2026-08-23";
  const activeOnLastDay = renderToStaticMarkup(<LiveLeaderboard presentation historicalData={history} />);
  assert.doesNotMatch(activeOnLastDay, /campaign ended|pricing reverted|>Ended/);
  assert.match(activeOnLastDay, /2026-09-11/, "provenance retains source generation");
  model.endDate = "2026-08-22";
  const endedBeforeLastDay = renderToStaticMarkup(<LiveLeaderboard presentation historicalData={history} />);
  assert.match(endedBeforeLastDay, /campaign ended/);
});
