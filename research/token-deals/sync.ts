// Token Deals（让利账本）— DB → config roster sync (SERVER-ONLY, script use).
//
// This is where the old runtime DB discovery moved: the billing DB is polled
// for deal CANDIDATES, which are merged into config/token-deals.json for a
// human to confirm. The runtime never sees these tables anymore — it reads the
// config file only (./discovery.ts).
//
//   · model_discount — which models were EVER discounted, on which providers,
//     at what factor, and when. A row's life is its window: gmt_create starts
//     it; status!=active / deleted=1 ends it at gmt_modified (the revert
//     instant). expected_end_date is advisory ("预期") and never used as fact.
//   · model — display names + visibility for those slugs, plus the `-free`
//     suffixed models (100% off, usually absent from model_discount entirely).
//
// endDate seeding: an ACTIVE discount row seeds its endDate from the DB's
// expected_end_date (预期结束, advisory) as the DEFAULT offline date — the
// human adjusts it by hand afterwards. A reverted row seeds the actual revert
// instant instead.
//
// Merge rules (protect manual edits, never delete):
//   · New discount period (slug@startDate unseen) → appended, display=true,
//     endDate seeded (revert instant > expected_end_date > null).
//   · CONCLUDED discount entry (endDate set AND already past) → frozen
//     entirely (a manual early close must survive every future sync).
//   · OPEN discount entry (endDate null or still in the future) →
//     catalog-derived facts refresh (providers/discount/delisted/model/
//     publishDate); endDate only ever FILLS (null → seeded value) or moves
//     EARLIER when the DB shows an actual revert — a hand-set date is never
//     pushed later, and expectation changes never overwrite a hand edit.
//   · New free model → appended; online seeded once as "published within the
//     last 7 days and still visible", display=true.
//   · Existing free entry → never touched (online is maintained by hand).

import type { RowDataPacket } from "mysql2/promise";
import { dealsStartMs, parseSqlUtc, queryRows, toNumber, utcDateOf } from "./db";
import { shortName } from "@research/token-economics/normalize";
import {
  discountKey,
  type DealsConfigFile,
  type DiscountEntry,
  type FreeEntry,
  DEALS_CONFIG_SCHEMA,
} from "./deals-config";

const FREE_SUFFIX = "-free";
const FREE_ONLINE_SEED_DAYS = 7;

// ---------------------------------------------------------------------------
// DB rows
// ---------------------------------------------------------------------------

interface DiscountRow extends RowDataPacket {
  model_slug: string;
  model_name: string | null;
  provider_slug: string;
  provider_name: string | null;
  new_discount: string;
  /** Advisory 预期结束时间, yyyyMMdd — seeds the default endDate. */
  expected_end_date: string | null;
  status: string;
  deleted: number;
  gmt_create: string;
  gmt_modified: string;
}

interface ModelRow extends RowDataPacket {
  slug: string;
  name: string;
  short_name: string | null;
  visible: number;
  deleted: number;
  gmt_create: string;
  publish_time: string | null;
}

interface ProviderWindow {
  providerSlug: string;
  providerName: string;
  discount: number;
  startMs: number;
  /** null = still active. */
  endMs: number | null;
  /** Parsed expected_end_date (advisory), null when unset/unparseable. */
  expectedEndMs: number | null;
  createdMs: number;
}

/** One merged discount period of a model (provider windows unioned). */
interface MergedPeriod {
  startMs: number;
  endMs: number | null;
  providers: ProviderWindow[];
}

function overlapsOrTouches(a: MergedPeriod, w: ProviderWindow): boolean {
  // Day-granular union: windows on the same or adjacent calendar days merge
  // into one period (the ledger's period unit is the UTC day).
  const gap = 86_400_000;
  const aEnd = a.endMs ?? Infinity;
  return w.startMs <= aEnd + gap;
}

/** Union a slug's provider windows into disjoint periods (sorted by start). */
function mergeWindows(windows: ProviderWindow[]): MergedPeriod[] {
  const sorted = [...windows].sort((a, b) => a.startMs - b.startMs);
  const periods: MergedPeriod[] = [];
  for (const w of sorted) {
    const last = periods[periods.length - 1];
    if (last && overlapsOrTouches(last, w)) {
      last.providers.push(w);
      if (last.endMs != null) {
        last.endMs = w.endMs == null ? null : Math.max(last.endMs, w.endMs);
      }
    } else {
      periods.push({ startMs: w.startMs, endMs: w.endMs, providers: [w] });
    }
  }
  return periods;
}

/** Latest row per provider inside a period → the entry's provider detail. */
function providerDetail(period: MergedPeriod) {
  const byProvider = new Map<string, ProviderWindow>();
  for (const w of period.providers) {
    const prev = byProvider.get(w.providerSlug);
    if (!prev || w.createdMs > prev.createdMs) byProvider.set(w.providerSlug, w);
  }
  return [...byProvider.values()]
    .map((w) => ({ slug: w.providerSlug, name: w.providerName, discount: w.discount }))
    .sort((a, b) => a.discount - b.discount || a.slug.localeCompare(b.slug));
}

