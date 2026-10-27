import type { SnapshotPayload } from "./payload";
import type { SnapshotReader } from "./supabase";

export type CacheSource = "l1-memory" | "supabase" | "single-flight" | "stale-baseline";
export type CachePersistence = "shared" | "unavailable";
export interface CacheResult<T> { payload: T; source: CacheSource; persistence: CachePersistence; elapsedMs: number; }
interface Options<T extends SnapshotPayload> {
  key: string;
  store: SnapshotReader<T>;
  now: Date;
  valid: (value: unknown) => value is T;
  fresh: (value: T, now: Date) => boolean;
  ttlMs?: number;
}
interface Entry<T> { lastGood: T | null; until: number; reading?: Promise<CacheResult<T>>; }
export class CacheSnapshotUnavailableError extends Error {}

/** Public reads only. Expired snapshots never trigger source queries or writes. */
export class SharedSnapshotCache {
  private entries = new Map<string, Entry<SnapshotPayload>>();

  async get<T extends SnapshotPayload>(o: Options<T>): Promise<CacheResult<T>> {
    let e = this.entries.get(o.key) as Entry<T> | undefined;
    if (!e) { e = { lastGood: null, until: 0 }; this.entries.set(o.key, e); }
    if (e.lastGood && e.until > Date.now()) return {
      payload: { ...e.lastGood, stale: !o.fresh(e.lastGood, o.now) },
      source: "l1-memory", persistence: "shared", elapsedMs: 0,
    };
    if (e.reading) return { ...await e.reading, source: "single-flight" };
    const work = this.read(o, e);
    e.reading = work;
    try { return await work; } finally { e.reading = undefined; }
  }

  private async read<T extends SnapshotPayload>(o: Options<T>, e: Entry<T>): Promise<CacheResult<T>> {
    const started = Date.now();
    try {
      const raw = await o.store.read();
      if (!o.valid(raw)) throw new CacheSnapshotUnavailableError("Shared data is not available yet.");
      // An older replica/result cannot replace newer data already observed here.
      const p = e.lastGood && (Date.parse(e.lastGood.to) > Date.parse(raw.to) ||
        (e.lastGood.to === raw.to && Date.parse(e.lastGood.generatedAt) > Date.parse(raw.generatedAt))) ? e.lastGood : raw;
      e.lastGood = p;
      e.until = Date.now() + (o.ttlMs ?? 10_000);
      return { payload: { ...p, stale: !o.fresh(p, o.now) }, source: p === raw ? "supabase" : "l1-memory",
        persistence: "shared", elapsedMs: Date.now() - started };
    } catch {
      if (!e.lastGood) throw new CacheSnapshotUnavailableError("Shared data is not available yet.");
      return { payload: { ...e.lastGood, stale: true }, source: "stale-baseline",
        persistence: "unavailable", elapsedMs: Date.now() - started };
    }
  }
}

declare global { var zenmuxArenaSnapshotCache: SharedSnapshotCache | undefined; }
export function sharedSnapshotCache(): SharedSnapshotCache {
  return globalThis.zenmuxArenaSnapshotCache ??= new SharedSnapshotCache();
}
