import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { discoverRuns, loadRunData } from "../src/app/who-are-you/browse/data";
import { isIdentityGraph } from "../research/lib/graph-data";
import type { FileManifest } from "./content-types";
import type { ModelEntry, RunData } from "../src/app/who-are-you/browse/data";

test("the packaged filesystem contains only allowlisted tracked inputs", () => {
  const files = JSON.parse(fs.readFileSync(".vinext/arena-files.json", "utf8")) as FileManifest;
  assert.ok(Object.keys(files).length > 0);
  for (const [name, entry] of Object.entries(files)) {
    assert.ok(!/(^|\/)(\.env|\.cache|\.npmrc)|\.jsonl$|\.node$/.test(name), name);
    assert.deepEqual(Buffer.from(entry.base64, "base64"), fs.readFileSync(name));
  }
});
test("published MBTI artifacts do not masquerade as identity graph runs", () => {
  const mbti = JSON.parse(fs.readFileSync("results/llm-mbti-oejts/20260911T040759/aggregate.json", "utf8"));
  assert.equal(isIdentityGraph(mbti), false);
  assert.ok(discoverRuns().every((run) => !run.id.startsWith("llm-mbti")));
  assert.equal(discoverRuns().length, 7);
});
test("every Worker shard is identical to the original server join", () => {
  const runs = JSON.parse(fs.readFileSync(".vinext/arena-browse.json", "utf8")) as Record<string, Omit<RunData, "models"> & { models: Array<ModelEntry & { asset: string }> }>;
  assert.deepEqual(Object.keys(runs).sort(), discoverRuns().map((run) => run.id).sort());
  for (const [id, run] of Object.entries(runs)) {
    const original = loadRunData(id)!;
    assert.equal(run.totalAnswers, original.totalAnswers);
    assert.equal(run.models.length, original.models.length);
    for (const [index, model] of run.models.entries()) {
      assert.deepEqual(model.langs, []);
      assert.match(model.asset, /^\/__arena_private\/[a-f0-9]{64}\.json$/);
      const raw = fs.readFileSync(path.join(".vinext/public", model.asset));
      assert.equal(createHash("sha256").update(raw).digest("hex") + ".json", path.basename(model.asset));
      assert.deepEqual(JSON.parse(raw.toString()), JSON.parse(JSON.stringify(original.models[index])));
    }
  }
});
