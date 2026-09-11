import { createHash } from "node:crypto";
import { payloadHash, type CacheScope, type SnapshotPayload } from "./payload";
import { serviceSupabase } from "./supabase";

export async function archiveSnapshot(
  scope: CacheScope, sourcePath: string, payload: SnapshotPayload,
) {
  const sourceHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const hash = payloadHash(payload);
  const row = {
    scope, source_path: sourcePath, source_sha256: sourceHash, payload_sha256: hash,
    payload, data_through: payload.to,
  };
  const client = serviceSupabase();
  const { error } = await client.from("arena_cache_archives").upsert(row, {
    onConflict: "scope,source_path,source_sha256", ignoreDuplicates: true,
  }).abortSignal(AbortSignal.timeout(30000));
  if (error) throw new Error(`Archive insert (${error.code}): ${error.message}`);
  await verifyArchive(scope, sourcePath, sourceHash, hash);
  return { sourceHash, payloadHash: hash };
}

async function verifyArchive(scope: CacheScope, sourcePath: string, sourceHash: string, hash: string) {
  const { data, error } = await serviceSupabase().from("arena_cache_archives")
    .select("payload,payload_sha256").eq("scope", scope).eq("source_path", sourcePath)
    .eq("source_sha256", sourceHash).abortSignal(AbortSignal.timeout(30000)).single();
  if (error) throw new Error(`Archive verification (${error.code}): ${error.message}`);
  if (data.payload_sha256 !== hash || payloadHash(data.payload) !== hash) {
    throw new Error(`Archive round-trip mismatch: ${sourcePath}`);
  }
}
