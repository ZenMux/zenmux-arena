import type { SnapshotPayload } from "./payload";
import type { SnapshotStore } from "./supabase";

export type CacheSource = "l1-memory" | "supabase" | "single-flight" | "incremental-db" |
  "full-db" | "stale-swr" | "stale-baseline" | "shared-refresh" | "degraded-no-baseline";
export type CachePersistence = "shared" | "unavailable";
export interface CacheResult<T> {
  payload: T;
  source: CacheSource;
  persistence: CachePersistence;
  elapsedMs: number;
}
export interface RefreshOptions {
  /** Routes/RSCs pass Next after(). Without a lifecycle hook we await all work. */
  waitUntil?: (work: Promise<unknown>) => void;
}
interface Options<T extends SnapshotPayload> extends RefreshOptions {
  key: string;
  store: SnapshotStore<T>;
  now: Date;
  valid: (value: unknown) => value is T;
  fresh: (value: T, now: Date) => boolean;
  ttlMs: (value: T, now: Date) => number;
  load: (baseline: T | null) => Promise<{ payload: T; source: CacheSource }>;
  swrWaitMs?: number;
}
interface Entry<T> {
  lastGood: T | null;
  memo?: { result: CacheResult<T>; until: number };
  reading?: Promise<CacheResult<T>>;
  refreshing?: Promise<CacheResult<T>>;
}

export class CacheBusyError extends Error {}

function newer<T extends SnapshotPayload>(a: T | null, b: T | null): T | null {
  if (!a) return b;
  if (!b) return a;
  if (Date.parse(a.to) !== Date.parse(b.to)) return Date.parse(a.to) > Date.parse(b.to) ? a : b;
  return Date.parse(a.generatedAt) >= Date.parse(b.generatedAt) ? a : b;
}

/** One coordinator per process; the database lease also deduplicates across instances. */
export class SharedSnapshotCache {
  private entries = new Map<string, Entry<SnapshotPayload>>();

  async get<T extends SnapshotPayload>(options: Options<T>): Promise<CacheResult<T>> {
    let entry = this.entries.get(options.key) as Entry<T> | undefined;
    if (!entry) {
      entry = { lastGood: null };
      this.entries.set(options.key, entry as Entry<SnapshotPayload>);
    }
    // Register every request that joins background work with the host lifecycle.
    if (entry.refreshing && options.waitUntil) options.waitUntil(entry.refreshing.then(() => {}, () => {}));
    if (entry.memo && entry.memo.until > Date.now() && options.valid(entry.memo.result.payload) &&
      (entry.memo.result.payload.stale || options.fresh(entry.memo.result.payload, options.now))) {
      return { ...entry.memo.result, source: "l1-memory", elapsedMs: 0 };
    }
    if (entry.reading) {
      const result = await entry.reading;
      return { ...result, source: result.payload.stale ? result.source : "single-flight" };
    }
    const work = this.resolve(options, entry);
    entry.reading = work;
    try {
      return await work;
    } finally {
      entry.reading = undefined;
    }
  }

  private remember<T extends SnapshotPayload>(o: Options<T>, e: Entry<T>, result: CacheResult<T>) {
    // A stale response racing a completed refresh must never replace its progress.
    if (o.valid(result.payload)) e.lastGood = newer(e.lastGood, result.payload);
    if (e.memo && Date.parse(e.memo.result.payload.to) > Date.parse(result.payload.to)) return;
    const ttl = result.payload.stale || result.persistence === "unavailable" ? 10_000 : o.ttlMs(result.payload, new Date());
    e.memo = { result, until: Date.now() + Math.max(0, ttl) };
  }

