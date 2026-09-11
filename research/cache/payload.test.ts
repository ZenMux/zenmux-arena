import assert from "node:assert/strict";
import { test } from "node:test";
import { payloadHash, snapshotExpiresAt, snapshotId } from "./payload";

test("archive verification preserves values while ignoring JSONB object key order", () => {
  const a = { to: "2026-09-11T00:00:00Z", values: [{ paid: 0.00123, saved: 123456.789, optional: undefined }], nil: null };
  const b = { nil: null, values: [{ saved: 123456.789, paid: 0.00123 }], to: a.to };
  assert.equal(payloadHash(a), payloadHash(b));
  assert.notEqual(payloadHash(a), payloadHash({ ...b, values: [{ saved: 123456.788, paid: 0.00123 }] }));
});

test("daily economics and live deals retain their distinct freshness boundaries", () => {
  const payload = {
    range: "all", from: "2026-01-01T00:00:00Z", to: "2026-09-11T00:00:00Z",
    generatedAt: "2026-09-11T00:01:00Z", bucketSeconds: 86400, refreshIntervalSeconds: 300,
  };
  assert.equal(snapshotExpiresAt(snapshotId("token-economics", "all"), payload), "2026-09-12T00:00:00.000Z");
  assert.equal(snapshotExpiresAt(snapshotId("token-deals", "all"), payload), "2026-09-11T00:05:00.000Z");
});
