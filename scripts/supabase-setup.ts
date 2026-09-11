import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { snapshotId, snapshotKey, validDeals, validEconomics } from "../research/cache/payload";
import { serviceSupabase, supabaseEnv, supabaseSnapshotStore } from "../research/cache/supabase";

config({ path: ".env.local", quiet: true });
const schemaPath = "supabase/schema.sql";

async function check() {
  const client = serviceSupabase();
  for (const table of ["arena_snapshot_cache", "arena_cache_leases", "arena_cache_archives"]) {
    const { count, error } = await client.from(table).select("*", { count: "exact", head: true })
      .abortSignal(AbortSignal.timeout(15000));
    if (error) throw new Error(`${table} (${error.code}): ${error.message}`);
    console.log(`OK ${table}: ${count} rows`);
  }
  const { url, publishableKey } = supabaseEnv();
  if (!publishableKey) throw new Error("SUPABASE_PUBLISHABLE_KEY is required to verify client isolation.");
  for (const table of ["arena_snapshot_cache", "arena_cache_leases", "arena_cache_archives"]) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: publishableKey }, signal: AbortSignal.timeout(15000),
    });
    const body = await response.json();
    if (![401, 403].includes(response.status) || body.code !== "42501") throw new Error(`Expected publishable-key access denial for ${table}, got HTTP ${response.status}.`);
    console.log(`OK ${table}: publishable key denied`);
  }
  const owner = randomUUID();
  const probeKey = "__arena_setup_probe__";
  try {
    const first = await client.rpc("arena_cache_acquire", { p_key: probeKey, p_owner: owner, p_seconds: 30 });
    if (first.error || first.data !== true) throw new Error("Lease probe could not acquire lock.");
    const second = await client.rpc("arena_cache_acquire", { p_key: probeKey, p_owner: randomUUID(), p_seconds: 30 });
    if (second.error || second.data !== false) throw new Error("Lease did not exclude a concurrent writer.");
    const fence = await client.rpc("arena_cache_publish", { p_snapshot: { cache_key: probeKey }, p_owner: randomUUID() });
    if (fence.error || fence.data !== false) throw new Error("Publish RPC did not fence out an unowned lease.");
    console.log("OK lease acquisition, concurrent exclusion, publish fencing");
  } finally {
    await client.from("arena_cache_leases").delete().eq("cache_key", probeKey).eq("owner", owner);
  }
  let missing = 0;
  for (const scope of ["token-economics", "token-deals"] as const) {
    for (const range of ["all", "72h"] as const) {
      const id = snapshotId(scope, range);
      const payload = await supabaseSnapshotStore(id).read();
      const valid = scope === "token-deals" ? validDeals(payload, range) : validEconomics(payload, range);
      if (!valid || !payload) { missing++; console.log(`MISSING ${snapshotKey(id)}`); continue; }
      console.log(`OK ${snapshotKey(id)}: data through ${payload.to}, generated ${payload.generatedAt}`);
    }
  }
  if (missing && process.argv.includes("--require-data")) throw new Error(`${missing} usable snapshots missing; run the Supabase refresh/backfill commands before deployment.`);
}

async function main() {
  const testing = process.argv.includes("--test");
  const inputPath = testing ? "supabase/tests/cache.sql" : schemaPath;
  const sql = await readFile(inputPath, "utf8");
  if (process.argv.includes("--print")) { process.stdout.write(sql); return; }
  if (!process.argv.includes("--check")) {
    const { url } = supabaseEnv();
    const ref = url ? new URL(url).hostname.split(".")[0] : undefined;
    const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
    const dbUrl = process.env.SUPABASE_DB_URL?.trim();
    if (ref && token) {
      const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql }), signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) throw new Error(`Schema setup failed: HTTP ${response.status} ${(await response.text()).slice(0, 400)}`);
      await response.arrayBuffer();
      console.log(testing ? "Transactional database checks passed (rolled back)." : "Applied Arena schema.");
    } else if (dbUrl) {
      const result = spawnSync("psql", ["-v", "ON_ERROR_STOP=1", "-f", inputPath], {
        env: { ...process.env, PGDATABASE: dbUrl }, stdio: "inherit",
      });
      if (result.status !== 0) throw new Error("psql schema setup failed.");
    } else {
      throw new Error(`SQL execution requires SUPABASE_ACCESS_TOKEN or SUPABASE_DB_URL. Alternatively run ${inputPath} in https://supabase.com/dashboard/project/${ref ?? "_"}/sql/new`);
    }
  }
  await check();
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
