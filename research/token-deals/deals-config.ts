// Token Deals（让利账本）— the human-curated deal roster (config file layer).
//
// config/token-deals.json is the SINGLE source of deal FACTS for the runtime:
// which models are on discount (window + per-provider factors) and which
// `-free` models are on the board. It is produced by `pnpm tokendeals:sync`
// (research/scripts/sync-deals-config.ts), which pulls candidates from the
// billing DB and merges them INCREMENTALLY — manual edits (an early endDate,
// a flipped `online`, a `display: false`) are never overwritten; see ./sync.ts
// for the exact merge rules. The runtime (discovery.ts) only ever READS this
// file; on serverless it ships inside the deploy bundle via next.config.ts
// outputFileTracingIncludes.
//
// SERVER-ONLY (node:fs). Client components must import wire types from
// ./types, never from here.

import fs from "node:fs/promises";
import path from "node:path";

export const DEALS_CONFIG_SCHEMA = 1;

const CONFIG_PATH_ENV = "TOKEN_DEALS_CONFIG_PATH";

export function dealsConfigPath(): string {
  return (
    process.env[CONFIG_PATH_ENV]?.trim() ||
    path.join(process.cwd(), "config", "token-deals.json")
  );
}

export interface ConfigProvider {
  slug: string;
  name: string;
  /** User-pays fraction on this provider (0.31 = pay 31%). */
  discount: number;
}

/** One discount period of one model. Frozen once its `endDate` has PASSED
    (whether set by the sync script or by hand to end a deal early). */
export interface DiscountEntry {
  slug: string;
  /** Display name snapshot (model.short_name at sync time). */
  model: string;
  /** Model listing date (model.publish_time, YYYY-MM-DD) — display only. */
  publishDate: string | null;
  /** Deal window, UTC dates, endDate inclusive. Seeded by sync as the DB's
      advisory expected_end_date (or the actual revert instant once reverted);
      hand-adjust freely — sync only fills a null endDate or moves it EARLIER
      on a real revert, never later. null = open-ended. */
  startDate: string;
  endDate: string | null;
  /** Deepest user-pays fraction across providers (display + fallback factor). */
  discount: number;
  /** Per-provider factors — the subscription-traffic SAVED math needs these. */
  providers: ConfigProvider[];
  /** Model hidden/removed on the main site → keep the card, drop the link. */
  delisted: boolean;
  /** Human master switch: only entries with display=true reach the frontend. */
  display: boolean;
}

/** One `-free` suffixed model. After first insert the sync script never
    touches the entry again — `online` is maintained by hand. */
export interface FreeEntry {
  slug: string;
  /** The paid sibling (slug minus `-free`) — struck-through list price source. */
  sourceSlug: string;
  model: string;
  /** Listing date (publish_time, falling back to gmt_create). Also the ledger
      start: usage is counted from max(publishDate, DEALS_LAUNCH_ISO). */
  publishDate: string | null;
  /** Claimable right now? Auto-seeded once at first sync (published within the
      last 7 days → true), manually maintained afterwards. false → the deal
      shows as ended and its outbound link is dropped. */
  online: boolean;
  display: boolean;
}

export interface DealsConfigFile {
  schema: number;
  /** Last sync run (informational; manual edits need not update it). */
  syncedAt?: string;
  discounts: DiscountEntry[];
  freeModels: FreeEntry[];
}

/** Stable identity of a discount period across syncs. */
export function discountKey(entry: Pick<DiscountEntry, "slug" | "startDate">): string {
  return `${entry.slug}@${entry.startDate}`;
}

function isDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function invalid(where: string, what: string): Error {
  return new Error(`[token-deals] invalid config at ${dealsConfigPath()} — ${where}: ${what}`);
}

/** Parse + validate the config file content. Throws on malformed entries so a
    bad hand-edit fails loudly instead of silently dropping deals. */
export function parseDealsConfig(content: string): DealsConfigFile {
  const raw = JSON.parse(content) as Partial<DealsConfigFile>;
  if (raw.schema !== DEALS_CONFIG_SCHEMA) {
    throw invalid("schema", `expected ${DEALS_CONFIG_SCHEMA}, got ${String(raw.schema)}`);
  }
  const discounts = (raw.discounts ?? []).map((e, i) => {
    if (!e?.slug || typeof e.slug !== "string") throw invalid(`discounts[${i}]`, "missing slug");
    if (!isDate(e.startDate)) throw invalid(`discounts[${i}] ${e.slug}`, "startDate must be YYYY-MM-DD");
    if (e.endDate != null && !isDate(e.endDate)) throw invalid(`discounts[${i}] ${e.slug}`, "endDate must be YYYY-MM-DD or null");
    if (typeof e.discount !== "number" || !(e.discount > 0) || e.discount >= 1) {
      throw invalid(`discounts[${i}] ${e.slug}`, `discount must be a fraction in (0, 1), got ${String(e.discount)}`);
    }
    return normalizeDiscount(e as DiscountEntry);
  });
  const freeModels = (raw.freeModels ?? []).map((e, i) => {
    if (!e?.slug || typeof e.slug !== "string") throw invalid(`freeModels[${i}]`, "missing slug");
    return normalizeFree(e as FreeEntry);
  });
  return { schema: DEALS_CONFIG_SCHEMA, syncedAt: raw.syncedAt, discounts, freeModels };
}

/** Read the roster. null when the file doesn't exist yet (run tokendeals:sync);
    malformed content throws (see parseDealsConfig). */
export async function loadDealsConfig(): Promise<DealsConfigFile | null> {
  let content: string;
  try {
    content = await fs.readFile(dealsConfigPath(), "utf-8");
  } catch {
    return null;
  }
  return parseDealsConfig(content);
}

// Rebuild entries with a fixed key order so the file diffs cleanly across
// syncs and hand edits.
function normalizeDiscount(e: DiscountEntry): DiscountEntry {
  return {
    slug: e.slug,
    model: e.model ?? e.slug,
    publishDate: e.publishDate ?? null,
    startDate: e.startDate,
    endDate: e.endDate ?? null,
    discount: e.discount,
    providers: (e.providers ?? []).map((p) => ({ slug: p.slug, name: p.name, discount: p.discount })),
    delisted: e.delisted === true,
    display: e.display !== false,
  };
}

function normalizeFree(e: FreeEntry): FreeEntry {
  return {
    slug: e.slug,
    sourceSlug: e.sourceSlug ?? e.slug.replace(/-free$/, ""),
    model: e.model ?? e.slug,
    publishDate: e.publishDate ?? null,
    online: e.online !== false,
    display: e.display !== false,
  };
}

/** Atomic write (tmp → rename), pretty-printed for hand editing. Only the sync
    script calls this — the runtime never writes the config. */
export async function saveDealsConfig(config: DealsConfigFile): Promise<void> {
  const file = dealsConfigPath();
  const sorted: DealsConfigFile = {
    schema: DEALS_CONFIG_SCHEMA,
    syncedAt: config.syncedAt,
    discounts: [...config.discounts]
      .map(normalizeDiscount)
      .sort((a, b) => a.slug.localeCompare(b.slug) || a.startDate.localeCompare(b.startDate)),
    freeModels: [...config.freeModels]
      .map(normalizeFree)
      .sort((a, b) => a.slug.localeCompare(b.slug)),
  };
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.writeFile(tmp, `${JSON.stringify(sorted, null, 2)}\n`, "utf-8");
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.unlink(tmp).catch(() => {});
    throw err;
  }
}
