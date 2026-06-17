// Launch-window usage: the per-model daily token series + the average-per-
// working-day metric derived from it.
//
// WHY THIS EXISTS. The model-listing API (scrape.ts) only gives all-time
// `all_tokens`, which mechanically rewards older models (more days to
// accumulate). To compare demand fairly across release dates we instead measure
// each model's LAUNCH VELOCITY: the average tokens served per working day over
// its first {@link LAUNCH_WINDOW_WORKING_DAYS} working days. That needs per-day
// data, which only the authenticated management endpoint provides:
//
//   GET https://zenmux.ai/api/v1/management/statistics/model_usage
//     ?model=<slug>&metric=tokens&starting_at=YYYY-MM-DD&ending_at=YYYY-MM-DD
//   Authorization: Bearer <ZENMUX_MANAGEMENT_KEY>
//   → { success, data: { value, series: [{ date, value }, …] } }
//
// Constraints we design around: Management-key only, per-minute rate limit
// (HTTP 422 on overflow), ≤ 30-day span per request, data starts 2025-09-29,
// latest available day is yesterday (T-1). A 14-working-day window spans ≤ ~19
// calendar days, so each model is exactly ONE request — no pagination.

import {
  LAUNCH_WINDOW_WORKING_DAYS,
  type AvgDailyWindow,
  type DailyUsagePoint,
  type ModelUsageSeries,
} from "./types";

/** The management API base; the page/CLI build the query string per model. */
export const MODEL_USAGE_URL =
  "https://zenmux.ai/api/v1/management/statistics/model_usage";

/** Earliest day the platform has aggregated data for (documented data-start). */
export const DATA_START = "2025-09-29";

/** Env var holding the Management API Key (distinct from the generation key). */
export const MANAGEMENT_KEY_ENV = "ZENMUX_MANAGEMENT_KEY";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// UTC date string helpers — all math is on "YYYY-MM-DD" strings so a server in
// any timezone computes the same window (no local-midnight drift).
// ---------------------------------------------------------------------------

