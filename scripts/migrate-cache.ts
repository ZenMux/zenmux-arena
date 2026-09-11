import { config } from "dotenv";
import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { archiveSnapshot, verifyArchive } from "../research/cache/archive";
import {
  payloadHash, snapshotId, snapshotKey, validDeals, validEconomics,
  type CacheScope, type CacheRange, type SnapshotPayload,
} from "../research/cache/payload";
import { supabaseSnapshotStore, writeSharedSnapshot } from "../research/cache/supabase";

config({ path: ".env.local", quiet: true });

async function jsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? jsonFiles(file) : Promise.resolve(entry.isFile() && entry.name.endsWith(".json") ? [file] : []);
  }));
  return nested.flat().sort();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const verifyOnly = process.argv.includes("--verify-only");
  const rootIndex = process.argv.indexOf("--cache-root");
  const root = path.resolve(rootIndex < 0 ? ".cache" : process.argv[rootIndex + 1]);
  const inputs = [];
  for (const scope of ["token-economics", "token-deals"] as const) {
    for (const file of await jsonFiles(path.join(root, scope))) {
      const raw = await readFile(file, "utf8");
      const payload = JSON.parse(raw) as SnapshotPayload;
      if (!Number.isFinite(Date.parse(payload.to)) || !["all", "72h"].includes(payload.range)) {
        throw new Error(`Invalid source window: ${file}`);
      }
      const relative = path.relative(root, file).split(path.sep).join("/");
      const active = relative === `${scope}/${scope === "token-economics" ? "live/" : ""}${payload.range}.json`;
      const valid = scope === "token-economics" ? validEconomics(payload, payload.range as CacheRange) : validDeals(payload, payload.range as CacheRange);
      if (active && !valid) throw new Error(`Current cache has incompatible schema or incomplete data: ${file}`);
      inputs.push({ scope, file, relative, raw, payload, active, hash: payloadHash(payload) });
    }
  }
  if (inputs.filter(i => i.active).length !== 4) throw new Error("Expected all four current range snapshots before migration.");
  console.log(`${dryRun ? "DRY RUN" : verifyOnly ? "VERIFY" : "MIGRATE"}: ${inputs.length} files, ${inputs.reduce((n, i) => n + Buffer.byteLength(i.raw), 0)} bytes; source files stay unchanged.`);
  const report = [];
  // Archive every file before promoting ANY active snapshot. A failed archive
  // verification therefore cannot leave a partially cut-over data plane.
  for (const input of inputs) {
    const sourceHash = createHash("sha256").update(input.raw).digest("hex");
    if (!dryRun) {
      if (verifyOnly) await verifyArchive(input.scope, input.relative, sourceHash, input.hash);
      else await archiveSnapshot(input.scope, input.relative, input.payload, input.raw);
    }
    console.log(`  ${input.relative}: ${input.payload.to} · ${input.active ? "current + archive" : "archive only"} · ${input.hash.slice(0, 12)}`);
    report.push({ source: input.relative, scope: input.scope as CacheScope, cutoff: input.payload.to, sourceHash, payloadHash: input.hash, active: input.active });
  }
  for (const input of inputs.filter(i => i.active)) {
    if (dryRun) continue;
    const id = snapshotId(input.scope, input.payload.range as CacheRange);
    const store = supabaseSnapshotStore(id);
    let shared = await store.read();
    const sourceIsNewer = !shared || Date.parse(input.payload.to) > Date.parse(shared.to) ||
      (input.payload.to === shared.to && Date.parse(input.payload.generatedAt) > Date.parse(shared.generatedAt));
    if (!verifyOnly && sourceIsNewer) {
      await writeSharedSnapshot(id, input.payload);
      shared = await store.read();
    }
    if (!shared || Date.parse(shared.to) < Date.parse(input.payload.to)) throw new Error(`Shared snapshot is missing/older: ${snapshotKey(id)}`);
    const exact = payloadHash(shared) === input.hash;
    if (!exact && Date.parse(shared.to) === Date.parse(input.payload.to) && Date.parse(shared.generatedAt) <= Date.parse(input.payload.generatedAt)) {
      throw new Error(`Current snapshot round-trip mismatch: ${snapshotKey(id)}`);
    }
    console.log(`  verified ${snapshotKey(id)}: ${exact ? "exact payload match" : "newer shared snapshot preserved"}`);
  }
  if (!dryRun) {
    const out = path.join(root, "migration-reports");
    await mkdir(out, { recursive: true });
    await writeFile(path.join(out, `supabase-${Date.now()}.json`), JSON.stringify({ at: new Date().toISOString(), verified: true, files: report }, null, 2));
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
