import "server-only";
import { cache } from "react";
import type { GraphData, MixManifest, ModelLangCell, ModelSpec } from "@research/lib/types";
// Explicit imports keep this immutable snapshot traceable in standalone builds.
// Never use `latest`: newer research must not silently rewrite the article's talk.
import aggregate from "../../../../results/who-are-you/mix-20260601T062425/aggregate.json";
import mix from "../../../../results/who-are-you/mix-20260601T062425/mix.json";
import bareA from "../../../../results/who-are-you/20260530T175319/aggregate.json";
import bareB from "../../../../results/who-are-you/20260601T012758/aggregate.json";
import bareC from "../../../../results/who-are-you/20260601T030822/aggregate.json";
import probedA from "../../../../results/who-are-you/20260531T175027/aggregate.json";
import probedB from "../../../../results/who-are-you/20260601T031851/aggregate.json";
import unbranded from "../../../../results/who-are-you/20260601T053656/aggregate.json";
import sample from "./evidence.json";
import type { IdentityCounts, IdentityEvidence, IdentityRow, IdentityTalkData, IdentityVariant, PromptFamily } from "./types";

const LANGUAGE_NAMES: Record<string, string> = { en: "英语", "zh-Hans": "简体中文", "zh-Hant": "繁体中文", ja: "日语", ko: "韩语", ru: "俄语", es: "西班牙语", fr: "法语", de: "德语", pt: "葡萄牙语" };
const empty = (): IdentityCounts => ({ n: 0, self: 0, cross: 0, refused: 0, unknown: 0 });

function countCells(cells: ModelLangCell[], models: ModelSpec[]): IdentityCounts {
  const vendors = new Map(models.map((m) => [m.id, m.vendor]));
  const counts = empty();
  for (const cell of cells) {
    counts.n += cell.n;
    for (const [claimed, probability] of Object.entries(cell.distribution)) {
      const key = claimed === "self" || claimed === vendors.get(cell.modelId) ? "self" : claimed === "refused" ? "refused" : claimed === "unknown" ? "unknown" : "cross";
      counts[key] += Math.round((probability ?? 0) * cell.n);
    }
  }
  if (counts.self + counts.cross + counts.refused + counts.unknown !== counts.n) throw new Error("Identity outcome counts do not reconcile.");
  return counts;
}

function languageCounts(cells: ModelLangCell[], graph: GraphData) {
  return Object.fromEntries(graph.languages.map((lang) => [lang.code, countCells(cells.filter((c) => c.langCode === lang.code), graph.models)]));
}

function modelLabel(model: ModelSpec) {
  const labels: Record<string, string> = { "openai/chat-latest:openai": "GPT-5.5 Instant", "tencent/hy3-preview:tencent-cloud": "Tencent Hy3 Preview", "z-ai/glm-5.1:bigmodel": "GLM 5.1" };
  return labels[model.id] ?? unbranded.models.find((m) => m.id === model.id)?.label ?? model.id;
}

function modelRows(cells: ModelLangCell[], graph: GraphData): IdentityRow[] {
  return graph.models.map((m) => {
    const selected = cells.filter((c) => c.modelId === m.id);
    return { id: m.id, label: modelLabel(m), vendor: m.vendor, counts: countCells(selected, graph.models), languages: languageCounts(selected, graph) };
  });
}