/** "YYYY-MM-DD" → UTC Date at 00:00. */
function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** UTC Date → "YYYY-MM-DD". */
function fmtDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Calendar days added (can be negative), staying in UTC. */
function addDays(s: string, n: number): string {
  const d = parseDay(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtDay(d);
}

/** Mon–Fri test (UTC weekday; 0 = Sun, 6 = Sat). */
function isWorkingDay(s: string): boolean {
  const wd = parseDay(s).getUTCDay();
  return wd >= 1 && wd <= 5;
}

/** First working day on or after `s` (returns `s` itself if it's a weekday). */
function nextWorkingDay(s: string): string {
  let cur = s;
  while (!isWorkingDay(cur)) cur = addDays(cur, 1);
  return cur;
}

/** Lexical max of two "YYYY-MM-DD" days (works because ISO sorts chronologically). */
function maxDay(a: string, b: string): string {
  return a >= b ? a : b;
}

/** "Yesterday" (T-1) in UTC — the latest day the endpoint can have data for. */
export function yesterday(now: Date): string {
  return addDays(fmtDay(now), -1);
}

// ---------------------------------------------------------------------------
// Window planning — given a publish date + "now", what span do we request?
// ---------------------------------------------------------------------------

export interface UsageWindowPlan {
  /** Whether a window exists at all (false when launch is in the future, etc.). */
  ok: boolean;
  /** First working day of the launch window (≥ DATA_START). */
  from: string;
  /** Last ELAPSED working day to request (≤ yesterday). */
  to: string;
  /** The full set of target working days (length = target, may run past `to`). */
  targetDays: string[];
  /** Subset of `targetDays` that have elapsed (≤ yesterday) — the divisor set. */
  elapsedDays: string[];
  /** Launch predated DATA_START so the window start was shifted forward. */
  shifted: boolean;
}

/**
 * Plan the launch window for one model. The window is the first
 * LAUNCH_WINDOW_WORKING_DAYS working days on or after max(publishTime,
 * DATA_START); we only request/average the portion that has elapsed (≤
 * yesterday). Returns ok=false when there's nothing measurable yet.
 */
export function planUsageWindow(
  publishTime: string,
  now: Date,
  target = LAUNCH_WINDOW_WORKING_DAYS,
): UsageWindowPlan {
  const yest = yesterday(now);
  const shifted = publishTime < DATA_START;
  const start = nextWorkingDay(maxDay(publishTime, DATA_START));

  // Enumerate the target working days from the (possibly shifted) start.
  const targetDays: string[] = [];
  let cur = start;
  while (targetDays.length < target) {
    if (isWorkingDay(cur)) targetDays.push(cur);
    cur = addDays(cur, 1);
  }

  const elapsedDays = targetDays.filter((d) => d <= yest);
  if (elapsedDays.length === 0) {
    return { ok: false, from: start, to: start, targetDays, elapsedDays, shifted };
  }
  return {
    ok: true,
    from: elapsedDays[0],
    to: elapsedDays[elapsedDays.length - 1],
    targetDays,
    elapsedDays,
    shifted,
  };
}

// ---------------------------------------------------------------------------
// Fetch — one authenticated request per model, with rate-limit-aware retry
// ---------------------------------------------------------------------------

interface UsageEnvelope {
  success?: boolean;
  data?: {
    model?: string;
    value?: number;
    series?: { date?: string; value?: number }[];
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Self-contained backoff for the plain-fetch management endpoint (the shared
 *  withRetry only understands Anthropic.APIError). Retries 422 (rate limit) and
 *  5xx, honoring Retry-After; gives up after `maxRetries`. */
async function fetchWithRetry(
  url: string,
  key: string,
  opts: {
    maxRetries?: number;
    baseMs?: number;
    capMs?: number;
    next?: { revalidate?: number | false };
  } = {},
): Promise<Response> {
  const { maxRetries = 5, baseMs = 800, capMs = 30_000, next } = opts;
  let attempt = 0;
  for (;;) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${key}`,
        "User-Agent": UA,
        Accept: "application/json",
      },
      ...(next ? { next } : {}),
    });
    // 422 = rate limited; 5xx = transient server error → back off and retry.
    const retryable = res.status === 422 || (res.status >= 500 && res.status <= 599);
    if (!retryable || attempt >= maxRetries) return res;
    const retryAfter = Number(res.headers.get("retry-after"));
    const expo = Math.min(capMs, baseMs * 2 ** attempt);
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.floor(Math.random() * expo);
    await sleep(delay);
    attempt++;
  }
}

/**
 * Fetch one model's daily token series for the given inclusive span. Resolves to
 * an empty series (total 0) on any failure rather than throwing — a single
 * model's usage gap must never abort the whole page render / CLI run. Returns
 * null only when the management key is missing (caller skips the metric).
 */
export async function fetchModelUsage(
  slug: string,
  startingAt: string,
  endingAt: string,
  key: string,
  cache?: { revalidate?: number | false },
): Promise<ModelUsageSeries> {
  const qs = new URLSearchParams({
    model: slug,
    metric: "tokens",
    starting_at: startingAt,
    ending_at: endingAt,
  });
  const url = `${MODEL_USAGE_URL}?${qs.toString()}`;
  try {
    const res = await fetchWithRetry(url, key, { next: cache });
    if (!res.ok) return { slug, total: 0, series: [] };
    const json = (await res.json()) as UsageEnvelope;
    const raw = json?.data?.series ?? [];
    const series: DailyUsagePoint[] = raw
      .filter((p): p is { date: string; value: number } =>
        typeof p?.date === "string" && typeof p?.value === "number")
      .map((p) => ({ date: p.date, value: p.value }));
    const total = typeof json?.data?.value === "number"
      ? json.data!.value!
      : series.reduce((s, p) => s + p.value, 0);
    return { slug, total, series };
  } catch {
    return { slug, total: 0, series: [] };
  }
}

// ---------------------------------------------------------------------------
// Batch fetch — every model's launch-window series, bounded concurrency
// ---------------------------------------------------------------------------

export interface FetchAllUsageOptions {
  /** Max in-flight requests (keeps us under the per-minute rate limit). */
  concurrency?: number;
  /** Next.js Data Cache hint forwarded to each fetch (page uses { revalidate }). */
  cache?: { revalidate?: number | false };
  /** "now" used to bound each model's window (defaults to a fresh Date). */
  now?: Date;
  /** Progress callback (done, total) — the CLI logs against it. */
  onProgress?: (done: number, total: number) => void;
}

/**
 * Fetch the launch-window daily series for every model that has a publish date,
 * bounded to `concurrency` requests at a time. Each model is exactly one request
 * (its window spans ≤ ~19 calendar days). Models with no measurable window yet
 * (launched too recently) are skipped. Returns a slug→series map for compute().
 *
 * Requires the management key in the environment; returns an EMPTY map (so the
 * page still renders with all-time usage only) when the key is absent.
 */
export async function fetchAllUsage(
  models: { slug: string; publishTime: string | null }[],
  key: string | undefined,
  opts: FetchAllUsageOptions = {},
): Promise<Map<string, ModelUsageSeries>> {
  const out = new Map<string, ModelUsageSeries>();
  if (!key) return out;

  const now = opts.now ?? new Date();
  const concurrency = Math.max(1, opts.concurrency ?? 6);

  // Only models with a publish date AND an already-elapsed window are worth a call.
  const jobs = models
    .filter((m) => m.publishTime)
    .map((m) => ({ slug: m.slug, plan: planUsageWindow(m.publishTime!, now) }))
    .filter((j) => j.plan.ok);

  let done = 0;
  let cursor = 0;
  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= jobs.length) return;
      const { slug, plan } = jobs[i];
      const series = await fetchModelUsage(slug, plan.from, plan.to, key!, opts.cache);
      out.set(slug, series);
      opts.onProgress?.(++done, jobs.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return out;
}

// ---------------------------------------------------------------------------
// Derive the average-per-working-day metric from a series + plan
// ---------------------------------------------------------------------------

export interface AvgDailyResult {
  avgDailyTokens: number | null;
  window: AvgDailyWindow | null;
}

/**
 * Collapse a daily series into the launch-window average. Sums the series
 * values that fall on the window's ELAPSED working days, then divides by the
 * count of elapsed working days (a zero-usage working day counts in the divisor
 * — low demand is real signal, not missing data). Returns nulls when the window
 * hasn't opened yet or carried no usage at all.
 */
export function computeAvgDaily(
  publishTime: string | null,
  series: DailyUsagePoint[],
  now: Date,
  target = LAUNCH_WINDOW_WORKING_DAYS,
): AvgDailyResult {
  if (!publishTime) return { avgDailyTokens: null, window: null };
  const plan = planUsageWindow(publishTime, now, target);
  if (!plan.ok) return { avgDailyTokens: null, window: null };

  const byDate = new Map(series.map((p) => [p.date, p.value]));
  let sum = 0;
  let daysWithData = 0;
  for (const day of plan.elapsedDays) {
    const v = byDate.get(day);
    if (v != null && v > 0) {
      sum += v;
      daysWithData++;
    }
  }

  const divisor = plan.elapsedDays.length;
  const window: AvgDailyWindow = {
    from: plan.from,
    to: plan.to,
    targetWorkingDays: target,
    elapsedWorkingDays: divisor,
    workingDaysWithData: daysWithData,
    partial: divisor < target,
    shifted: plan.shifted,
  };
  // No usage at all in the window ⇒ a real zero (the model exists but went
  // unused), distinct from "window not open yet" above.
  return { avgDailyTokens: divisor > 0 ? sum / divisor : 0, window };
}
