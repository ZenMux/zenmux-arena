// ─────────────────────────────────────────────────────────────────────────────
// Analyze prompt-probe.jsonl: self / unknown / refused / cross-vendor rates,
// broken down by (model × variant) and (variant × language). Prints plain-text
// tables to stdout. Read-only; no API calls.
//
// Run: npx tsx research/scripts/prompt-probe-report.ts --in results/_prompt-probe/<stamp>/probe.jsonl
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import { parseArgs } from "../lib/args";

interface ProbeRow {
  modelId: string;
  modelLabel: string;
  trueVendor: string;
  variant: string;
  langCode: string;
  repeat: number;
  prompt: string;
  response: string;
  error?: string;
  claimedVendor: string;
  claimedModelText: string | null;
  confidence: number;
  isSelf: boolean;
}

type Bucket = "self" | "unknown" | "refused" | "cross"; // cross = named a DIFFERENT real vendor / other

function bucketOf(r: ProbeRow): Bucket {
  if (r.error) return "refused";
  if (r.claimedVendor === "unknown") return "unknown";
  if (r.claimedVendor === "refused") return "refused";
  if (r.isSelf) return "self";
  return "cross";
}

interface Tally {
  n: number;
  self: number;
  unknown: number;
  refused: number;
  cross: number;
}
const empty = (): Tally => ({ n: 0, self: 0, unknown: 0, refused: 0, cross: 0 });
function add(t: Tally, b: Bucket) {
  t.n++;
  t[b]++;
}
function pct(x: number, n: number): string {
  if (n === 0) return "  – ";
  return `${Math.round((100 * x) / n)
    .toString()
    .padStart(3)}%`;
}

function main() {
  const args = parseArgs();
  const inFile = args.get("in");
  if (!inFile || !fs.existsSync(inFile)) {
    console.error("pass --in <probe.jsonl>");
    process.exit(1);
  }
  const rows: ProbeRow[] = [];
  for (const line of fs.readFileSync(inFile, "utf8").split("\n")) {
    const t = line.trim();
    if (t) rows.push(JSON.parse(t) as ProbeRow);
  }

  const variants = [...new Set(rows.map((r) => r.variant))].sort();
  const models = [...new Set(rows.map((r) => r.modelId))];
  const langs = [...new Set(rows.map((r) => r.langCode))];

  // ── Per (model × variant): the headline. selfRate up + unknown/refused down = win.
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(" PER MODEL × VARIANT   (self% ↑ good · unknown%+refused% ↓ good)");
  console.log("══════════════════════════════════════════════════════════════════════");
  const labelOf = new Map(rows.map((r) => [r.modelId, r.modelLabel]));
  for (const m of models) {
    console.log(`\n● ${labelOf.get(m)}  [${m}]`);
    console.log(
      `   variant                         n   self  unkwn  refsd  cross`,
    );
    for (const v of variants) {
      const t = empty();
      for (const r of rows) if (r.modelId === m && r.variant === v) add(t, bucketOf(r));
      const vlabel = v.padEnd(4);
      console.log(
        `   ${vlabel}                          ${t.n.toString().padStart(3)}  ${pct(t.self, t.n)}  ${pct(
          t.unknown,
          t.n,
        )}  ${pct(t.refused, t.n)}  ${pct(t.cross, t.n)}`,
      );
    }
  }

  // ── Per variant overall (pooled across the probed models).
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(" POOLED OVER ALL PROBED MODELS — per variant");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`   variant   n    self  unkwn  refsd  cross`);
  for (const v of variants) {
    const t = empty();
    for (const r of rows) if (r.variant === v) add(t, bucketOf(r));
    console.log(
      `   ${v.padEnd(4)}     ${t.n.toString().padStart(3)}  ${pct(t.self, t.n)}  ${pct(t.unknown, t.n)}  ${pct(
        t.refused,
        t.n,
      )}  ${pct(t.cross, t.n)}`,
    );
  }

  // ── Per variant × language.
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(" PER VARIANT × LANGUAGE  (self% — higher is better)");
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`   variant  ${langs.map((l) => l.padStart(6)).join("")}`);
  for (const v of variants) {
    const cells = langs.map((l) => {
      const t = empty();
      for (const r of rows) if (r.variant === v && r.langCode === l) add(t, bucketOf(r));
      return pct(t.self, t.n).padStart(6);
    });
    console.log(`   ${v.padEnd(7)}${cells.join("")}`);
  }

  // ── Recovered cases: rows that were unknown/refused under V0 but became self/cross
  //    under V1 or V2 for the same model×lang×repeat.
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log(" SAMPLE: V0 unknown/refused vs what V1/V2 produced (same cell)");
  console.log("══════════════════════════════════════════════════════════════════════");
  const keyOf = (r: ProbeRow) => `${r.modelId}::${r.langCode}::${r.repeat}`;
  const byKeyVar = new Map<string, ProbeRow>();
  for (const r of rows) byKeyVar.set(`${keyOf(r)}::${r.variant}`, r);
  let shown = 0;
  for (const r of rows) {
    if (r.variant !== "V0") continue;
    const b = bucketOf(r);
    if (b !== "unknown" && b !== "refused") continue;
    const v1 = byKeyVar.get(`${keyOf(r)}::V1`);
    const v2 = byKeyVar.get(`${keyOf(r)}::V2`);
    if (shown++ < 14) {
      const fmt = (x?: ProbeRow) =>
        x ? `${bucketOf(x)}${x.claimedModelText ? `(${x.claimedModelText.slice(0, 28)})` : ""}` : "—";
      console.log(
        `   ${r.modelLabel}/${r.langCode}#${r.repeat}:  V0=${b}  →  V1=${fmt(v1)}  ·  V2=${fmt(v2)}`,
      );
    }
  }
  console.log("");
}

main();