  private async resolve<T extends SnapshotPayload>(o: Options<T>, e: Entry<T>): Promise<CacheResult<T>> {
    const started = Date.now();
    let shared: T | null = null;
    let persistence: CachePersistence = "shared";
    try {
      const raw = await o.store.read();
      if (o.valid(raw)) shared = raw;
    } catch (error) {
      persistence = "unavailable";
      console.warn(`[arena-cache] ${o.key}: shared read failed`, error instanceof Error ? error.message : error);
    }
    const baseline = newer(shared, o.valid(e.lastGood) ? e.lastGood : null);
    if (baseline && o.fresh(baseline, o.now)) {
      const result: CacheResult<T> = {
        payload: { ...baseline, stale: false }, source: baseline === shared ? "supabase" : "l1-memory", persistence, elapsedMs: Date.now() - started,
      };
      this.remember(o, e, result);
      return result;
    }
    if (!e.refreshing) {
      e.refreshing = this.refresh(o, baseline, persistence).then(result => {
        this.remember(o, e, result);
        return result;
      }).catch(error => {
        console.warn(`[arena-cache] ${o.key}: background refresh failed`, error instanceof Error ? error.message : error);
        throw error;
      }).finally(() => { e.refreshing = undefined; });
    }
    const work = e.refreshing;
    // after() keeps the origin query, Supabase write AND lease release alive.
    // CLI callers omit it and never leave a detached promise behind.
    if (o.waitUntil) o.waitUntil(work.then(() => {}, () => {}));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = baseline && o.waitUntil
        ? await Promise.race([
          work,
          new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), o.swrWaitMs ?? 1200); }),
        ])
        : await work;
      if (result) return { ...result, elapsedMs: Date.now() - started };
      const stale: CacheResult<T> = {
        payload: { ...baseline!, stale: true }, source: "stale-swr", persistence, elapsedMs: Date.now() - started,
      };
      this.remember(o, e, stale);
      return stale;
    } catch (error) {
      console.warn(`[arena-cache] ${o.key}: refresh failed`, error instanceof Error ? error.message : error);
      if (!baseline) throw error;
      const stale: CacheResult<T> = {
        payload: { ...baseline, stale: true }, source: "stale-baseline", persistence, elapsedMs: Date.now() - started,
      };
      this.remember(o, e, stale);
      return stale;
    } finally {
      clearTimeout(timer);
    }
  }

  private async refresh<T extends SnapshotPayload>(
    o: Options<T>, baseline: T | null, persistence: CachePersistence,
  ): Promise<CacheResult<T>> {
    let owner: string | null = null;
    if (persistence === "shared") {
      try {
        owner = await o.store.acquire();
      } catch (error) {
        persistence = "unavailable";
        console.warn(`[arena-cache] ${o.key}: lease unavailable`, error instanceof Error ? error.message : error);
      }
      if (!owner && persistence === "shared") {
        if (baseline) return { payload: { ...baseline, stale: true }, source: "shared-refresh", persistence, elapsedMs: 0 };
        // Empty cache + another writer: bounded wait; never launch a duplicate
        // full-history query just because another instance is still working.
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const value = await o.store.read();
          if (o.valid(value)) return {
            payload: { ...value, stale: !o.fresh(value, o.now) }, source: "supabase", persistence, elapsedMs: 0,
          };
        }
        throw new CacheBusyError("Shared snapshot is being initialized; retry shortly.");
      }
    }
    try {
      if (owner) {
        // Another writer may have finished between our first read and acquire.
        const latest = await o.store.read();
        baseline = newer(baseline, o.valid(latest) ? latest : null);
        if (baseline && o.fresh(baseline, o.now)) return {
          payload: { ...baseline, stale: false }, source: "supabase", persistence, elapsedMs: 0,
        };
      }
      const result = await o.load(baseline);
      if (!o.valid(result.payload)) {
        // An empty/degraded response must not overwrite any successful data.
        if (baseline) throw new Error("Origin returned an unusable snapshot.");
        return { ...result, persistence, elapsedMs: 0 };
      }
      if (baseline && Date.parse(result.payload.to) < Date.parse(baseline.to)) {
        throw new Error("Origin snapshot would move the data cutoff backwards.");
      }
      const payload = { ...result.payload, stale: !o.fresh(result.payload, o.now) };
      if (owner) {
        try {
          if (!await o.store.publish(payload, owner)) {
            const latest = await o.store.read();
            if (o.valid(latest) && Date.parse(latest.to) >= Date.parse(payload.to)) return {
              payload: { ...latest, stale: !o.fresh(latest, o.now) }, source: "supabase", persistence, elapsedMs: 0,
            };
            throw new Error("Snapshot was not committed (lease expired or newer data won).");
          }
        } catch (error) {
          persistence = "unavailable";
          console.warn(`[arena-cache] ${o.key}: persistence failed`, error instanceof Error ? error.message : error);
        }
      }
      return { ...result, payload, persistence, elapsedMs: 0 };
    } finally {
      if (owner) {
        await o.store.release(owner).catch(error => {
          console.warn(`[arena-cache] ${o.key}: lease release failed`, error instanceof Error ? error.message : error);
        });
      }
    }
  }
}

declare global {
  var zenmuxArenaSnapshotCache: SharedSnapshotCache | undefined;
}
export function sharedSnapshotCache(): SharedSnapshotCache {
  return globalThis.zenmuxArenaSnapshotCache ??= new SharedSnapshotCache();
}
