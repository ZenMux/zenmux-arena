// JSONL persistence + resumability helpers.

import fs from "node:fs";
import path from "node:path";
import type { ExtractionResult, RawRecord } from "./types";

export const RESULTS_ROOT = path.join(process.cwd(), "results");

export interface RunPaths {
  /** Composite id: "<studyId>/<stamp>". */
  runId: string;
  studyId: string;
  /** Timestamp subdirectory name. */
  stamp: string;
  dir: string;
  records: string;
  extractions: string;
  aggregate: string;
  report: string;
}

/** A run lives at results/<studyId>/<stamp>/. */
export function runPaths(studyId: string, stamp: string): RunPaths {
  const dir = path.join(RESULTS_ROOT, studyId, stamp);
  fs.mkdirSync(dir, { recursive: true });
  return {
    runId: `${studyId}/${stamp}`,
    studyId,
    stamp,
    dir,
    records: path.join(dir, "records.jsonl"),
    extractions: path.join(dir, "extractions.jsonl"),
    aggregate: path.join(dir, "aggregate.json"),
    report: path.join(dir, "report.md"),
  };
}

/** A UTC timestamp suitable for a run subdir name, e.g. "20260529T045756". */
export function newStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "").slice(0, 15);
}

/** List existing run stamps for a study, newest last (lexicographic = chronological). */
export function listStamps(studyId: string): string[] {
  const base = path.join(RESULTS_ROOT, studyId);
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

/** The most recent run stamp for a study, or null if none exist. */
export function latestStamp(studyId: string): string | null {
  const stamps = listStamps(studyId);
  return stamps.length ? stamps[stamps.length - 1] : null;
}

/**
 * Resolve a downstream run dir from a `--run` argument:
 *  - undefined / "latest" → the most recent existing run for the study
 *  - "<stamp>"            → that specific run
 * Returns null if nothing matches. Does not create the directory unless it resolves.
 */
export function resolveRun(studyId: string, runArg: string | undefined): RunPaths | null {
  let stamp: string | null;
  if (!runArg || runArg === "latest") {
    stamp = latestStamp(studyId);
  } else {
    stamp = listStamps(studyId).includes(runArg) ? runArg : null;
  }
  if (!stamp) return null;
  return runPaths(studyId, stamp);
}

/** Append one object as a JSON line. Single-writer, line-buffered: append is atomic enough. */
export function appendJsonl(file: string, obj: unknown): void {
  fs.appendFileSync(file, JSON.stringify(obj) + "\n");
}

/** Load and parse a JSONL file, skipping blank/unparseable lines (e.g. a torn final line). */
export function loadJsonl<T>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  const out: T[] = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as T);
    } catch {
      // Skip a torn/corrupt line (can happen if a previous run crashed mid-write).
    }
  }
  return out;
}

/**
 * De-duplicate records by key, last-write-wins (a rerun may have re-attempted a key).
 */
export function dedupeByKey<T extends { key: string }>(items: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const it of items) m.set(it.key, it);
  return m;
}

export interface CompactResult {
  /** Distinct keys kept (one record each). */
  kept: number;
  /** Rows physically removed (duplicates / superseded errors). */
  removed: number;
}

/**
 * Rewrite a records JSONL so each key keeps exactly ONE record, dropping stale
 * duplicates — in particular an errored attempt that was later resolved by a
 * successful retry. Without this, the append-only log keeps every failed 429 row
 * forever even after the key succeeded.
 *
 * Dedup priority (NOT plain last-write-wins): a SUCCESS always beats a non-success
 * for the same key regardless of order; among records of the same success-status the
 * later (freshest) one wins. First-seen key order is preserved so the file stays
 * stable/diffable. The rewrite is atomic (temp file + rename) so a crash can't leave
 * a half-written file. Returns kept/removed counts. No-op (and no rewrite) if the file
 * is missing or already has no duplicates.
 */
export function compactRecords(file: string): CompactResult {
  if (!fs.existsSync(file)) return { kept: 0, removed: 0 };
  const records = loadJsonl<RawRecord>(file);

  const best = new Map<string, RawRecord>();
  const order: string[] = [];
  for (const r of records) {
    const prev = best.get(r.key);
    if (!prev) {
      best.set(r.key, r);
      order.push(r.key);
      continue;
    }
    // A success supersedes a non-success; otherwise the newer record wins (it is
    // later in the file). Equivalent: replace unless the incumbent is the only success.
    if (isSuccess(prev) && !isSuccess(r)) continue;
    best.set(r.key, r);
  }

  const removed = records.length - order.length;
  if (removed <= 0) return { kept: order.length, removed: 0 };

  const body = order.map((k) => JSON.stringify(best.get(k)!)).join("\n") + "\n";
  const tmp = `${file}.compact.${process.pid}.tmp`;
  fs.writeFileSync(tmp, body);
  fs.renameSync(tmp, file); // atomic on the same filesystem
  return { kept: order.length, removed };
}

/**
 * The single definition of a "successful" answer record, shared by the round-loop
 * skip-set (`completedAnswerKeys`) and the completeness gate (`checkCompleteness`).
 * A record is a success iff it has a non-empty response and no `error` field set.
 * (`ask` now also flags an empty 200 as an error, so the two conditions agree.)
 */
export function isSuccess(r: RawRecord): boolean {
  return !r.error && !!r.response;
}

/**
 * Keys considered "done" for the ask pass: a key is done if it has AT LEAST ONE
 * successful record (any-success, not last-write-wins). A later errored re-attempt
 * for an already-succeeded key must NOT un-complete it — otherwise the round loop
 * and the completeness gate could disagree and deadlock (loop skips a key the gate
 * still rejects). `checkCompleteness` classifies keys the same way.
 */
export function completedAnswerKeys(records: RawRecord[]): Set<string> {
  const set = new Set<string>();
  for (const r of records) if (isSuccess(r)) set.add(r.key);
  return set;
}

/** Keys considered "extracted": an extraction exists with no parseError. */
export function completedExtractionKeys(extractions: ExtractionResult[]): Set<string> {
  const set = new Set<string>();
  for (const e of extractions) if (!e.parseError) set.add(e.key);
  return set;
}

export interface Completeness {
  complete: boolean;
  expected: number;
  ok: number;
  /** Keys with no record at all (never attempted). */
  missing: string[];
  /** Keys that have a record but it errored / has empty response. */
  errored: string[];
}

/**
 * Check that every expected key has at least one successful record.
 * `expectedKeys` is the full model×lang×repeat key set from enumerateTasks.
 *
 * Classification is any-success (matching `completedAnswerKeys`), NOT last-write-wins:
 *   - `missing`  — the key has no record at all (never attempted).
 *   - `errored`  — the key has record(s), but none succeeded (all errored / empty).
 *   - `ok`       — the key has ≥1 successful record (a later errored retry can't undo this).
 * This guarantees the gate and the round-loop skip-set always agree, so an errored
 * 429 that later succeeded reads as `ok`, and one that never succeeds reads as `errored`
 * and IS retried — never silently treated as done.
 */
export function checkCompleteness(expectedKeys: string[], records: RawRecord[]): Completeness {
  const succeeded = completedAnswerKeys(records);
  const seen = new Set<string>();
  for (const r of records) seen.add(r.key);

  const missing: string[] = [];
  const errored: string[] = [];
  let ok = 0;
  for (const key of expectedKeys) {
    if (succeeded.has(key)) ok++;
    else if (seen.has(key)) errored.push(key);
    else missing.push(key);
  }
  return { complete: missing.length === 0 && errored.length === 0, expected: expectedKeys.length, ok, missing, errored };
}