function displayName(model: ModelRow | undefined, fallbackName: string | null, slug: string): string {
  if (model?.short_name?.trim()) return model.short_name.trim();
  if (model?.name) return shortName(model.name, slug);
  if (fallbackName) return shortName(fallbackName, slug);
  return shortName(slug, slug);
}

function publishDateOf(model: ModelRow | undefined): string | null {
  const raw = model?.publish_time?.trim() || model?.gmt_create || null;
  return raw ? raw.slice(0, 10) : null;
}

function isDelisted(model: ModelRow | undefined): boolean {
  return model == null || model.visible !== 1 || model.deleted !== 0;
}

/** Model rows for a slug set, deduped (prefer the live row over deleted copies). */
async function queryModels(slugs: string[]): Promise<Map<string, ModelRow>> {
  if (slugs.length === 0) return new Map();
  const placeholders = slugs.map(() => "?").join(",");
  const rows = await queryRows<ModelRow>(
    `SELECT slug, name, short_name, visible, deleted, gmt_create, publish_time
     FROM model WHERE slug IN (${placeholders})`,
    slugs,
  );
  const bySlug = new Map<string, ModelRow>();
  for (const row of rows) {
    const prev = bySlug.get(row.slug);
    if (!prev || (prev.deleted !== 0 && row.deleted === 0)) bySlug.set(row.slug, row);
  }
  return bySlug;
}

// ---------------------------------------------------------------------------
// Discovery: DB → candidate entries
// ---------------------------------------------------------------------------

