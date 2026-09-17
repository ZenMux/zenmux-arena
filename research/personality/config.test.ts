import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import YAML from "yaml";
import { loadPersonalityConfig } from "./config";

test("current and historical configs expose only the majority threshold without rewriting snapshots", () => {
  for (const file of ["config/personality-oejts.yaml", "results/llm-mbti-oejts/20260911T040759/study.yaml"]) {
    const before = fs.readFileSync(file, "utf8");
    assert.deepEqual(loadPersonalityConfig(file).classification, { minModalCount: 9 });
    assert.equal(fs.readFileSync(file, "utf8"), before);
  }
});

test("rejects missing or non-majority classification thresholds", () => {
  const source = YAML.parse(fs.readFileSync("config/personality-oejts.yaml", "utf8"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oejts-classification-"));
  try {
    for (const classification of [undefined, {}, { minModalCount: 8 }, { minModalCount: 9.5 }, { minModalCount: 13 }]) {
      const file = path.join(dir, "study.yaml");
      fs.writeFileSync(file, YAML.stringify({ ...source, classification }));
      assert.throws(() => loadPersonalityConfig(file), /strict majority of 16/);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
