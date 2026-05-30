import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import type { GraphData } from "@research/lib/types";
import RelationshipGraph from "./RelationshipGraph";

export const metadata: Metadata = {
  title: "Who Are You? — Cross-Vendor Identity Confusion in Frontier LLMs",
  description:
    "A systematic study of how frontier LLMs answer 'Who are you?' across ten languages. By thinkthinking | ZenMux.ai.",
  openGraph: {
    title: "Who Are You? — Cross-Vendor Identity Confusion in Frontier LLMs",
    images: ["/research/graph.png"],
  },
};

function loadGraph(): GraphData | null {
  const p = path.join(process.cwd(), "public", "research", "aggregate.json");
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as GraphData;
  } catch {
    return null;
  }
}

function pct(x: number, d = 1): string {
  return `${(x * 100).toFixed(d)}%`;
}

export default function ResearchPage() {
  const graph = loadGraph();

  if (!graph) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-2xl font-bold">Who Are You?</h1>
        <p className="mt-4 text-neutral-500">
          No results yet. Run the study pipeline to generate{" "}
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
            public/research/aggregate.json
          </code>
          :
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-neutral-900 p-4 text-sm text-neutral-100">
          export ZENMUX_API_KEY=...{"\n"}pnpm study:all
        </pre>
      </main>
    );
  }

  const s = graph.summary;
  const confusionEdges = graph.edges
    .filter((e) => e.from !== e.to && !["self", "unknown", "refused"].includes(e.to))
    .slice(0, 8);

  const modelSelf = graph.models
    .map((m) => ({ label: m.label ?? m.id, rate: s.perModelSelfRate[m.id] ?? 0 }))
    .sort((a, b) => b.rate - a.rate);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      {/* Header */}
      <header className="mb-12 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">ZenMux Arena · Research</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{graph.study.title}</h1>
        {graph.study.description && (
          <p className="mx-auto mt-4 max-w-2xl text-neutral-500">{graph.study.description}</p>
        )}
        <div className="mt-6">
          <Link
            href="/research/studio"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            <SlidersHorizontal className="size-4" />
            Open graph studio
          </Link>
        </div>
      </header>

      {/* Headline stats */}
      <section className="mb-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Answers" value={String(s.totalAnswers)} />
        <Stat label="Self-ID rate" value={pct(s.overallSelfRate)} accent />
        <Stat label="Confusion rate" value={pct(s.confusionRate)} />
        <Stat label="Unknown / Refused" value={`${pct(s.unknownRate, 0)} / ${pct(s.refusedRate, 0)}`} />
      </section>

      {/* Graph */}
      <section className="mb-16 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-8 dark:border-neutral-800 dark:bg-neutral-950">
        <RelationshipGraph graph={graph} showVendorPicker />
      </section>

      {/* Tables */}
      <section className="mb-16 grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Self-identification by model</h2>
          <Table
            headers={["Model", "Self rate"]}
            rows={modelSelf.map((m) => [m.label, pct(m.rate)])}
          />
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Self-identification by language</h2>
          <Table
            headers={["Language", "Self rate"]}
            rows={graph.languages
              .map((l) => ({ name: l.name, rate: s.perLangSelfRate[l.code] ?? 0 }))
              .sort((a, b) => b.rate - a.rate)
              .map((l) => [l.name, pct(l.rate)])}
          />
        </div>
      </section>

      <section className="mb-16">
        <h2 className="mb-3 text-lg font-semibold">Top cross-vendor confusion</h2>
        {confusionEdges.length ? (
          <Table
            headers={["From (true)", "Claims to be", "Probability", "Count"]}
            rows={confusionEdges.map((e) => [
              vname(graph, e.from),
              vname(graph, e.to),
              pct(e.probability),
              `${e.count}/${e.total}`,
            ])}
          />
        ) : (
          <p className="text-neutral-500">No cross-vendor confusion above threshold.</p>
        )}
      </section>

      {/* Branding footer */}
      <footer className="mt-20 flex flex-col items-center gap-3 border-t border-neutral-200 pt-10 text-center dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <Image src="/maker-logo/ZenMux.png" alt="ZenMux" width={28} height={28} />
          <span className="text-sm text-neutral-600 dark:text-neutral-300">
            以上研究由{" "}
            <strong>thinkthinking</strong> |{" "}
            <a href="https://zenmux.ai" className="underline decoration-dotted underline-offset-4">
              ZenMux.ai
            </a>{" "}
            测试
          </span>
        </div>
        <p className="text-xs text-neutral-400">
          run {graph.runId} · generated {graph.generatedAt.slice(0, 19).replace("T", " ")}
        </p>
      </footer>
    </main>
  );
}

function vname(graph: GraphData, id: string): string {
  return graph.vendors.find((v) => v.id === id)?.name ?? id;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className={`text-2xl font-bold ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wide text-neutral-400">{label}</div>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
            {headers.map((h, i) => (
              <th
                key={h}
                className={`px-4 py-2 font-semibold text-neutral-600 dark:text-neutral-300 ${i === 0 ? "text-left" : "text-right"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
              {r.map((c, ci) => (
                <td
                  key={ci}
                  className={`px-4 py-2 ${ci === 0 ? "text-left font-medium" : "text-right tabular-nums text-neutral-600 dark:text-neutral-300"}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
