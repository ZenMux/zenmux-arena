import assert from "node:assert/strict";
import test from "node:test";
import { loadOejtsInstrument } from "./instrument";
import { aggregateModel, parseOejtsResponse, scoreAdministration } from "./score";
import type { OejtsAnswer, PersonalityModelSpec, PersonalityRecord } from "./types";

const { instrument } = loadOejtsInstrument("research/instruments/oejts-1.2.json");

function answersForExtreme(high: boolean): OejtsAnswer[] {
  const byId = new Map<number, number>();
  for (const rule of Object.values(instrument.scoring)) {
    for (const [rawId, sign] of Object.entries(rule.signs)) {
      byId.set(Number(rawId), high ? (sign === 1 ? 5 : 1) : sign === 1 ? 1 : 5);
    }
  }
  return Array.from(byId, ([id, score]) => ({ id, score })).sort((a, b) => a.id - b.id);
}

test("loads the canonical 32-item instrument with eight items per dimension", () => {
  assert.equal(instrument.items.length, 32);
  for (const dimension of ["IE", "SN", "FT", "JP"]) {
    assert.equal(instrument.items.filter((item) => item.dimension === dimension).length, 8);
  }
});

test("scores the documented 8..40 bounds", () => {
  const low = scoreAdministration(instrument, "low", 0, answersForExtreme(false));
  const high = scoreAdministration(instrument, "high", 0, answersForExtreme(true));
  for (const dimension of ["IE", "SN", "FT", "JP"] as const) {
    assert.equal(low.dimensions[dimension].score, 8);
    assert.equal(high.dimensions[dimension].score, 40);
  }
  assert.equal(low.type, "ISFJ");
  assert.equal(high.type, "ENTP");
});

test("all midpoint responses land on the official low-letter boundary", () => {
  const answers = Array.from({ length: 32 }, (_, index) => ({ id: index + 1, score: 3 }));
  const scored = scoreAdministration(instrument, "mid", 0, answers);
  assert.equal(scored.type, "ISFJ");
  for (const dimension of ["IE", "SN", "FT", "JP"] as const) {
    assert.equal(scored.dimensions[dimension].score, 24);
    assert.equal(scored.dimensions[dimension].boundary, true);
  }
});

test("parses a complete strict JSON response", () => {
  const raw = JSON.stringify({
    instrument: "OEJTS-1.2",
    responses: Array.from({ length: 32 }, (_, index) => ({ id: index + 1, score: 3 })),
  });
  assert.equal(parseOejtsResponse(raw).length, 32);
});

test("reports a stable type when all complete types agree", () => {
  const model: PersonalityModelSpec = {
    id: "example/model:example",
    baseModelId: "example/model",
    manufacturer: "example",
    providerSlug: "example",
    label: "Example",
    catalogPublishDate: "2026-01-01",
  };
  const answers = answersForExtreme(true);
  const records: PersonalityRecord[] = Array.from({ length: 16 }, (_, repeat) => ({
    key: `${model.id}::${repeat}`,
    runId: "test/run",
    timestamp: new Date(0).toISOString(),
    modelId: model.id,
    baseModelId: model.baseModelId,
    manufacturer: model.manufacturer,
    providerSlug: model.providerSlug,
    repeat,
    instrumentId: "oejts-1.2",
    instrumentSha256: "test",
    promptVersion: "test",
    promptSha256: "test",
    generationId: `generation-${repeat}`,
    response: "{}",
    answers,
  }));
  const aggregate = aggregateModel(
    model,
    records,
    instrument,
    { minModalCount: 9 },
  );
  assert.equal(aggregate.status, "stable");
  assert.equal(aggregate.stableType, "ENTP");
  assert.equal(aggregate.modalCount, 16);
});

test("reports no stable type when the 16 administrations split evenly", () => {
  const model: PersonalityModelSpec = {
    id: "example/model:example",
    baseModelId: "example/model",
    manufacturer: "example",
    providerSlug: "example",
    label: "Example",
    catalogPublishDate: "2026-01-01",
  };
  const high = answersForExtreme(true);
  const low = answersForExtreme(false);
  const records: PersonalityRecord[] = Array.from({ length: 16 }, (_, repeat) => ({
    key: `${model.id}::${repeat}`,
    runId: "test/run",
    timestamp: new Date(0).toISOString(),
    modelId: model.id,
    baseModelId: model.baseModelId,
    manufacturer: model.manufacturer,
    providerSlug: model.providerSlug,
    repeat,
    instrumentId: "oejts-1.2",
    instrumentSha256: "test",
    promptVersion: "test",
    promptSha256: "test",
    generationId: `generation-${repeat}`,
    response: "{}",
    answers: repeat < 8 ? high : low,
  }));
  const aggregate = aggregateModel(
    model,
    records,
    instrument,
    { minModalCount: 9 },
  );
  assert.equal(aggregate.status, "no_stable_type");
  assert.equal(aggregate.stableType, null);
  assert.match(aggregate.reasons.join(" "), /没有唯一众数/);
});

const fixtureModel: PersonalityModelSpec = {
  id: "example/model:example", baseModelId: "example/model", manufacturer: "example",
  providerSlug: "example", label: "Example", catalogPublishDate: "2026-01-01",
};
function recordsForTypes(types: string[]): PersonalityRecord[] {
  return types.map((type, repeat) => {
    const scores = new Map<number, number>();
    Object.values(instrument.scoring).forEach((rule, index) => {
      const high = type[index] === rule.highLetter;
      for (const [id, sign] of Object.entries(rule.signs)) scores.set(Number(id), high === (sign === 1) ? 5 : 1);
    });
    return {
      key: `${fixtureModel.id}::${repeat}`, runId: "test/run", timestamp: new Date(0).toISOString(),
      modelId: fixtureModel.id, baseModelId: fixtureModel.baseModelId, manufacturer: "example",
      providerSlug: "example", repeat, instrumentId: "oejts-1.2", instrumentSha256: "test",
      promptVersion: "test", promptSha256: "test", generationId: `generation-${repeat}`,
      response: "{}", answers: [...scores].map(([id, score]) => ({ id, score })),
    };
  });
}

test("9/16 is stable even when every modal letter has only 9/16 support", () => {
  const result = aggregateModel(fixtureModel, recordsForTypes([
    ...Array<string>(9).fill("ENTP"), ...Array<string>(7).fill("ISFJ"),
  ]), instrument, { minModalCount: 9 });
  assert.equal(result.stableType, "ENTP");
  assert.equal(result.status, "stable");
  assert.deepEqual(result.reasons, []);
  for (const letter of "ENTP") assert.equal(result.letterCounts[letter], 9);
});

test("a unique 8/16 mode is not a strict majority", () => {
  const result = aggregateModel(fixtureModel, recordsForTypes([
    ...Array<string>(8).fill("INTJ"), ...Array<string>(5).fill("ISTJ"), ...Array<string>(3).fill("ENTJ"),
  ]), instrument, { minModalCount: 9 });
  assert.equal(result.modalType, "INTJ");
  assert.equal(result.modalCount, 8);
  assert.equal(result.stableType, null);
  assert.equal(result.status, "no_stable_type");
  assert.equal(result.reasons.length, 1);
  assert.match(result.reasons[0], /8\/16/);
});

test("fewer than 16 valid questionnaires cannot be classified", () => {
  for (const n of [0, 9, 15, 17]) assert.throws(() => aggregateModel(
    fixtureModel, recordsForTypes(Array<string>(n).fill("INTJ")), instrument, { minModalCount: 9 },
  ), /exactly 16/);
});
