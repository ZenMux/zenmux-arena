// Studio — an interactive workbench for the identity-confusion graph.
//
// Server component: discovers every results/<study>/<stamp>/aggregate.json,
// loads the selected one, and hands the (JSON-serializable) GraphData plus the
// run list to the client. force-dynamic so freshly-generated runs appear on
// reload without a rebuild.

import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import type { GraphData } from "@research/lib/types";
import StudioClient, { type RunRef } from "./StudioClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Graph Studio — Who Are You?",
  description: "Interactive workbench for the cross-vendor identity-confusion graph.",
};

const RESULTS_DIR = path.join(process.cwd(), "results");

/** All runs that have an aggregate.json, newest stamp first. */
function discoverRuns(): RunRef[] {
  if (!fs.existsSync(RESULTS_DIR)) return [];
  const out: RunRef[] = [];
  for (const study of fs.readdirSync(RESULTS_DIR)) {
    const studyDir = path.join(RESULTS_DIR, study);
    if (!fs.statSync(studyDir).isDirectory()) continue;
    for (const stamp of fs.readdirSync(studyDir)) {
      const aggregate = path.join(studyDir, stamp, "aggregate.json");
      if (fs.existsSync(aggregate)) out.push({ id: `${study}/${stamp}`, study, stamp });
    }
  }
  // Stamps are sortable timestamps (e.g. 20260529T070756) → reverse-lexical = newest first.
  return out.sort((a, b) => b.stamp.localeCompare(a.stamp));
}

function loadGraph(runId: string): GraphData | null {
  const file = path.join(RESULTS_DIR, runId, "aggregate.json");
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as GraphData;
  } catch {
    return null;
  }
}

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const runs = discoverRuns();

  if (runs.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-2xl font-bold">Graph Studio</h1>
        <p className="mt-4 text-muted-foreground">
          No runs found. Generate one with the study pipeline, then reload:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-neutral-900 p-4 text-sm text-neutral-100">
          export ZENMUX_API_KEY=...{"\n"}pnpm study:test
        </pre>
      </div>
    );
  }

  const selected = runs.find((r) => r.id === run)?.id ?? runs[0].id;
  const graph = loadGraph(selected);

  if (!graph) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-2xl font-bold">Graph Studio</h1>
        <p className="mt-4 text-destructive">Could not read aggregate.json for {selected}.</p>
      </div>
    );
  }

  // key={selected} remounts the client when the user switches runs, so the
  // lazily-seeded default-hidden set (and other per-run edit state) re-initializes
  // against the new run's vendor list instead of carrying the previous run's over.
  return <StudioClient key={selected} runs={runs} selectedRun={selected} graph={graph} />;
}
