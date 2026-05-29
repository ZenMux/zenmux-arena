// Generate an arxiv-style Markdown report from GraphData.

import type { GraphData, VendorId } from "./types";
import { VENDORS } from "./vendors";

const PSEUDO: VendorId[] = ["self", "unknown", "refused", "other"];

function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

/**
 * Display name lookup. Dynamic `other:<slug>` brands aren't in the static
 * VENDORS table — fall back to the materialized graph.vendors list, then to
 * the raw id as a last resort.
 */
function makeVName(graph: GraphData): (id: VendorId) => string {
  const byId = new Map(graph.vendors.map((v) => [v.id, v.name]));
  return (id: VendorId) => VENDORS[id]?.name ?? byId.get(id) ?? String(id);
}

/** A clean three-line (booktabs-feel) GitHub table. */
function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map((_, i) => (i === 0 ? "---" : "---:")).join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}`;
}

export function buildReport(graph: GraphData): string {
  const s = graph.summary;
  const date = graph.generatedAt.slice(0, 10);
  const vName = makeVName(graph);

  // Top confusion edge for the abstract.
  const confusionEdges = graph.edges.filter((e) => !PSEUDO.includes(e.to) && e.from !== e.to);
  const top = confusionEdges[0];
  const topStr = top
    ? `${vName(top.from)} → ${vName(top.to)} (${pct(top.probability)})`
    : "none above threshold";

  const realVendorsUnderTest = [...new Set(graph.models.map((m) => m.vendor))];

  const L: string[] = [];

  // ---- Title block ----
  L.push(`# ${graph.study.title}`);
  L.push("");
  L.push(`**thinkthinking**, ZenMux.ai`);
  L.push("");
  L.push(`*${date}*`);
  L.push("");

  // ---- Abstract ----
  L.push("## Abstract");
  L.push("");
  L.push(
    `Frontier large language models increasingly inherit one another's outputs through ` +
      `shared training data, distillation, and synthetic corpora. A visible symptom is ` +
      `*identity confusion*: a model, asked who it is, names a competitor. We study this ` +
      `phenomenon systematically. We prompt ${graph.models.length} models from ` +
      `${realVendorsUnderTest.length} vendors with the single question "Who are you?", ` +
      `translated into ${graph.languages.length} languages and repeated ` +
      `${repeatsOf(graph)} times per language, all via the ZenMux Anthropic Messages API. ` +
      `Each of the ${s.totalAnswers} answers is annotated by an independent extractor LLM ` +
      `that maps the response ` +
      `to the vendor it *claims* to be. Across the corpus, ${pct(s.overallSelfRate)} of answers ` +
      `correctly self-identify, while ${pct(s.confusionRate)} claim a different vendor ` +
      `(${pct(s.unknownRate)} give no identifiable vendor; ${pct(s.refusedRate)} refuse). ` +
      `The strongest cross-vendor confusion is ${topStr}. We release the raw transcripts, ` +
      `extraction labels, and a relationship graph of who-claims-to-be-whom.`,
  );
  L.push("");

  // ---- 1 Introduction ----
  L.push("## 1. Introduction");
  L.push("");
  L.push(
    `Every few weeks a vendor announces "the world's most powerful model." A widely shared ` +
      `meme arranges these announcements in a circle, each company pointing at the next. The ` +
      `joke has an empirical core: because models are trained on the open web and on one ` +
      `another's generations, a model's sense of self can drift toward whichever assistant ` +
      `dominated its training data. When you ask "Who are you?", the answer is a small but ` +
      `revealing probe of that drift.`,
  );
  L.push("");
  L.push(
    `We turn the meme into a measurement. Holding the question fixed and varying only the ` +
      `language, we quantify how often each model identifies as itself versus as a competitor, ` +
      `and we map the resulting "points-to" relation as a directed graph.`,
  );
  L.push("");

  // ---- 2 Methodology ----
  L.push("## 2. Methodology");
  L.push("");
  L.push("### 2.1 Models");
  L.push("");
  L.push(
    table(
      ["Model", "ZenMux id", "True vendor"],
      graph.models.map((m) => [m.label ?? m.id, `\`${m.id}\``, vName(m.vendor)]),
    ),
  );
  L.push("");
  L.push("### 2.2 Languages and stimulus");
  L.push("");
  L.push(
    `The stimulus is the question "Who are you?" hardcoded in each language (no machine ` +
      `translation, to keep the probe deterministic):`,
  );
  L.push("");
  L.push(
    table(
      ["Language", "Code", "Prompt"],
      graph.languages.map((l) => [l.name, `\`${l.code}\``, l.prompt]),
    ),
  );
  L.push("");
  L.push("### 2.3 Procedure");
  L.push("");
  L.push(
    `Each model is queried ${repeatsOf(graph)} times per language through the ZenMux ` +
      `Anthropic Messages endpoint, with a single user turn and no system prompt. Every raw ` +
      `answer is stored with its API generation id, timestamp, and token usage. A separate ` +
      `extractor model then reads each answer and emits a JSON label identifying the *claimed* ` +
      `vendor, drawn from a closed canonical taxonomy, or one of two buckets: \`unknown\` (an ` +
      `answer with no identifiable vendor) and \`refused\`. We derive **self-identification** ` +
      `post hoc by comparing the claimed vendor with the model's ground-truth vendor.`,
  );
  L.push("");
  L.push("### 2.4 Metrics");
  L.push("");
  L.push(
    `- **Self rate**: fraction of answers whose claimed vendor equals the model's true vendor.\n` +
      `- **Confusion rate**: fraction claiming a *different* real vendor.\n` +
      `- **Unknown / Refused rate**: generic-assistant answers / refusals.\n` +
      `- **Edge probability** \`P(A→B)\`: among answers from vendor A, the fraction claiming vendor B.`,
  );
  L.push("");

  // ---- 3 Results ----
  L.push("## 3. Results");
  L.push("");
  L.push("### 3.1 Headline");
  L.push("");
  L.push(
    table(
      ["Metric", "Value"],
      [
        ["Total answers analysed", String(s.totalAnswers)],
        ["Overall self-identification rate", pct(s.overallSelfRate)],
        ["Cross-vendor confusion rate", pct(s.confusionRate)],
        ["Unknown (generic assistant)", pct(s.unknownRate)],
        ["Refused", pct(s.refusedRate)],
        ["Errored API calls", String(s.errorCount)],
      ],
    ),
  );
  L.push("");

  L.push("### 3.2 Self-identification by model");
  L.push("");
  L.push(
    table(
      ["Model", "Self rate"],
      graph.models
        .map((m): [string, number] => [m.label ?? m.id, s.perModelSelfRate[m.id] ?? 0])
        .sort((a, b) => b[1] - a[1])
        .map(([label, rate]) => [label, pct(rate)]),
    ),
  );
  L.push("");

  L.push("### 3.3 Self-identification by language");
  L.push("");
  L.push(
    table(
      ["Language", "Self rate"],
      graph.languages
        .map((l): [string, number] => [l.name, s.perLangSelfRate[l.code] ?? 0])
        .sort((a, b) => b[1] - a[1])
        .map(([name, rate]) => [name, pct(rate)]),
    ),
  );
  L.push("");

  L.push("### 3.4 Top cross-vendor confusion edges");
  L.push("");
  if (confusionEdges.length) {
    L.push(
      table(
        ["From (true)", "Claims to be", "Probability", "Count"],
        confusionEdges
          .slice(0, 12)
          .map((e) => [vName(e.from), vName(e.to), pct(e.probability), `${e.count}/${e.total}`]),
      ),
    );
  } else {
    L.push("_No cross-vendor confusion above the reporting threshold._");
  }
  L.push("");

  L.push("### 3.5 Cross-vendor confusion by language");
  L.push("");
  L.push(
    `For each confusion edge, the per-language breakdown. An edge is drawn in the graph if ` +
      `*any* single language confuses A→B; the cell value is \`P(A→B | language)\` = among ` +
      `vendor A's answers in that language, the fraction claiming vendor B (with raw count).`,
  );
  L.push("");
  if (confusionEdges.length) {
    const langCols = graph.languages;
    const headers = ["Edge", ...langCols.map((l) => l.name)];
    const rows = confusionEdges.map((e) => {
      const cells = langCols.map((l) => {
        const b = e.byLang?.[l.code];
        if (!b || b.total === 0 || b.count === 0) return "·";
        return `${pct(b.count / b.total, 0)} (${b.count}/${b.total})`;
      });
      return [`${vName(e.from)} → ${vName(e.to)}`, ...cells];
    });
    L.push(table(headers, rows));
  } else {
    L.push("_No cross-vendor confusion above the reporting threshold._");
  }
  L.push("");

  L.push("### 3.6 Cross-vendor confusion by model");
  L.push("");
  L.push(
    `The same confusion edges, broken down by the specific model under test. \`P(A→B | model)\` ` +
      `= among that model's answers, the fraction claiming vendor B (with raw count).`,
  );
  L.push("");
  if (confusionEdges.length) {
    const rows: string[][] = [];
    for (const e of confusionEdges) {
      const byModel = e.byModel ?? {};
      const modelIds = Object.keys(byModel).sort((a, b) => {
        const ra = byModel[a].total ? byModel[a].count / byModel[a].total : 0;
        const rb = byModel[b].total ? byModel[b].count / byModel[b].total : 0;
        return rb - ra;
      });
      for (const mid of modelIds) {
        const b = byModel[mid];
        if (!b || b.count === 0) continue;
        const label = graph.models.find((m) => m.id === mid)?.label ?? mid;
        rows.push([
          `${vName(e.from)} → ${vName(e.to)}`,
          label,
          b.total ? pct(b.count / b.total) : "—",
          `${b.count}/${b.total}`,
        ]);
      }
    }
    if (rows.length) {
      L.push(table(["Edge", "Model", "Probability", "Count"], rows));
    } else {
      L.push("_No model-level confusion to report._");
    }
  } else {
    L.push("_No cross-vendor confusion above the reporting threshold._");
  }
  L.push("");

  L.push("### 3.7 Confusion matrix");
  L.push("");
  L.push("Rows are the true vendor; columns are the claimed vendor (`self` = correct). Cells are probabilities.");
  L.push("");
  L.push(confusionMatrix(graph, vName));
  L.push("");

  L.push("### 3.8 Relationship graph");
  L.push("");
  L.push(`![Who-claims-to-be-whom relationship graph](./graph.png)`);
  L.push("");

  // ---- LaTeX appendix table ----
  L.push("### 3.9 LaTeX (booktabs) — per-model self rate");
  L.push("");
  L.push("```latex");
  L.push("\\begin{table}[t]");
  L.push("\\centering");
  L.push("\\begin{tabular}{lr}");
  L.push("\\toprule");
  L.push("Model & Self rate (\\%) \\\\");
  L.push("\\midrule");
  for (const m of graph.models) {
    const rate = (s.perModelSelfRate[m.id] ?? 0) * 100;
    L.push(`${latexEsc(m.label ?? m.id)} & ${rate.toFixed(1)} \\\\`);
  }
  L.push("\\bottomrule");
  L.push("\\end{tabular}");
  L.push("\\caption{Self-identification rate by model.}");
  L.push("\\end{table}");
  L.push("```");
  L.push("");

  // ---- 4 Discussion ----
  L.push("## 4. Discussion");
  L.push("");
  L.push(
    `Self-identification is far from guaranteed. The dominant failure mode is contamination ` +
      `toward whichever assistant identity is most prevalent on the open web. Language matters: ` +
      `the per-language self rates above show that the same model can be markedly more or less ` +
      `confused depending on the language of the question, consistent with training-mix ` +
      `imbalances across languages.`,
  );
  L.push("");
  L.push("**Limitations.** ");
  L.push(
    `(i) The extractor is itself an LLM and can mislabel ambiguous answers; we mitigate with a ` +
      `constrained taxonomy and robust JSON parsing, and we release raw transcripts for audit. ` +
      `(ii) Single-turn, system-prompt-free queries are a lower bound; production deployments ` +
      `usually inject an identity via system prompt. (iii) Results are a snapshot of specific ` +
      `model snapshots accessed through ZenMux on ${date}. (iv) The brevity of "Who are you?" ` +
      `invites terse, generic answers that land in \`unknown\`.`,
  );
  L.push("");

  // ---- 5 Conclusion ----
  L.push("## 5. Conclusion");
  L.push("");
  L.push(
    `Asked the simplest possible question about themselves, frontier models disagree with the ` +
      `truth ${pct(1 - s.overallSelfRate)} of the time. Identity confusion is measurable, ` +
      `language-dependent, and directional. The accompanying graph makes the meme literal: a ` +
      `ring of vendors, each occasionally insisting it is another.`,
  );
  L.push("");

  // ---- Reproducibility ----
  L.push("## Reproducibility");
  L.push("");
  L.push(
    `Run id \`${graph.runId}\`. Raw answers (\`records.jsonl\`), extraction labels ` +
      `(\`extractions.jsonl\`), and aggregated data (\`aggregate.json\`) accompany this report. ` +
      `Re-run with \`pnpm study:all\`.`,
  );
  L.push("");
  L.push("---");
  L.push("");
  L.push(`以上研究由 **thinkthinking** | **ZenMux.ai** 测试`);
  L.push("");

  return L.join("\n");
}

