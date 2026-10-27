// Internal publication and refresh leases; never imported by the website.
import { randomUUID } from "node:crypto";
import { serviceSupabase, supabaseSnapshotStore as snapshotReader } from "@research/cache/supabase";
import { snapshotExpiresAt, snapshotKey, type SnapshotId, type SnapshotPayload } from "@research/cache/payload";

function timeout(): AbortSignal {
  const ms = Number(process.env.ARENA_CACHE_TIMEOUT_MS ?? 15000);
  return AbortSignal.timeout(Number.isFinite(ms) && ms > 0 ? ms : 15000);
}

export interface SnapshotStore<T> {
  read(): Promise<T | null>;
  acquire(): Promise<string | null>;
  publish(payload: T, owner: string): Promise<boolean>;
  release(owner: string): Promise<void>;
}

export function snapshotRow(id: SnapshotId, payload: SnapshotPayload) {
  return {
    cache_key: snapshotKey(id), scope: id.scope, version: id.version, variant: id.range,
    payload, data_from: payload.from, data_through: payload.to,
    refreshed_at: payload.generatedAt, expires_at: snapshotExpiresAt(id, payload),
    payload_bytes: Buffer.byteLength(JSON.stringify(payload)),
  };
}

export function supabaseSnapshotStore<T extends SnapshotPayload>(id: SnapshotId): SnapshotStore<T> {
  const key = snapshotKey(id);
  return {
    read: snapshotReader<T>(id).read,
    async acquire() {
      const owner = randomUUID();
      const { data, error } = await serviceSupabase().rpc("arena_cache_acquire", {
        p_key: key, p_owner: owner, p_seconds: 900,
      }).abortSignal(timeout());
      if (error) throw new Error(`Supabase lease (${error.code}): ${error.message}`);
      return data === true ? owner : null;
    },
    async publish(payload, owner) {
      const { data, error } = await serviceSupabase().rpc("arena_cache_publish", {
        p_snapshot: snapshotRow(id, payload), p_owner: owner,
      }).abortSignal(timeout());
      if (error) throw new Error(`Supabase snapshot write (${error.code}): ${error.message}`);
      return data === true;
    },
    async release(owner) {
      const { error } = await serviceSupabase().rpc("arena_cache_release", {
        p_key: key, p_owner: owner,
      }).abortSignal(timeout());
      if (error) throw new Error(`Supabase lease release (${error.code}): ${error.message}`);
    },
  };
}

/** Maintenance writers obey the scheduled producer's lease and monotonic publish rule. */
export async function writeSharedSnapshot<T extends SnapshotPayload>(id: SnapshotId, payload: T): Promise<void> {
  const store = supabaseSnapshotStore<T>(id);
  const owner = await store.acquire();
  if (!owner) throw new Error(`${snapshotKey(id)} is refreshing in another process; retry later.`);
  try {
    if (!await store.publish(payload, owner)) {
      throw new Error(`${snapshotKey(id)} was not published: newer data exists or the lease expired.`);
    }
  } finally {
    await store.release(owner);
  }
}
