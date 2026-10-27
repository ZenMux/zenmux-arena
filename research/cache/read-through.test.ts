import assert from "node:assert/strict";
import { test } from "node:test";
import { CacheSnapshotUnavailableError, SharedSnapshotCache } from "./read-through";
import type { SnapshotPayload } from "./payload";
import type { SnapshotReader } from "./supabase";

type Payload = SnapshotPayload & { total: number };
const now = new Date("2026-09-11T01:00:00.000Z");
const old: Payload = { range: "all", from: "2026-01-01T00:00:00.000Z", to: "2026-09-10T00:00:00.000Z",
  generatedAt: "2026-09-10T00:01:00.000Z", bucketSeconds: 86400, refreshIntervalSeconds: 300, total: 42 };
const fresh = { ...old, to: now.toISOString(), generatedAt: now.toISOString(), total: 51 };
function fixture(initial: Payload | null = old) {
  let value = initial;
  let reads = 0;
  const store: SnapshotReader<Payload> = { async read() { reads++; return value && structuredClone(value); } };
  return { store, reads: () => reads, set: (p: Payload | null) => { value = p; },
    options: { key: "test:all", now, store, ttlMs: 0,
      valid: (p: unknown): p is Payload => !!p && typeof (p as Payload).total === "number",
      fresh: (p: Payload, at: Date) => Date.parse(p.to) >= at.getTime() },
  };
}

test("expired snapshots retain their real values and cutoff with no writer interface", async () => {
  const f = fixture();
  const result = await new SharedSnapshotCache().get(f.options);
  assert.equal(result.source, "supabase");
  assert.equal(result.persistence, "shared");
  assert.equal(result.payload.stale, true);
  assert.equal(result.payload.to, old.to);
  assert.equal(result.payload.total, 42);
  assert.deepEqual(Object.keys(f.store), ["read"]);
});
test("a cold missing snapshot fails without an origin fallback", async () => {
  const f = fixture(null);
  await assert.rejects(new SharedSnapshotCache().get(f.options), CacheSnapshotUnavailableError);
  assert.equal(f.reads(), 1);
});
test("concurrent requests share one Supabase read", async () => {
  const f = fixture(fresh);
  const cache = new SharedSnapshotCache();
  const responses = await Promise.all(Array.from({ length: 12 }, () => cache.get(f.options)));
  assert.ok(responses.every(r => r.payload.total === 51));
  assert.equal(f.reads(), 1);
});
test("new publications appear after the short read memo", async () => {
  const f = fixture();
  const cache = new SharedSnapshotCache();
  await cache.get(f.options);
  f.set(fresh);
  const result = await cache.get(f.options);
  assert.equal(result.payload.total, 51);
  assert.equal(result.payload.stale, false);
});
test("an older shared result cannot roll back an observed publication", async () => {
  const f = fixture(fresh);
  const cache = new SharedSnapshotCache();
  await cache.get(f.options);
  f.set(old);
  assert.equal((await cache.get(f.options)).payload.to, fresh.to);
});
test("Supabase outage returns last good data with unavailable persistence", async () => {
  const f = fixture(fresh);
  const cache = new SharedSnapshotCache();
  await cache.get(f.options);
  f.store.read = async () => { throw new Error("offline"); };
  const result = await cache.get(f.options);
  assert.equal(result.persistence, "unavailable");
  assert.equal(result.payload.stale, true);
  assert.equal(result.payload.total, 51);
});
test("Supabase outage on a cold process rejects", async () => {
  const f = fixture(null);
  f.store.read = async () => { throw new Error("offline"); };
  await assert.rejects(new SharedSnapshotCache().get(f.options), CacheSnapshotUnavailableError);
});
test("memoized freshness is evaluated for the current request clock", async () => {
  const f = fixture(fresh);
  const cache = new SharedSnapshotCache();
  await cache.get({ ...f.options, ttlMs: 10000 });
  const result = await cache.get({ ...f.options, ttlMs: 10000, now: new Date(now.getTime() + 300000) });
  assert.equal(result.payload.stale, true);
  assert.equal(f.reads(), 1);
});
