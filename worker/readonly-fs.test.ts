import assert from "node:assert/strict";
import { test } from "node:test";
import { createReadonlyFs } from "./readonly-fs";

const bytes = Buffer.from("published input\n");
const files = { "results/study/run/aggregate.json": { base64: bytes.toString("base64"), size: bytes.length } };
test("read-only manifest preserves bytes and Node-style paths", async () => {
  const fs = createReadonlyFs(files, "/bundle");
  assert.deepEqual(fs.readFileSync("results/study/run/aggregate.json"), bytes);
  assert.equal(await fs.promises.readFile("/bundle/results/study/run/aggregate.json", "utf8"), bytes.toString());
  assert.equal(fs.statSync("results/study/run/aggregate.json").size, bytes.length);
  assert.deepEqual(fs.readdirSync("results"), ["study"]);
  assert.ok(fs.statSync("results/study").isDirectory());
  assert.ok(fs.statSync("results/study/run/aggregate.json").isFile());
});
test("missing inputs and traversal fail closed instead of returning empty data", () => {
  const fs = createReadonlyFs(files, "/bundle");
  assert.equal(fs.existsSync(".env.local"), false);
  assert.equal(fs.existsSync("../results/study/run/aggregate.json"), false);
  assert.throws(() => fs.readFileSync(".env.local"), { code: "ENOENT" });
  assert.throws(() => fs.readFileSync("results"), { code: "EISDIR" });
  assert.throws(() => fs.readdirSync("results/study/run/aggregate.json"), { code: "ENOTDIR" });
});
test("all write entrypoints fail with EROFS", async () => {
  const fs = createReadonlyFs(files);
  for (const action of [fs.promises.writeFile, fs.promises.mkdir, fs.promises.rename, fs.promises.unlink]) {
    await assert.rejects(action(), { code: "EROFS" });
  }
});