function confusionMatrix(graph: GraphData, vName: (id: VendorId) => string): string {
  // True vendors = vendors of models under test.
  const fromVendors = [...new Set(graph.models.map((m) => m.vendor))];
  // Columns: self + real claimed vendors that appear + unknown/refused.
  const realTo = new Set<VendorId>();
  for (const e of graph.edges) if (!PSEUDO.includes(e.to)) realTo.add(e.to);
  const cols: VendorId[] = ["self", ...realTo, "unknown", "refused"];
  // Dedup cols preserving order.
  const seen = new Set<VendorId>();
  const orderedCols = cols.filter((c) => (seen.has(c) ? false : (seen.add(c), true)));

  // Build lookup: from -> to -> probability.
  const lookup = new Map<string, number>();
  for (const e of graph.edges) lookup.set(`${e.from}|${e.to}`, e.probability);

  const headers = ["True \\\\ Claims", ...orderedCols.map((c) => (c === "self" ? "self" : vName(c)))];
  const rows = fromVendors.map((from) => {
    const cells = orderedCols.map((to) => {
      const p = lookup.get(`${from}|${to}`) ?? 0;
      return p > 0 ? pct(p, 0) : "·";
    });
    return [vName(from), ...cells];
  });
  return table(headers, rows);
}

function repeatsOf(graph: GraphData): number {
  // Infer repeats from the max cell n (robust if some calls errored).
  return graph.cells.reduce((mx, c) => Math.max(mx, c.n), 0) || 0;
}

function latexEsc(s: string): string {
  return s.replace(/([&%$#_{}])/g, "\\$1");
}
