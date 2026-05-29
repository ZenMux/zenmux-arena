// Concurrency limiting + retry-with-backoff for API calls.

import Anthropic from "@anthropic-ai/sdk";
import pLimit from "p-limit";

export type Limiter = ReturnType<typeof pLimit>;

export function makeLimiter(concurrency: number): Limiter {
  return pLimit(concurrency);
}

const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

/** Decide whether an error is worth retrying (transient) vs fatal (bad request/auth). */
function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    // No status => connection/timeout error (APIConnectionError) => retry.
    if (typeof err.status !== "number") return true;
    return RETRYABLE_STATUS.has(err.status);
  }
  // Unknown/network-ish errors: retry.
  return true;
}

/** Pull a Retry-After header (seconds) off an APIError, if present. */
function retryAfterMs(err: unknown): number | null {
  if (err instanceof Anthropic.APIError && err.headers) {
    const raw =
      typeof (err.headers as Headers).get === "function"
        ? (err.headers as Headers).get("retry-after")
        : (err.headers as Record<string, string>)["retry-after"];
    if (raw) {
      const secs = Number(raw);
      if (Number.isFinite(secs)) return secs * 1000;
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface RetryOptions {
  maxRetries: number;
  baseMs?: number;
  capMs?: number;
  /** Deterministic 0..1 source for jitter (defaults to Math.random). */
  rng?: () => number;
  /** Called before each retry sleep, for logging. */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
}

/**
 * Run `fn`, retrying transient failures with exponential backoff + full jitter.
 * Honors a Retry-After header when present. Throws the last error after `maxRetries`.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const { maxRetries, baseMs = 500, capMs = 30_000, rng = Math.random, onRetry } = opts;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxRetries || !isRetryable(err)) throw err;
      const exp = Math.min(capMs, baseMs * 2 ** attempt);
      const delay = retryAfterMs(err) ?? Math.floor(rng() * exp);
      onRetry?.({ attempt: attempt + 1, delayMs: delay, error: err });
      await sleep(delay);
      attempt++;
    }
  }
}

/**
 * Run `items` through `worker` in sequential batches of `size` (size in flight at a
 * time; one batch finishes before the next starts). Returns results in input order.
 */
export async function runBatched<T, R>(
  items: T[],
  size: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const results = await Promise.all(batch.map((it, j) => worker(it, i + j)));
    out.push(...results);
  }
  return out;
}

/** A short, human-readable description of an error for logging/records. */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.APIError) {
    const status = typeof err.status === "number" ? err.status : "conn";
    return `APIError ${status}: ${err.message}`;
  }
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}
