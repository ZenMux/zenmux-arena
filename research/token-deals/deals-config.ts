// Token Deals（让利账本）— deal-period registry loader (SERVER-ONLY).
//
// The registry (config/token-deals.json) is the single source of truth for deal
// periods: the public listByFilter API only reflects "now", so history (ended
// deals) MUST be registered here. This module parses + validates the registry.
// All pure types/constants/math live in ./types.ts (client-safe, no node:fs) and
// are re-exported here for server-side callers.
//
// Validation is deliberately strict and runs at load time (build/startup):
// a bad registry entry must fail loudly BEFORE it can publish wrong money
// numbers on a public page. See the PRD's rule 1 (period lifecycle) and §5.4
// (illegal discount / overlapping windows / inverted dates are all rejected).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { VENDORS } from "@research/lib/vendors";
import { vendorForSlug } from "@research/token-economics/normalize";
import { DealsConfigError, type DealPeriod } from "./types";

export * from "./types";

const CONFIG_PATH = ["config", "token-deals.json"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(message: string): never {
  throw new DealsConfigError(message);
}

function parseDate(value: unknown, ctx: string, key: string): string {
  if (typeof value !== "string" || !DATE_RE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    fail(`${ctx}.${key} must be a YYYY-MM-DD date; got ${JSON.stringify(value)}.`);
  }
  return value;
}

function parsePrice(value: unknown, ctx: string, key: string): number {
  const n = typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n) || n < 0) fail(`${ctx}.${key} must be a non-negative number.`);
  return n;
}

function round6(n: number): number {
  return Number(n.toFixed(6));
}

function parseDeal(value: unknown, index: number): DealPeriod {
  const ctx = `deals[${index}]`;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${ctx} must be an object.`);
  }
  const obj = value as Record<string, unknown>;

  const model = typeof obj.model === "string" && obj.model.trim() ? obj.model.trim() : null;
  const slug = typeof obj.slug === "string" && obj.slug.trim() ? obj.slug.trim() : null;
  if (!model || !slug) fail(`${ctx} must include non-empty model and slug strings.`);

  const discount = typeof obj.discount === "number" ? obj.discount : NaN;
  // 0 < discount < 1: a "deal" at x1.0 (or an impossible ≤0 / >1 factor) is a
  // registry mistake, not a period — reject it up front (PRD §5.4).
  if (!Number.isFinite(discount) || discount <= 0 || discount >= 1) {
    fail(`${ctx} (${slug}) discount must be a number in (0, 1); got ${JSON.stringify(obj.discount)}.`);
  }

  const netInput = parsePrice(obj.netInput, ctx, "netInput");
  const netOutput = parsePrice(obj.netOutput, ctx, "netOutput");
  const startDate = parseDate(obj.startDate, ctx, "startDate");
  const endDate = obj.endDate == null ? null : parseDate(obj.endDate, ctx, "endDate");
  if (endDate && endDate < startDate) {
    fail(`${ctx} (${slug}) endDate ${endDate} is before startDate ${startDate}.`);
  }

  const origInput = round6(netInput / discount);
  const origOutput = round6(netOutput / discount);
  // Negative subsidy (orig < net) can't happen with discount < 1, but keep the
  // guard against future format changes where orig might be registered directly.
  if (origInput < netInput || origOutput < netOutput) {
    fail(`${ctx} (${slug}) restored list price is below the net price — negative subsidy rejected.`);
  }

  const vendor = vendorForSlug(slug);
  return {
    id: `${slug}@${startDate}`,
    model,
    slug,
    vendor,
    vendorName: VENDORS[vendor]?.name ?? vendor,
    discount,
    netInput,
    netOutput,
    origInput,
    origOutput,
    startDate,
    endDate,
    delisted: obj.delisted === true,
  };
}

/** Reject overlapping windows for the same model (registry mistake). An open
    period (endDate null) occupies [start, ∞), so at most one may exist per slug
    and every closed period of that slug must end before it starts. */
function checkWindows(deals: DealPeriod[]) {
  const bySlug = new Map<string, DealPeriod[]>();
  for (const deal of deals) {
    const list = bySlug.get(deal.slug) ?? [];
    list.push(deal);
    bySlug.set(deal.slug, list);
  }
  for (const [slug, list] of bySlug) {
    const sorted = [...list].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      // Windows are inclusive of endDate, so the next period must start strictly after it.
      if (prev.endDate == null || cur.startDate <= prev.endDate) {
        fail(
          `Deal windows overlap for ${slug}: [${prev.startDate}, ${prev.endDate ?? "∞"}] vs [${cur.startDate}, ${cur.endDate ?? "∞"}].`,
        );
      }
    }
  }
}

/** Load + validate the registry. Throws DealsConfigError on any bad entry. */
export async function loadDealsConfig(): Promise<DealPeriod[]> {
  const file = path.join(process.cwd(), ...CONFIG_PATH);
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    fail(`Unable to read deals registry at ${file}: ${error instanceof Error ? error.message : error}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    fail(`Deals registry at ${file} is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }

  const root = parsed as Record<string, unknown>;
  if (!root || !Array.isArray(root.deals)) fail("Deals registry must include a deals array.");

  const deals = root.deals.map(parseDeal);
  checkWindows(deals);
  return deals;
}
