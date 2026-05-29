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
  graphSvg: string;
  graphPng: string;
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
    graphSvg: path.join(dir, "graph.svg"),
    graphPng: path.join(dir, "graph.png"),
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

/**
 * Keys considered "done" for the ask pass: a record exists with a non-empty response.
 * With `retryErrors=true`, errored keys (no response) become eligible again.
 */
export function completedAnswerKeys(records: RawRecord[]): Set<string> {
  const set = new Set<string>();
  for (const r of records) if (r.response && !r.error) set.add(r.key);
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
 * Check that every expected key has a successful record (non-empty response, no error).
 * `expectedKeys` is the full model×lang×repeat key set from enumerateTasks.
 */
export function checkCompleteness(expectedKeys: string[], records: RawRecord[]): Completeness {
  const byKey = dedupeByKey(records);
  const missing: string[] = [];
  const errored: string[] = [];
  let ok = 0;
  for (const key of expectedKeys) {
    const r = byKey.get(key);
    if (!r) missing.push(key);
    else if (r.error || !r.response) errored.push(key);
    else ok++;
  }
  return { complete: missing.length === 0 && errored.length === 0, expected: expectedKeys.length, ok, missing, errored };
}
