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

test("requires a majority mode and 13/16 support for every modal letter", () => {
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
    { minModalCount: 9, minLetterCount: 13 },
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
    { minModalCount: 9, minLetterCount: 13 },
  );
  assert.equal(aggregate.status, "no_stable_type");
  assert.equal(aggregate.stableType, null);
  assert.match(aggregate.reasons.join(" "), /没有唯一众数/);
});
