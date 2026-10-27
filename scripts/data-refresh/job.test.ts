import assert from "node:assert/strict";
import { test } from "node:test";
import { runSnapshotJob, safeFailure } from "./job";
import type { SnapshotPayload } from "@research/cache/payload";
import type { SnapshotStore } from "./supabase-writer";

type Payload = SnapshotPayload & { total: number };
const baseline: Payload = { range: "all", from: "2026-01-01T00:00:00Z", to: "2026-10-24T00:00:00Z",
  generatedAt: "2026-10-24T00:01:00Z", bucketSeconds: 86400, refreshIntervalSeconds: 300, total: 42 };
const updated = { ...baseline, to: "2026-10-25T00:00:00Z", generatedAt: "2026-10-27T00:00:00Z", total: 47 };
function fixture() {
  let stored = baseline;
  let locked = false;
  let writes = 0;
  const store: SnapshotStore<Payload> = {
    async read() { return stored; },
    async acquire() { if (locked) return null; locked = true; return "owner"; },
    async publish(p, owner) { assert.ok(locked); assert.equal(owner, "owner"); writes++; stored = p; return true; },
    async release() { locked = false; },
  };
  return { store, stored: () => stored, locked: () => locked, writes: () => writes,
    options: { store, valid: (p: unknown): p is Payload => !!p && Number.isFinite((p as Payload).total),
      fresh: (p: Payload) => p.to >= "2026-10-27T00:00:00Z", build: async () => updated },
  };
}
test("bounded progress is committed while stale and the lease is released", async () => {
  const f = fixture();
  const result = await runSnapshotJob(f.options);
  assert.equal(result.status, "updated");
  assert.equal(result.stale, true);
  assert.equal(f.stored().to, updated.to);
  assert.equal(f.writes(), 1);
  assert.equal(f.locked(), false);
});
test("failed source work preserves the snapshot and releases the lease", async () => {
  const f = fixture();
  await assert.rejects(runSnapshotJob({ ...f.options, build: async () => { throw new Error("offline"); } }), /offline/);
  assert.deepEqual(f.stored(), baseline);
  assert.equal(f.writes(), 0);
  assert.equal(f.locked(), false);
});
test("expired/unowned publication is reported as failure", async () => {
  const f = fixture();
  f.store.publish = async () => false;
  await assert.rejects(runSnapshotJob(f.options), /fenced out/);
  assert.equal(f.stored().to, baseline.to);
  assert.equal(f.locked(), false);
});
test("another host holding the lease prevents source work", async () => {
  const f = fixture();
  await f.store.acquire();
  const result = await runSnapshotJob({ ...f.options, build: async () => { throw new Error("unexpected source IO"); } });
  assert.equal(result.status, "busy");
  assert.equal(f.writes(), 0);
});
test("older or empty origin payloads cannot replace a usable snapshot", async () => {
  const f = fixture();
  await assert.rejects(runSnapshotJob({ ...f.options, build: async () => ({ ...updated, to: "2026-10-01T00:00:00Z" }) }), /backwards/);
  await assert.rejects(runSnapshotJob({ ...f.options, build: async () => ({ ...updated, total: NaN }) }), /unusable/);
  assert.equal(f.writes(), 0);
});
test("database failures do not expose source addresses or credentials", () => {
  assert.equal(safeFailure({ code: "ETIMEDOUT", message: "connect 10.1.1.1 private-user password" }), "Operation failed (ETIMEDOUT).");
  assert.equal(safeFailure(new Error("connect internal-source")), "Data refresh failed; previous published data was retained.");
});
