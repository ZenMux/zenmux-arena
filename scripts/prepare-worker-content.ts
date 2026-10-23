import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { discoverRuns, loadRunData } from "../src/app/who-are-you/browse/data";
import type { FileManifest } from "../worker/content-types";

const root = process.cwd();
const out = path.join(root, ".vinext");
const publicDir = path.join(out, "public");
fs.mkdirSync(out, { recursive: true });
fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(publicDir, { recursive: true });
// No globs of the checkout: local credentials, caches, and unpublished runs
// must never enter either the Worker or its static assets.
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const trackedSet = new Set(tracked);
const files: FileManifest = {};
const resultNames = new Set(["aggregate.json", "instrument.json", "RUN_NOTES.md", "token-economics.json", "models-api.json"]);
for (const file of tracked) {
  if (/(^|\/)(\.env(?:\.|$)|\.dev\.vars|\.npmrc$|\.git(?:\/|$))|\.(pem|key|p12)$/.test(file)) continue;
  const local = path.join(root, file);
  if (!fs.existsSync(local) || !fs.lstatSync(local).isFile()) continue;
  if (file.startsWith("public/")) {
    const target = path.join(publicDir, file.slice("public/".length));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(local, target);
  }
  if (["config/token-deals.json", "config/token-economics-live-models.json", "public/research/aggregate.json"].includes(file)
    || file.startsWith("public/model-logo/")
    || (file.startsWith("results/") && resultNames.has(path.basename(file)))) {
    const bytes = fs.readFileSync(local);
    files[file] = { base64: bytes.toString("base64"), size: bytes.byteLength };
  }
}
for (const required of ["config/token-deals.json", "config/token-economics-live-models.json", "public/research/aggregate.json"]) {
  if (!files[required]) throw new Error(`Missing required packaged input: ${required}`);
}
const privateDir = path.join(publicDir, "__arena_private");
fs.mkdirSync(privateDir, { recursive: true });
fs.copyFileSync(path.join(root, "research/assets/NotoSansSC-Regular.otf"), path.join(privateDir, "NotoSansSC-Regular.otf"));
const runs: Record<string, unknown> = {};
let modelCount = 0;
for (const ref of discoverRuns()) {
  // A local run with the same name must not silently publish untracked data.
  if (!trackedSet.has(`results/${ref.id}/records.jsonl`)) continue;
  for (const name of ["records.jsonl", "extractions.jsonl", "aggregate.json"]) {
    const input = `results/${ref.id}/${name}`;
    if (fs.existsSync(input) && (!trackedSet.has(input) || !fs.lstatSync(input).isFile())) {
      throw new Error(`Refusing unpublished or symlinked research input: ${input}`);
    }
  }
  const data = loadRunData(ref.id);
  if (!data) throw new Error(`Cannot package research run: ${ref.id}`);
  const models = data.models.map((model) => {
    const body = JSON.stringify(model);
    const assetName = `${createHash("sha256").update(body).digest("hex")}.json`;
    if (Buffer.byteLength(body) > 20 * 1024 * 1024) throw new Error(`Model shard exceeds asset budget: ${model.id}`);
    fs.writeFileSync(path.join(privateDir, assetName), body);
    modelCount++;
    return { ...model, langs: [], asset: `/__arena_private/${assetName}` };
  });
  runs[ref.id] = { ref: data.ref, totalAnswers: data.totalAnswers, models };
}
fs.writeFileSync(path.join(out, "arena-files.json"), JSON.stringify(files));
fs.writeFileSync(path.join(out, "arena-browse.json"), JSON.stringify(runs));
console.log(`Packaged ${Object.keys(files).length} immutable inputs, ${Object.keys(runs).length} research runs, ${modelCount} model shards. No network or live data refresh.`);
