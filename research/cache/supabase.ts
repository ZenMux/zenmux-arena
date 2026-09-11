// Server/CLI data plane. Never import this module from a client component.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { snapshotExpiresAt, snapshotKey, type SnapshotId, type SnapshotPayload } from "./payload";

export class SupabaseConfigError extends Error {}

function clean(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

export function supabaseEnv() {
  const url = clean(process.env.SUPABASE_URL) ?? clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = clean(process.env.SUPABASE_PUBLISHABLE_KEY) ??
    clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const secretKey = clean(process.env.SUPABASE_SECRET_KEY) ?? clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return { url, publishableKey, secretKey };
}

let singleton: { url: string; key: string; client: SupabaseClient } | undefined;

export function serviceSupabase(): SupabaseClient {
  const { url, secretKey } = supabaseEnv();
  if (!url || !secretKey) {
    throw new SupabaseConfigError("Shared cache requires SUPABASE_URL and server-only SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).");
  }
  if (singleton?.url === url && singleton.key === secretKey) return singleton.client;
  const client = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-application-name": "zenmux-arena" } },
  });
  singleton = { url, key: secretKey, client };
  return client;
}

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
    async read() {
      const { data, error } = await serviceSupabase().from("arena_snapshot_cache")
        .select("payload").eq("cache_key", key).abortSignal(timeout()).maybeSingle();
      if (error) throw new Error(`Supabase snapshot read (${error.code}): ${error.message}`);
      return (data?.payload as T | undefined) ?? null;
    },
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

/** Maintenance writers obey the same lease and monotonic publish rule as requests. */
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
