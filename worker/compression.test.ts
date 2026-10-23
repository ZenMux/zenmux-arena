import assert from "node:assert/strict";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import { compressedJson as nodeJson } from "../src/lib/compressed-json";
import { compressedJson as workerJson } from "./compressed-json";

test("Node retains its existing single gzip representation", async () => {
  const json = JSON.stringify({ message: "模型让利", live: false });
  const encoded = nodeJson(json);
  const bytes = await new Response(encoded.body).arrayBuffer();
  assert.equal(gunzipSync(new Uint8Array(bytes)).toString(), json);
  assert.equal(encoded.headers["Content-Encoding"], "gzip");
});
test("Workers leaves compression to the runtime, even after Response reconstruction", async () => {
  const json = JSON.stringify({ message: "模型让利", live: false });
  const encoded = workerJson(json);
  const reconstructed = new Response(new Response(encoded.body).body, { headers: encoded.headers });
  assert.equal(await reconstructed.text(), json);
  assert.equal(reconstructed.headers.get("Content-Encoding"), "gzip");
  assert.equal(reconstructed.headers.get("Content-Length"), null);
});