/** Synchronous, cached server loader; callers may also `await` it from an RSC. */
export const loadIdentityTalkData = cache(function loadIdentityTalkData(): IdentityTalkData {
  const graph = aggregate as unknown as GraphData;
  const manifest = mix as MixManifest;
  if (graph.runId !== "who-are-you/mix-20260601T062425" || graph.summary.totalAnswers !== 29700 || sample.runId !== graph.runId) throw new Error("Article-matched identity snapshot is unavailable or inconsistent.");
  const definitions: { id: PromptFamily; label: string; description: string; runs: GraphData[] }[] = [
    { id: "bare", label: "裸问", description: "只问一句：你是谁？", runs: [bareA, bareB, bareC] as unknown as GraphData[] },
    { id: "probed", label: "明确追问", description: "要求给出模型名与开发公司。", runs: [probedA, probedB] as unknown as GraphData[] },
    { id: "unbranded", label: "去品牌提问", description: "要求搁置产品包装，回答底层模型身份。", runs: [unbranded] as unknown as GraphData[] },
  ];
  const variants: IdentityVariant[] = definitions.map(({ id, label, description, runs }) => {
    for (const run of runs) {
      const source = manifest.sources.find((s) => s.run === run.runId);
      if (!source || source.answered !== run.summary.totalAnswers) throw new Error(`Source contribution mismatch: ${run.runId}`);
      for (const lang of run.languages) {
        if (lang.prompt !== runs[0].languages.find((l) => l.code === lang.code)?.prompt || !manifest.promptVariants[lang.code]?.includes(lang.prompt)) throw new Error(`Prompt family mismatch: ${run.runId}/${lang.code}`);
      }
    }
    const cells = runs.flatMap((r) => r.cells);
    const counts = countCells(cells, graph.models);
    return { id, label, description, sourceRuns: runs.map((r) => r.runId), prompts: Object.fromEntries(runs[0].languages.map((l) => [l.code, l.prompt])), repeatsPerModelLanguage: counts.n / graph.models.length / graph.languages.length, counts, languages: languageCounts(cells, graph), models: modelRows(cells, graph) };
  });
  const counts = countCells(graph.cells, graph.models);
  for (const key of ["n", "self", "cross", "refused", "unknown"] as const) {
    if (variants.reduce((n, v) => n + v.counts[key], 0) !== counts[key]) throw new Error(`Mixed source totals disagree: ${key}`);
  }
  const languages = languageCounts(graph.cells, graph);
  const models = modelRows(graph.cells, graph);
  const vendors = [...new Set(graph.models.map((m) => m.vendor))].map((id) => {
    const ids = new Set(graph.models.filter((m) => m.vendor === id).map((m) => m.id));
    const cells = graph.cells.filter((c) => ids.has(c.modelId));
    return { id, vendor: id, label: graph.vendors.find((v) => v.id === id)?.name ?? id, counts: countCells(cells, graph.models), languages: languageCounts(cells, graph) };
  });
  return {
    runId: graph.runId, generatedAt: graph.generatedAt, experimentalWindow: sample.experimentalWindow,
    // Model breakdowns already exist in `models`; retain language edges for the live graph.
    graph: { ...graph, vendors: graph.vendors.map((v) => ({ ...v, aliases: [] })), edges: graph.edges.map((e) => ({ from: e.from, to: e.to, count: e.count, total: e.total, probability: e.probability, byLang: e.byLang })) },
    counts, models, vendors, variants,
    languages: graph.languages.map((l) => ({ code: l.code, name: LANGUAGE_NAMES[l.code] ?? l.name, nativeName: l.name, counts: languages[l.code] })),
    evidence: sample.evidence as IdentityEvidence[],
    stableModelIds: models.filter((m) => m.counts.self === m.counts.n).map((m) => m.id),
    sources: manifest.sources.map((s) => ({ run: s.run, answered: s.answered, family: variants.find((v) => v.sourceRuns.includes(s.run))!.id })),
    methodology: {
      extractor: "GPT-5.5",
      snapshot: "2026 年 5—6 月，指定原厂 provider 的调用链路快照；身份自述不能证明训练来源或蒸馏关系。",
      languageCaveat: "去品牌组使用英文长指令 + 目标回答语言。分组分批采集，差异不等于提示词或语言的单独因果效应。",
      cacheCaveat: "Prompt / KV 缓存复用输入计算，不等于复用完整回答。若存在响应级缓存，重复答案可能影响独立性；本记录未验证其是否发生。",
    },
  };
});
