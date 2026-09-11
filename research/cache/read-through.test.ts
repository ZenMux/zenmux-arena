import assert from "node:assert/strict";
import { test } from "node:test";
import { SharedSnapshotCache } from "./read-through";
import type { SnapshotPayload } from "./payload";
import type { SnapshotStore } from "./supabase";

type Payload = SnapshotPayload & { total: number };
const now = new Date("2026-09-11T01:00:00.000Z");
const old: Payload = {
  range: "all", from: "2026-01-01T00:00:00.000Z", to: "2026-09-10T00:00:00.000Z",
  generatedAt: "2026-09-10T00:01:00.000Z", bucketSeconds: 86400, refreshIntervalSeconds: 300, total: 42,
};
const fresh: Payload = { ...old, to: now.toISOString(), generatedAt: now.toISOString(), total: 51 };

function fixture(initial: Payload | null = old) {
  let value = initial;
  let owner: string | null = null;
  let seq = 0;
  const counts = { writes: 0, loads: 0, reads: 0 };
  const store: SnapshotStore<Payload> = {
    async read() { counts.reads++; return value ? structuredClone(value) : null; },
    async acquire() { if (owner) return null; return owner = String(++seq); },
    async publish(payload, token) {
      if (token !== owner || (value && Date.parse(payload.to) < Date.parse(value.to))) return false;
      counts.writes++; value = structuredClone(payload); return true;
    },
    async release(token) { if (token === owner) owner = null; },
  };
  return {
    store, counts, value: () => value,
    options: {
      key: "test:all", now, store,
      valid: (p: unknown): p is Payload => !!p && typeof (p as Payload).total === "number",
      fresh: (p: Payload, at: Date) => Date.parse(p.to) >= at.getTime(),
      ttlMs: () => 15_000,
      async load() { counts.loads++; return { payload: fresh, source: "incremental-db" as const }; },
    },
  };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}

test("fresh shared snapshot survives a process restart without origin IO", async () => {
  const f = fixture(fresh);
  const result = await new SharedSnapshotCache().get(f.options);
  assert.equal(result.source, "supabase");
  assert.equal(result.payload.generatedAt, fresh.generatedAt);
  assert.equal(f.counts.loads, 0);
  assert.equal(f.counts.writes, 0);
});

test("concurrent cold requests share one query and a durable write", async () => {
  const f = fixture(null);
  const cache = new SharedSnapshotCache();
  const responses = await Promise.all(Array.from({ length: 12 }, () => cache.get(f.options)));
  assert.ok(responses.every(r => r.payload.total === 51));
  assert.equal(f.counts.loads, 1);
  assert.equal(f.counts.writes, 1);
  assert.equal((await new SharedSnapshotCache().get(f.options)).source, "supabase");
});

test("SWR lifecycle includes persistence; another instance respects the lease", async () => {
  const f = fixture();
  const gate = deferred();
  const lifecycle: Promise<unknown>[] = [];
  const options = { ...f.options, swrWaitMs: 1, waitUntil: (p: Promise<unknown>) => { lifecycle.push(p); },
    load: async () => { f.counts.loads++; await gate.promise; return { payload: fresh, source: "incremental-db" as const }; },
  };
  const first = await new SharedSnapshotCache().get(options);
  assert.equal(first.source, "stale-swr");
  assert.equal(first.payload.total, 42);
  const second = await new SharedSnapshotCache().get(options);
  assert.equal(second.source, "shared-refresh");
  assert.equal(f.counts.loads, 1);
  gate.resolve();
  await Promise.all(lifecycle);
  assert.equal(f.counts.writes, 1);
  assert.equal((await new SharedSnapshotCache().get(f.options)).payload.total, 51);
});

test("CLI callers await persistence without an after hook", async () => {
  const f = fixture();
  const gate = deferred();
  const original = f.store.publish;
  f.store.publish = async (...args) => { await gate.promise; return original(...args); };
  let finished = false;
  const work = new SharedSnapshotCache().get(f.options).then(r => { finished = true; return r; });
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(finished, false);
  gate.resolve();
  await work;
  assert.equal(f.value()?.total, 51);
});

test("origin failure retains history and does not publish a fallback", async () => {
  const f = fixture();
  const result = await new SharedSnapshotCache().get({ ...f.options, load: async () => { throw new Error("offline"); } });
  assert.equal(result.source, "stale-baseline");
  assert.equal(result.payload.stale, true);
  assert.equal(f.value()?.total, 42);
  assert.equal(f.counts.writes, 0);
  assert.ok(await f.store.acquire(), "lease released on failure");
});

test("a failed Supabase write is observable and never claimed durable", async () => {
  const f = fixture();
  f.store.publish = async () => { throw new Error("write unavailable"); };
  const result = await new SharedSnapshotCache().get(f.options);
  assert.equal(result.payload.total, 51);
  assert.equal(result.persistence, "unavailable");
  assert.equal(f.value()?.total, 42);
});

test("chunked catch-up persists progress even while still stale", async () => {
  const f = fixture();
  const partial = { ...fresh, to: "2026-09-10T12:00:00.000Z", total: 47 };
  const result = await new SharedSnapshotCache().get({ ...f.options,
    load: async () => ({ payload: partial, source: "incremental-db" as const }),
  });
  assert.equal(result.payload.stale, true);
  assert.equal(f.value()?.total, 47);
  let resumedAt: string | undefined;
  await new SharedSnapshotCache().get({ ...f.options, load: async baseline => {
    resumedAt = baseline?.to; return { payload: fresh, source: "incremental-db" as const };
  } });
  assert.equal(resumedAt, partial.to);
});

test("an older origin result cannot regress the shared cutoff", async () => {
  const f = fixture();
  const result = await new SharedSnapshotCache().get({ ...f.options,
    load: async () => ({ payload: { ...old, to: "2026-09-01T00:00:00.000Z" }, source: "full-db" as const }),
  });
  assert.equal(result.source, "stale-baseline");
  assert.equal(f.counts.writes, 0);
});

test("Supabase outage falls back to origin with explicit persistence status", async () => {
  const f = fixture(null);
  f.store.read = async () => { throw new Error("cache offline"); };
  const result = await new SharedSnapshotCache().get(f.options);
  assert.equal(result.persistence, "unavailable");
  assert.equal(result.payload.total, 51);
  assert.equal(f.counts.writes, 0);
});
