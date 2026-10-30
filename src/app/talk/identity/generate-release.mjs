// Freezes ZenMux `publish_time` for the talk's identity roster. Network read only, no keys.
// Run from the repository root: node src/app/talk/identity/generate-release.mjs
//
// Primary source: the live public listing https://zenmux.ai/api/v1/models.
// Fallback: the archived listing captured on 2026-06-17, used when a model has since
// been delisted, or when the live date is LATER than the archived one (a model already
// listed in June cannot have been first published afterwards; those are re-listings).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const LIVE_URL = "https://zenmux.ai/api/v1/models";
const ARCHIVE = "results/token-economics/20260617T023212/models-api.json";
const graph = JSON.parse(fs.readFileSync(path.join(root, "results/who-are-you/mix-20261030T004019/aggregate.json"), "utf8"));

const response = await fetch(LIVE_URL);
if (!response.ok) throw new Error(`${LIVE_URL} → HTTP ${response.status}`);
const live = new Map((await response.json()).data.map((m) => [m.id, m.publish_time]));
const archive = new Map(JSON.parse(fs.readFileSync(path.join(root, ARCHIVE), "utf8")).data.map((m) => [m.slug, m.publish_time]));
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

const models = {};
for (const { id } of graph.models) {
  const slug = id.split(":")[0];
  const l = live.get(slug), a = archive.get(slug);
  if (isDate(l) && !(isDate(a) && a < l)) models[id] = { publishTime: l, source: "live" };
  else if (isDate(a)) models[id] = { publishTime: a, source: "archive-20260617", ...(isDate(l) ? { liveListed: l } : {}) };
  else throw new Error(`No publish_time for ${slug}`);
}

const out = { source: LIVE_URL, fetchedAt: new Date().toISOString(), fallback: ARCHIVE, models };
fs.writeFileSync(path.join(here, "release.json"), `${JSON.stringify(out, null, 2)}\n`);
for (const [id, m] of Object.entries(models)) if (m.source !== "live") console.log(`fallback ${id}: ${m.publishTime}${m.liveListed ? ` (live ${m.liveListed})` : " (delisted)"}`);
console.log(`wrote ${Object.keys(models).length} models`);
