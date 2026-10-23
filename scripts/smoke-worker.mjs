import assert from "node:assert/strict";
import fs from "node:fs";

const origin = new URL(process.env.WORKER_SMOKE_URL || "http://localhost:4173");
if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) {
  throw new Error("This secret-free smoke test is local-only; it must not refresh production billing data.");
}
const get = (pathname, options = {}) => fetch(new URL(pathname, origin), { redirect: "manual", signal: AbortSignal.timeout(60_000), ...options });
const routes = ["/", "/token-economics", "/token-economics/about", "/token-deals", "/token-deals/about", "/token-deals/ladder", "/tools", "/tools/discount-to-deepseek", "/who-are-you", "/who-are-you/studio", "/who-are-you/data", "/who-are-you/browse", "/talk", "/research", "/research/data", "/research/browse"];
for (const route of routes) {
  const response = await get(route);
  const html = await response.text();
  assert.equal(response.status, 200, route);
  assert.match(html, /<title>[^<]+<\/title>/, route);
  assert.ok(!html.includes('id="__next_error__"'), `${route}: RSC error shell`);
  if (/who-are-you|research/.test(route)) {
    assert.ok(!html.includes("No runs found"), `${route}: research inputs missing`);
    assert.ok(html.includes("mix-20260601T062425"), `${route}: latest identity run missing`);
  }
  console.log(`PASS page ${route}`);
}
const browseManifest = JSON.parse(fs.readFileSync(".vinext/arena-browse.json", "utf8"));
const model = Object.values(browseManifest)[0].models[1];
const selected = await get(`/who-are-you/browse?model=${encodeURIComponent(model.id)}`);
assert.equal(selected.status, 200);
assert.ok((await selected.text()).includes(model.label));
console.log("PASS model selection");
for (const route of ["/__arena_private", "/__arena_private/NotoSansSC-Regular.otf", model.asset, "/%5f%5farena_private/NotoSansSC-Regular.otf", "/__arena_private%2FNotoSansSC-Regular.otf"]) {
  for (const method of ["GET", "HEAD"]) assert.equal((await get(route, { method })).status, 404, `${method} ${route}`);
}
console.log("PASS private assets reject direct GET/HEAD");
const graph = JSON.parse(fs.readFileSync("public/research/aggregate.json", "utf8"));
for (const format of ["svg", "png"]) {
  const response = await get("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ run: "who-are-you/mix-20260601T062425", graph, format, scale: 1 }) });
  assert.equal(response.status, 200, `${format} export`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (format === "png") assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  else assert.ok(new TextDecoder().decode(bytes).includes("<svg"));
  assert.ok(bytes.length > 1000);
  console.log(`PASS ${format.toUpperCase()} export (${bytes.length} bytes)`);
}
const malformed = await get("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
assert.equal(malformed.status, 400);
for (const route of ["/api/token-economics/live", "/api/token-deals/live"]) {
  const response = await get(route);
  const text = await response.text();
  if (route.includes("token-economics")) {
    assert.equal(response.status, 503, `${route}: start without database credentials`);
    assert.ok(/not configured/.test(text), `${route}: explicit configuration failure`);
  } else {
    assert.equal(response.status, 200, `${route}: documented degraded response`);
    assert.equal(JSON.parse(text).live, false);
    assert.equal(response.headers.get("X-Cache-Source"), "degraded");
    assert.match(response.headers.get("Cache-Control"), /no-store/);
  }
  assert.ok(!/no such file|empty roster/.test(text), `${route}: packaged config unavailable`);
  console.log(`PASS unconfigured live API ${route}`);
}
console.log("Worker smoke checks passed; no production credentials, model calls, or data freshness claims.");
