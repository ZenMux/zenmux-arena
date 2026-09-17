import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { scoreAdministration, aggregateModel } from "@research/personality/score";
import type { PersonalityRecord } from "@research/personality/types";
import { loadMbtiTalkData } from "./data";

test("talk data is JSON-serializable, complete, and uses existing local assets", async () => {
  const data = await loadMbtiTalkData();
  assert.deepEqual(JSON.parse(JSON.stringify(data)), data);
  assert.equal(data.models.length, 27);
  assert.equal(data.summary.questionnaireCount, 432);
  assert.equal(data.summary.stableCount, 22);
  assert.equal(data.summary.unstableCount, 5);
  assert.deepEqual(data.summary.stableGroups.map(({ type, count }) => [type, count]), [["INTJ", 13], ["ISTJ", 9]]);
  assert.deepEqual(data.classification, { minModalCount: 9 });
  assert.equal(data.summary.onlySnVariationCount, data.models.filter((m) =>
    m.dimensions.SN.lowLetterCount > 0 && m.dimensions.SN.highLetterCount > 0
    && [m.dimensions.IE, m.dimensions.FT, m.dimensions.JP].every((d) => !d.lowLetterCount || !d.highLetterCount),
  ).length);
  assert.equal(data.summary.unanimousCount, 6);
  assert.equal(data.instrument.items.length, 32);
  assert.equal(new Set(data.models.map((m) => m.id)).size, 27);
  const assets = new Set(data.models.flatMap((m) => [m.logo, ...m.distribution.map((d) => d.illustration)]));
  await Promise.all([...assets].map((asset) => access(path.join(process.cwd(), "public", asset))));
  assert.equal(data.models.find((m) => m.id.startsWith("mistralai/"))?.provider, "azure");
  assert.ok(!data.models.some((m) => m.id.includes("agnes")));
  for (const budget of ["8192", "16384", "50000"]) assert.ok(data.runNotes.some((n) => n.detail.includes(budget)));
  // Keep transport details and the superseded manufacturer-only description off the client.
  assert.ok(!JSON.stringify(data).includes("manufacturer-operated providers"));
  assert.ok(!JSON.stringify(data).includes("rawResponse"));
});

test("all 432 displayed replicates, distributions, statistics and verdicts agree with raw questionnaires", async () => {
  const data = await loadMbtiTalkData();
  const raw = await readFile(path.join(process.cwd(), "results/llm-mbti-oejts/20260911T040759/records.jsonl"), "utf8");
  const valid = new Map<string, PersonalityRecord>();
  for (const line of raw.trim().split("\n")) {
    const record = JSON.parse(line) as PersonalityRecord;
    if (record.answers && !record.error && !record.parseError) valid.set(`${record.modelId}::${record.repeat}`, record);
  }
  for (const model of data.models) {
    const records = model.replicates.map((rep) => {
      const record = valid.get(`${model.id}::${rep.repeat}`);
      assert.ok(record, `${model.name} #${rep.repeat} must have valid source answers`);
      return record;
    });
    const checked = aggregateModel({
      id: model.id, label: model.name, baseModelId: model.id.split(":")[0],
      providerSlug: model.provider, manufacturer: "", catalogPublishDate: "",
    }, records, data.instrument, data.classification);
    assert.equal(checked.stableType, model.stableType, model.name);
    assert.equal(checked.status, model.status, model.name);
    assert.equal(checked.modalCount, model.modalCount, model.name);
    assert.deepEqual(checked.reasons, model.reasons, model.name);
    assert.deepEqual(checked.dimensions, model.dimensions, model.name);
    assert.deepEqual(checked.letterCounts, model.letterCounts, model.name);
    assert.deepEqual(checked.typeCounts, Object.fromEntries(model.distribution.map((d) => [d.type, d.count])), model.name);
    for (const rep of model.replicates) {
      const checkedRep = checked.administrations.find((r) => r.repeat === rep.repeat)!;
      assert.equal(checkedRep.type, rep.type);
      for (const d of ["IE", "SN", "FT", "JP"] as const) assert.equal(checkedRep.dimensions[d].score, rep.scores[d]);
    }
  }
  const gemini = data.models.find((m) => m.name === "Gemini 3.8 Flash")!;
  const step = data.models.find((m) => m.name === "Step 3.7 Flash")!;
  assert.equal(gemini.modalCount, step.modalCount);
  assert.equal(gemini.letterCounts.S, 12);
  assert.equal(step.letterCounts.S, 14);
  assert.equal(gemini.status, "stable");
  assert.equal(step.status, "stable");
});

test("interactive mixed-sign scoring retains the exact 24 boundary and 8–40 endpoints", async () => {
  const { instrument } = await loadMbtiTalkData();
  const neutral = instrument.items.map((item) => ({ id: item.id, score: 3 }));
  const midpoint = scoreAdministration(instrument, "local-test", 0, neutral);
  assert.equal(midpoint.type, "ISFJ");
  for (const dimension of ["IE", "SN", "FT", "JP"] as const) {
    const rule = instrument.scoring[dimension];
    assert.equal(midpoint.dimensions[dimension].score, 24);
    assert.equal(midpoint.dimensions[dimension].letter, rule.lowLetter);
    for (const high of [false, true]) {
      const answers = neutral.map((answer) => ({ ...answer, score: rule.signs[String(answer.id)]
        ? (rule.signs[String(answer.id)] === (high ? 1 : -1) ? 5 : 1) : 3 }));
      const result = scoreAdministration(instrument, "local-test", 0, answers).dimensions[dimension];
      assert.equal(result.score, high ? 40 : 8);
      assert.equal(result.letter, high ? rule.highLetter : rule.lowLetter);
    }
    for (const [id, sign] of Object.entries(rule.signs)) {
      const changed = neutral.map((answer) => answer.id === Number(id) ? { ...answer, score: 4 } : answer);
      const result = scoreAdministration(instrument, "local-test", 0, changed).dimensions[dimension];
      assert.equal(result.score, 24 + sign);
      assert.equal(result.letter, sign > 0 ? rule.highLetter : rule.lowLetter);
    }
  }
});
