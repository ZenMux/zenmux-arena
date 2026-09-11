// Server-only by construction: this module reads pinned research artifacts via node:fs.
// Import MbtiTalkData from ./types in client code, never this module.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { OejtsInstrument, PersonalityAggregate } from "@research/personality/types";
import type { MbtiDimension, MbtiModel, MbtiTalkData } from "./types";

const DIMENSIONS: MbtiDimension[] = ["IE", "SN", "FT", "JP"];
// Asset aliases only; the model roster and every result come from the frozen aggregate.
const LOGOS: Record<string, string> = {
  openai: "chatgpt", anthropic: "claude", google: "gemini", deepseek: "deepeek",
  qwen: "qwen", bytedance: "doubao", "x-ai": "grok", "z-ai": "zai",
  moonshotai: "kimi", minimax: "minimax", baidu: "wenxin", tencent: "hunyuan",
  xiaomi: "xiaomi", stepfun: "stepfun", meituan: "longcat", inclusionai: "ling",
  meta: "meta", mistralai: "mistral",
};

/** No network, model SDK, environment variables, or mutable live configuration. */
export async function loadMbtiTalkData(): Promise<MbtiTalkData> {
  // Keep literal paths so Next's standalone file tracer can include the actual inputs.
  const [aggregateRaw, instrumentRaw, notesRaw] = await Promise.all([
    readFile(path.join(process.cwd(), "results/llm-mbti-oejts/20260911T040759/aggregate.json"), "utf8"),
    readFile(path.join(process.cwd(), "results/llm-mbti-oejts/20260911T040759/instrument.json"), "utf8"),
    readFile(path.join(process.cwd(), "results/llm-mbti-oejts/20260911T040759/RUN_NOTES.md"), "utf8"),
  ]);
  const aggregate = JSON.parse(aggregateRaw) as PersonalityAggregate;
  const source = JSON.parse(instrumentRaw) as OejtsInstrument;
  if (source.items.length !== 32 || aggregate.repeats !== 16 || !aggregate.models.length) {
    throw new Error("The MBTI talk requires the complete frozen OEJTS 1.2 run.");
  }
  // The run's original study.description claims manufacturer-operated providers.
  // Deliberately omit it; the later run notes supersede that claim.
  if (!["8192", "16384", "50000", "mistralai/mistral-large-2512:azure"].every((s) => notesRaw.includes(s))) {
    throw new Error("The MBTI talk run amendments are missing; do not show uniform-provider/budget claims.");
  }
  const instrument: OejtsInstrument = {
    instrument: source.instrument, author: source.author, source: source.source,
    license: source.license, responseScale: source.responseScale,
    items: source.items, scoring: source.scoring,
  };
  const models: MbtiModel[] = aggregate.models.map((model) => {
    if (model.n !== aggregate.repeats || model.administrations.length !== aggregate.repeats) {
      throw new Error(`Incomplete MBTI model: ${model.modelId}`);
    }
    return {
      id: model.modelId, name: model.label, provider: model.providerSlug,
      logo: `/model-logo/${LOGOS[model.manufacturer] ?? "zenmux"}_color.svg`,
      n: model.n, status: model.status, stableType: model.stableType,
      modalType: model.modalType, modalCount: model.modalCount, reasons: model.reasons,
      distribution: Object.entries(model.typeCounts)
        .sort(([a, n], [b, m]) => m - n || a.localeCompare(b))
        .map(([type, count]) => ({ type, count, illustration: `/mbti/${type.toLowerCase()}.svg` })),
      letterCounts: model.letterCounts, dimensions: model.dimensions,
      replicates: model.administrations.map((rep) => ({
        repeat: rep.repeat, type: rep.type,
        scores: Object.fromEntries(DIMENSIONS.map((d) => [d, rep.dimensions[d].score])) as Record<MbtiDimension, number>,
      })),
    };
  });
  const groups = new Map<string, string[]>();
  for (const model of models) {
    if (model.stableType) groups.set(model.stableType, [...(groups.get(model.stableType) ?? []), model.id]);
  }
  const failures = (model: MbtiModel) => DIMENSIONS.filter((d, index) =>
    model.modalType && (model.letterCounts[model.modalType[index]] ?? 0) < aggregate.classification.minLetterCount,
  );
  const stableCount = models.filter((m) => m.status === "stable").length;
  return {
    runId: aggregate.runId, generatedAt: aggregate.generatedAt, repeats: aggregate.repeats,
    classification: aggregate.classification, instrument, models,
    summary: {
      modelCount: models.length,
      questionnaireCount: models.reduce((sum, m) => sum + m.n, 0),
      stableCount, unstableCount: models.length - stableCount,
      unanimousCount: models.filter((m) => m.modalCount === m.n).length,
      stableGroups: [...groups].sort((a, b) => b[1].length - a[1].length).map(([type, modelIds]) => ({
        type, modelIds, count: modelIds.length, illustration: `/mbti/${type.toLowerCase()}.svg`,
      })),
      onlySnFailureCount: models.filter((m) => {
        const failed = failures(m);
        return m.status === "no_stable_type" && m.modalCount >= aggregate.classification.minModalCount
          && m.distribution.filter((t) => t.count === m.modalCount).length === 1
          && failed.length === 1 && failed[0] === "SN";
      }).length,
      dimensionFailures: DIMENSIONS.map((dimension) => ({
        dimension, count: models.filter((m) => failures(m).includes(dimension)).length,
      })),
    },
    // Editorial summaries of the pinned RUN_NOTES.md, checked above. These are
    // methodological context, never inferred from the original plan's defaults.
    runNotes: [
      { title: "三档输出上限", detail: "8192 → 16384 → 50000。保留首批 50 份有效问卷；Doubao 与 Azure Mistral 续跑使用 50000。上限含推理与可见输出，不等于实际用量。" },
      { title: "供应商例外", detail: "最终包含 Azure 托管的 Mistral Large 3；Agnes 与原厂 :mistral 失败路由已排除。不能将本批次描述为全部原厂供应商。" },
      { title: "续跑与传输修订", detail: "并发从 8×4 增至 16×8，等待上限为 10 分钟；后续 Responses 改为 SSE。提示与题库保持冻结，失败或未完成响应不计分。" },
    ],
  };
}