/** "20260731" → ms of 2026-07-31T00:00Z; null on anything unparseable. */
function parseYyyyMmDd(raw: string | null | undefined): number | null {
  const m = raw?.trim().match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const ms = Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

/** A discovered candidate — DiscountEntry plus merge-only metadata that never
    reaches the config file (saveDealsConfig strips unknown keys). */
export interface DiscountCandidate extends DiscountEntry {
  /** true = endDate is the ACTUAL revert instant from the DB; false = endDate
      is only the advisory expected_end_date seed (or null). */
  reverted: boolean;
}

export interface DiscoveredRoster {
  discounts: DiscountCandidate[];
  freeModels: FreeEntry[];
}

/** Pull every candidate deal from the DB, clamped to the ledger start
    (2025-09-29 launch). Windows fully reverted before it never surface. */
export async function discoverRosterFromDb(now = new Date()): Promise<DiscoveredRoster> {
  const startMs = dealsStartMs();

  const [discountRows, freeModelRows] = await Promise.all([
    queryRows<DiscountRow>(
      `SELECT model_slug, model_name, provider_slug, provider_name,
              new_discount, expected_end_date, status, deleted,
              gmt_create, gmt_modified
       FROM model_discount`,
      [],
    ),
    queryRows<ModelRow>(
      `SELECT slug, name, short_name, visible, deleted, gmt_create, publish_time
       FROM model WHERE slug LIKE ?`,
      [`%${FREE_SUFFIX}`],
    ),
  ]);

  // ── Discounted models: window per row, clamp + drop pre-window history ──
  const windowsBySlug = new Map<string, ProviderWindow[]>();
  for (const row of discountRows) {
    const createdMs = parseSqlUtc(row.gmt_create);
    if (createdMs == null) continue;
    const discount = toNumber(row.new_discount);
    // x1.0 rows are no-op configs (original_discount restores), not deals.
    if (!(discount > 0) || discount >= 1) continue;
    const active = row.status === "active" && row.deleted === 0;
    const endMs = active ? null : parseSqlUtc(row.gmt_modified);
    // Reverted before the ledger opened → never surfaces.
    if (endMs != null && endMs <= startMs) continue;
    const list = windowsBySlug.get(row.model_slug) ?? [];
    list.push({
      providerSlug: row.provider_slug,
      providerName: row.provider_name?.trim() || row.provider_slug,
      discount,
      startMs: Math.max(createdMs, startMs),
      endMs,
      expectedEndMs: parseYyyyMmDd(row.expected_end_date),
      createdMs,
    });
    windowsBySlug.set(row.model_slug, list);
  }

  const models = await queryModels([...windowsBySlug.keys()]);

  const discounts: DiscountCandidate[] = [];
  for (const [slug, windows] of windowsBySlug) {
    const nameFallback = discountRows.find((r) => r.model_slug === slug)?.model_name ?? null;
    const model = models.get(slug);
    for (const period of mergeWindows(windows)) {
      const providers = providerDetail(period);
      // Default endDate: the actual revert instant for closed periods, else
      // the latest advisory expected_end_date across the period's rows (the
      // human adjusts it afterwards), else open-ended.
      const reverted = period.endMs != null;
      const expectedEndMs = period.providers.reduce<number | null>(
        (acc, w) => (w.expectedEndMs != null && (acc == null || w.expectedEndMs > acc) ? w.expectedEndMs : acc),
        null,
      );
      const endMs = period.endMs ?? expectedEndMs;
      discounts.push({
        slug,
        model: displayName(model, nameFallback, slug),
        publishDate: publishDateOf(model),
        startDate: utcDateOf(period.startMs),
        endDate: endMs == null ? null : utcDateOf(endMs),
        discount: Math.min(...providers.map((p) => p.discount)),
        providers,
        delisted: isDelisted(model),
        display: true,
        reverted,
      });
    }
  }

  // ── Free models: dedup (prefer the live row), skip slugs that already carry
  //    a discount period. `online` is only a SEED here — the merge never
  //    applies it to an existing entry. ──
  const freeBySlug = new Map<string, ModelRow>();
  for (const row of freeModelRows) {
    const prev = freeBySlug.get(row.slug);
    if (!prev || (prev.deleted !== 0 && row.deleted === 0)) freeBySlug.set(row.slug, row);
  }
  const freeModels: FreeEntry[] = [];
  for (const [slug, row] of freeBySlug) {
    if (windowsBySlug.has(slug)) continue;
    const publishDate = publishDateOf(row);
    const ageDays = publishDate
      ? (now.getTime() - Date.parse(`${publishDate}T00:00:00Z`)) / 86_400_000
      : Infinity;
    freeModels.push({
      slug,
      sourceSlug: slug.slice(0, -FREE_SUFFIX.length),
      model: displayName(row, null, slug),
      publishDate,
      online: !isDelisted(row) && ageDays <= FREE_ONLINE_SEED_DAYS,
      display: true,
    });
  }

  discounts.sort((a, b) => a.slug.localeCompare(b.slug) || a.startDate.localeCompare(b.startDate));
  freeModels.sort((a, b) => a.slug.localeCompare(b.slug));
  return { discounts, freeModels };
}

// ---------------------------------------------------------------------------
// Merge: discovered candidates into the existing (hand-maintained) roster
// ---------------------------------------------------------------------------

export interface MergeReport {
  addedDiscounts: DiscountEntry[];
  addedFree: FreeEntry[];
  /** Open entries whose endDate an ACTUAL DB revert filled or moved earlier. */
  closedDiscounts: { slug: string; startDate: string; endDate: string }[];
  /** Open entries whose null endDate got the advisory expected_end_date. */
  seededEndDates: { slug: string; startDate: string; endDate: string }[];
  /** Open entries whose catalog-derived facts were refreshed (factor/delisted). */
  refreshedDiscounts: string[];
}

export function mergeDealsConfig(
  existing: DealsConfigFile | null,
  discovered: DiscoveredRoster,
  now = new Date(),
): { config: DealsConfigFile; report: MergeReport } {
  const report: MergeReport = {
    addedDiscounts: [],
    addedFree: [],
    closedDiscounts: [],
    seededEndDates: [],
    refreshedDiscounts: [],
  };
  const today = utcDateOf(now.getTime());

  const discounts = [...(existing?.discounts ?? [])];
  const byKey = new Map(discounts.map((e, i) => [discountKey(e), i]));
  for (const candidate of discovered.discounts) {
    const { reverted, ...candidateEntry } = candidate;
    const idx = byKey.get(discountKey(candidate));
    if (idx == null) {
      discounts.push(candidateEntry);
      report.addedDiscounts.push(candidateEntry);
      continue;
    }
    const current = discounts[idx];
    // CONCLUDED (endDate already past — set by a past sync or by hand, e.g. an
    // early manual close) → frozen entirely.
    if (current.endDate != null && current.endDate < today) continue;

    // OPEN entry: endDate only ever fills or moves EARLIER on a real revert —
    // a hand-set date is never pushed later, expectation changes never
    // overwrite a hand edit.
    let endDate = current.endDate;
    if (reverted && candidateEntry.endDate != null) {
      const actual = candidateEntry.endDate;
      if (endDate == null || actual < endDate) {
        endDate = actual;
        report.closedDiscounts.push({ slug: current.slug, startDate: current.startDate, endDate: actual });
      }
    } else if (endDate == null && candidateEntry.endDate != null) {
      endDate = candidateEntry.endDate;
      report.seededEndDates.push({ slug: current.slug, startDate: current.startDate, endDate });
    }

    const refreshed: DiscountEntry = {
      ...current,
      model: candidateEntry.model,
      publishDate: candidateEntry.publishDate,
      discount: candidateEntry.discount,
      providers: candidateEntry.providers,
      delisted: candidateEntry.delisted,
      // display is the human's switch — never synced.
      endDate,
    };
    if (
      endDate === current.endDate &&
      JSON.stringify(refreshed) !== JSON.stringify(current)
    ) {
      report.refreshedDiscounts.push(discountKey(current));
    }
    discounts[idx] = refreshed;
  }

  const freeModels = [...(existing?.freeModels ?? [])];
  const freeSlugs = new Set(freeModels.map((e) => e.slug));
  for (const candidate of discovered.freeModels) {
    if (freeSlugs.has(candidate.slug)) continue; // existing free entries are hand-owned
    freeModels.push(candidate);
    report.addedFree.push(candidate);
  }

  return {
    config: {
      schema: DEALS_CONFIG_SCHEMA,
      syncedAt: now.toISOString(),
      discounts,
      freeModels,
    },
    report,
  };
}
