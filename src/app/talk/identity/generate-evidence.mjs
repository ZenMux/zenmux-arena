// Offline, deterministic allowlist extraction. No model calls, keys, or env reads.
// Run from the repository root: node src/app/talk/identity/generate-evidence.mjs
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const dir = path.join(root, "results/who-are-you/mix-20260601T062425");
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "mix.json"), "utf8"));
const graph = JSON.parse(fs.readFileSync(path.join(dir, "aggregate.json"), "utf8"));
const sources = new Set(manifest.sources.map((s) => s.run));
const families = new Map(manifest.sources.map((s) => {
  const g = JSON.parse(fs.readFileSync(path.join(root, "results", s.run, "aggregate.json"), "utf8"));
  const prompt = g.languages.find((l) => l.code === "en").prompt;
  return [s.run, prompt === "Who are you?" ? "bare" : prompt.startsWith("This is a direct question") ? "unbranded" : "probed"];
}));
const labels = new Map();
async function* lines(file) {
  const input = fs.createReadStream(path.join(dir, file), "utf8");
  for await (const line of readline.createInterface({ input, crlfDelay: Infinity })) {
    if (line.trim()) yield JSON.parse(line);
  }
}
for await (const e of lines("extractions.jsonl")) {
  if (!e.parseError) labels.set(e.key, { claimedVendor: e.claimedVendor, other: e.claimedVendorOther, generationId: e.sourceGenerationId, extractor: e.extractorModel });
}
const stable = new Set(graph.models.filter((m) => graph.summary.perModelSelfRate[m.id] === 1).map((m) => m.id));
const used = new Map();
const evidence = [];
let from = "9999", to = "";
function take(bucket, limit = 1) {
  const count = used.get(bucket) ?? 0;
  if (count >= limit) return false;
  used.set(bucket, count + 1);
  return true;
}
for await (const r of lines("records.jsonl")) {
  if (r.error || !r.response || !r.mixSource || !sources.has(r.mixSource.run)) continue;
  from = r.timestamp < from ? r.timestamp : from;
  to = r.timestamp > to ? r.timestamp : to;
  const e = labels.get(r.key);
  if (!e || e.generationId !== r.generationId) continue;
  const f = families.get(r.mixSource.run);
  const outcome = e.claimedVendor === r.modelVendor ? "self" : e.claimedVendor === "refused" ? "refused" : e.claimedVendor === "unknown" || (e.claimedVendor === "other" && !e.other) ? "unknown" : "cross";
  const uses = [];
  if (r.modelVendor === "tencent" && take(`method:${f}:${r.langCode}`, 2)) uses.push("method");
  if (r.modelVendor === "tencent" && r.langCode === "ja" && f === "bare" && e.claimedVendor === "anthropic" && take("tencent")) uses.push("tencent");
  if (r.modelVendor === "z-ai" && r.langCode === "es" && f === "probed" && e.claimedVendor === "google" && take("glm")) uses.push("glm");
  if (r.modelId.includes("doubao-seed-2.0-code") && r.langCode === "en" && f === "unbranded" && e.claimedVendor === "openai" && take("doubao")) uses.push("doubao");
  if (r.modelVendor === "inclusionai" && r.langCode === "de" && outcome === "refused" && take("inclusionai")) uses.push("inclusionai");
  if (stable.has(r.modelId) && r.langCode === "zh-Hans" && f === "bare" && outcome === "self" && take(`stable:${r.modelId}`)) uses.push("stable");
  if (!uses.length) continue;
  evidence.push({ id: r.key, sourceRun: r.mixSource.run, sourceKey: r.mixSource.origKey, generationId: r.generationId, timestamp: r.timestamp, modelId: r.modelId, lang: r.langCode, family: f, prompt: r.prompt, response: r.response.slice(0, 900), excerpted: r.response.length > 900, outcome, claimedVendor: e.claimedVendor === "other" ? e.other ?? "unknown" : e.claimedVendor, extractor: e.extractor, uses });
}
if (used.size < 42 || evidence.length > 72) throw new Error("Unexpected evidence coverage; review the pinned study before replacing the sample.");
const output = { runId: manifest.runId, experimentalWindow: { from, to }, evidence };
fs.writeFileSync(path.join(here, "evidence.json"), JSON.stringify(output, null, 2) + "\n");
console.log(`Wrote ${evidence.length} allowlisted excerpts (${Buffer.byteLength(JSON.stringify(output))} bytes).`);
