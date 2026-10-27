// Server/CLI data plane. Never import this module from a client component.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { snapshotKey, type SnapshotId, type SnapshotPayload } from "./payload";

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

export interface SnapshotReader<T> { read(): Promise<T | null>; }

export function supabaseSnapshotStore<T extends SnapshotPayload>(id: SnapshotId): SnapshotReader<T> {
  const key = snapshotKey(id);
  return {
    async read() {
      const ms = Number(process.env.ARENA_CACHE_TIMEOUT_MS ?? 15000);
      const { data, error } = await serviceSupabase().from("arena_snapshot_cache")
        .select("payload").eq("cache_key", key)
        .abortSignal(AbortSignal.timeout(Number.isFinite(ms) && ms > 0 ? ms : 15000)).maybeSingle();
      if (error) throw new Error(`Supabase snapshot read (${error.code}): ${error.message}`);
      return (data?.payload as T | undefined) ?? null;
    },
  };
}
