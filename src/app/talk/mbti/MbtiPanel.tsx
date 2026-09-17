"use client";

import { useId, useState, type CSSProperties, type KeyboardEvent } from "react";
import Image from "next/image";
import { ArrowUpRight, Check, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { scoreAdministration } from "@research/personality/score";
import type { MbtiDimension, MbtiModel, MbtiTalkData, MbtiView } from "./types";
import s from "./mbti.module.css";

export type { MbtiTalkData, MbtiView } from "./types";

const DIMENSIONS: MbtiDimension[] = ["IE", "SN", "FT", "JP"];
const DIMENSION_NAMES: Record<MbtiDimension, string> = {
  IE: "内向 / 外向", SN: "实感 / 直觉", FT: "情感 / 思考", JP: "判断 / 感知",
};
const VIEW_LABELS: Record<MbtiView, string> = {
  method: "问卷与计分", overview: "研究总览", gallery: "全模型人格一览", explorer: "模型探索", stability: "稳定性判定", dimensions: "连续维度",
};
const percent = (n: number, total: number) => `${(100 * n / total).toFixed(1)}%`;
const exactPercent = (n: number, total: number) => `${Number((100 * n / total).toFixed(2))}%`;
const position = (score: number) => `${(score - 8) / 32 * 100}%`;
const typeTone = (type: string) => type[1] === "N" ? (type[2] === "T" ? "analyst" : "diplomat") : type[3] === "J" ? "sentinel" : "explorer";

function Logo({ model, size = 28 }: { model: MbtiModel; size?: number }) {
  return <Image src={model.logo} width={size} height={size} alt="" className={s.logo} unoptimized />;
}

function Status({ model }: { model: MbtiModel }) {
  return <Badge variant={model.status === "stable" ? "default" : "outline"}>
    {model.status === "stable" ? <><Check data-icon="inline-start" />稳定 {model.stableType}</> : "未观察到稳定类型"}
  </Badge>;
}

function Distribution({ model }: { model: MbtiModel }) {
  return <div className={s.distribution} aria-label="完整类型频数">
    {model.distribution.map((item) => <div key={item.type} className={s.distributionRow}>
      <span className={s.typeLabel} data-tone={typeTone(item.type)}>{item.type}</span>
      <div className={s.distributionTrack}><span data-tone={typeTone(item.type)} style={{ width: percent(item.count, model.n) }} /></div>
      <b>{item.count}<small> / {model.n}</small></b>
    </div>)}
  </div>;
}

/** Points = individual questionnaires; line = observed range; diamond = mean. */
function ScorePlot({ model, dimension, selectedRepeat, threshold }: {
  model: MbtiModel; dimension: MbtiDimension; selectedRepeat?: number; threshold: number;
}) {
  const stats = model.dimensions[dimension];
  const repeatedPositions = new Map<number, number>();
  const frequencies = new Map<number, number>();
  for (const rep of model.replicates) frequencies.set(rep.scores[dimension], (frequencies.get(rep.scores[dimension]) ?? 0) + 1);
  return <div className={s.scorePlot} role="img" aria-label={`${DIMENSION_NAMES[dimension]}，原始分数 ${stats.min} 至 ${stats.max}，均值 ${stats.mean.toFixed(2)}，分界 ${threshold}`}>
    <span className={s.plotThreshold} style={{ left: position(threshold) }} />
    <span className={s.plotRange} style={{ left: position(stats.min), width: `${(stats.max - stats.min) / 32 * 100}%` }} />
    {model.replicates.map((rep) => {
      const value = rep.scores[dimension];
      const stack = repeatedPositions.get(value) ?? 0;
      repeatedPositions.set(value, stack + 1);
      // Stack repeated values in four-row clusters. A small symmetric dodge
      // keeps all 16 dots visible without shifting a cluster's score center.
      const offset = (Math.floor(stack / 4) - Math.floor(((frequencies.get(value) ?? 1) - 1) / 4) / 2) * 5;
      return <span key={rep.repeat} className={cn(s.plotPoint, rep.repeat === selectedRepeat && s.plotSelected)}
        data-side={value > threshold ? "high" : "low"}
        style={{ left: `calc(${position(value)} + ${offset}px)`, top: `${21 - (stack % 4) * 5}px` }} />;
    })}
    <span className={s.plotMean} style={{ left: position(stats.mean) }} />
  </div>;
}

function Method({ data }: { data: MbtiTalkData }) {
  const [itemId, setItemId] = useState(6);
  const [answers, setAnswers] = useState(() => data.instrument.items.map((item) => ({ id: item.id, score: 3 })));
  const question = data.instrument.items.find((item) => item.id === itemId)!;
  const scored = scoreAdministration(data.instrument, "local-demonstration", 0, answers);
  const questionHeading = useId();
  return <div className={s.method}>
    <aside className={s.questionSidebar}>
      <div className={s.sidebarHeading}><b>原版英文题库</b><span>{data.instrument.items.length} 题</span></div>
      <div className={s.questionList} aria-label="选择一道 OEJTS 题目">
        {data.instrument.items.map((item) => <button type="button" key={item.id} className={cn(s.questionItem, item.id === itemId && s.activeItem)}
          aria-pressed={item.id === itemId} onClick={() => setItemId(item.id)} aria-label={`Q${item.id}: ${item.left} / ${item.right}`}>
          <span className={s.questionNumber}>{String(item.id).padStart(2, "0")}</span>
          <span lang="en"><b>{item.left}</b><small>{item.right}</small></span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>)}
      </div>
    </aside>
    <div className={s.methodMain}>
      <div className={s.protocolStrip}>
        <div><strong>{data.instrument.items.length}</strong><span>双极英文题<small>原题序 · 1–5 分</small></span></div>
        <ChevronRight size={18} aria-hidden="true" />
        <div><strong>{data.repeats}</strong><span>独立完整施测<small>每次全新会话</small></span></div>
        <ChevronRight size={18} aria-hidden="true" />
        <div><strong>{data.summary.questionnaireCount}</strong><span>有效问卷<small>{data.summary.modelCount} 款模型 · 确定性计分</small></span></div>
      </div>
      <section className={s.questionDemo} aria-labelledby={questionHeading}>
        <div className={s.eyebrow} id={questionHeading}>QUESTION {String(itemId).padStart(2, "0")} <span>点击分值，观察带符号公式</span></div>
        <div className={s.poles}>
          <p lang="en">{question.left}</p>
          <div className={s.responseControl}>
            <ToggleGroup type="single" variant="outline" value={String(answers.find((a) => a.id === itemId)!.score)} aria-label={`Q${itemId} 演示分值`}
              onValueChange={(value) => { if (value) setAnswers((previous) => previous.map((a) => a.id === itemId ? { ...a, score: Number(value) } : a)); }}>
              {[1, 2, 3, 4, 5].map((value) => <ToggleGroupItem key={value} value={String(value)} aria-label={`${value} 分`} className={s.scoreChoice}>{value}</ToggleGroupItem>)}
            </ToggleGroup>
            <div className={s.scaleLabels}><span>完全偏左</span><span>两边相当</span><span>完全偏右</span></div>
          </div>
          <p lang="en">{question.right}</p>
        </div>
      </section>
      <div className={s.formulaHeading}><b>四维原始计分 · 保留混合正负号</b><Button variant="ghost" size="sm" onClick={() => setAnswers(data.instrument.items.map((item) => ({ id: item.id, score: 3 })))}><RotateCcw data-icon="inline-start" />重置为 3</Button></div>
      <div className={s.formulas}>
        {DIMENSIONS.map((dimension) => {
          const rule = data.instrument.scoring[dimension];
          return <div className={cn(s.formula, question.dimension === dimension && s.formulaActive)} key={dimension}>
            <b>{dimension} =</b><code><span>{rule.const}</span>{Object.entries(rule.signs).map(([id, sign]) =>
              <span key={id} className={Number(id) === itemId ? s.selectedTerm : undefined}> {sign > 0 ? "+" : "−"} Q<sub>{id}</sub></span>)}</code>
            <output aria-live="polite">{scored.dimensions[dimension].score}<small>{scored.dimensions[dimension].letter}</small></output>
          </div>;
        })}
      </div>
      <div className={s.methodFoot}><span>本地演示；未调整的题目暂取 3，不计入研究结果。</span><b>8–40 分 · &gt;24 取 E / N / T / P；≤24 取 I / S / F / J</b></div>
    </div>
  </div>;
}

function Overview({ data }: { data: MbtiTalkData }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data.models.find((model) => model.id === selectedId);
  return <div className={s.overview}>
    <div className={s.overviewTop}>
      <div><strong>{data.summary.stableCount}<small> / {data.summary.modelCount}</small></strong><span>款模型达到稳定标准</span></div>
      <div className={s.overviewNarrative}><p>稳定画像，只集中在两种类型。</p><span>{data.summary.unanimousCount} 款完整类型 {data.repeats}/{data.repeats} 一致；不代表逐题答案相同。</span></div>
      <div className={s.shareBar} aria-label={`稳定 ${percent(data.summary.stableCount, data.summary.modelCount)}`}>
        <div><span style={{ width: percent(data.summary.stableCount, data.summary.modelCount) }} /></div>
        <small>稳定 {percent(data.summary.stableCount, data.summary.modelCount)}<span>未稳定 {percent(data.summary.unstableCount, data.summary.modelCount)}</span></small>
      </div>
    </div>
    <div className={s.overviewGroups}>
      {data.summary.stableGroups.map((group) => <section key={group.type} className={s.typeGroup} data-tone={typeTone(group.type)}>
        <div className={s.typeGroupHeader}>
          <div><span className={s.eyebrow}>STABLE PROFILE</span><h3>{group.type}<small>{group.count} 款</small></h3><span>完整类型唯一众数 ≥9/16</span></div>
          <Image src={group.illustration} width={105} height={116} alt={`${group.type} 类型插画`} unoptimized />
        </div>
        <div className={s.stableModels}>{group.modelIds.map((id) => {
          const model = data.models.find((m) => m.id === id)!;
          return <button type="button" key={id} className={cn(s.overviewModel, selectedId === id && s.selectedModel)} aria-pressed={selectedId === id} onClick={() => setSelectedId(id)}>
            <Logo model={model} size={24} /><span>{model.name}<small>{model.modalCount}/{model.n} 次 {model.modalType}</small></span>
          </button>;
        })}</div>
      </section>)}
      <section className={s.unstableGroup}>
        <div className={s.unstableHeader}><div><span className={s.eyebrow}>NO STABLE TYPE</span><h3>{data.summary.unstableCount}<small>款未达到稳定标准</small></h3></div><span className={s.questionMark} aria-hidden="true">?</span></div>
        <div className={s.unstableModels}>{data.models.filter((m) => m.status === "no_stable_type").map((model) =>
          <button type="button" key={model.id} className={cn(s.overviewModel, selectedId === model.id && s.selectedModel)} aria-pressed={selectedId === model.id} onClick={() => setSelectedId(model.id)}>
            <Logo model={model} size={22} /><span>{model.name}</span>
          </button>)}
        </div>
      </section>
    </div>
    <div className={s.overviewReadout} aria-live="polite">{selected ? <><Logo model={selected} size={22} /><b>{selected.name}</b><span>众数 {selected.modalType} · {selected.modalCount}/{selected.n}</span><span>{selected.status === "stable" ? "完整类型唯一众数严格超过半数" : selected.reasons.join("；")}</span></> : <><ArrowUpRight size={17} aria-hidden="true" /><span>点击任意模型，查看稳定性依据。未稳定不是能力评价，也不等于没有答题倾向。</span></>}</div>
  </div>;
}

function Gallery({ data }: { data: MbtiTalkData }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data.models.find((model) => model.id === selectedId);
  const sorted = [...data.models].sort((a, b) =>
    Number(b.status === "stable") - Number(a.status === "stable")
    || (a.modalType ?? "").localeCompare(b.modalType ?? "") || b.modalCount - a.modalCount,
  );
  return <div className={s.gallery}>
    <div className={s.galleryHeading}>
      <span><b>{data.summary.modelCount}</b> 款模型 <i /> 每款 {data.repeats} 次完整问卷</span>
      <span>按稳定状态与类型分组 <i /> <b>{data.summary.stableCount}</b> 稳定 · <b>{data.summary.unstableCount}</b> 未稳定</span>
    </div>
    <div className={s.galleryGrid} aria-label="全部模型的最高频 MBTI 类型与占比">
      {sorted.map((model) => {
        const modes = model.distribution.filter((item) => item.count === model.modalCount);
        return <button type="button" key={model.id} className={cn(s.personalityCard, selectedId === model.id && s.personalitySelected)}
          data-tone={typeTone(modes[0].type)} data-stable={model.status === "stable"} aria-pressed={selectedId === model.id}
          aria-label={`${model.name}，${model.status === "stable" ? "稳定类型" : "未稳定，最高频类型"} ${modes.map((m) => m.type).join("、")}，各 ${model.modalCount}/${model.n}，${exactPercent(model.modalCount, model.n)}`}
          onClick={() => setSelectedId(model.id)}>
          <span className={s.personalityModel}><Logo model={model} size={18} /><span>{model.name}</span></span>
          <span className={s.personalityIdentity}>
            <Image src={modes[0].illustration} width={58} height={64} alt="" unoptimized />
            <span><b>{modes.length === 1 ? modes[0].type : "并列"}</b><strong>{exactPercent(model.modalCount, model.n)}</strong><small>{model.modalCount}/{model.n} 次</small></span>
          </span>
          <span className={s.personalityStatus}>{model.status === "stable" ? <><Check size={11} aria-hidden="true" /> 稳定类型</> : "未稳定 · 仅展示最高频"}</span>
        </button>;
      })}
    </div>
    <div className={s.galleryReadout} aria-live="polite">{selected ? <><Logo model={selected} size={20} /><b>{selected.name}</b><span>{selected.distribution.map((item) => `${item.type} ${item.count}/${selected.n}`).join(" · ")}</span></> : <><ArrowUpRight size={16} aria-hidden="true" /><span>点击模型查看完整分布。百分比 = 该完整类型出现次数 ÷ 16；不是人格置信度。虚线卡片未达到稳定标准。</span></>}</div>
  </div>;
}

function Explorer({ data }: { data: MbtiTalkData }) {
  const [modelId, setModelId] = useState(data.models[0].id);
  const [repeat, setRepeat] = useState(0);
  const model = data.models.find((m) => m.id === modelId)!;
  const selected = model.replicates.find((r) => r.repeat === repeat) ?? model.replicates[0];
  const resultId = useId();
  return <div className={s.explorerLayout}>
    <aside className={s.modelSidebar}>
      <div className={s.sidebarHeading}><b>选择模型</b><span>{data.models.length} 款 · 原始顺序</span></div>
      <div className={s.modelList} aria-label="全部模型">
        {data.models.map((item) => <button type="button" key={item.id} className={cn(s.modelButton, modelId === item.id && s.activeItem)}
          aria-pressed={modelId === item.id} aria-controls={resultId} onClick={() => { setModelId(item.id); setRepeat(item.replicates[0].repeat); }}>
          <Logo model={item} size={26} /><span>{item.name}<small>{item.stableType ? `稳定 ${item.stableType}` : `未稳定 · 众数 ${item.modalType}`}</small></span><ChevronRight size={14} aria-hidden="true" />
        </button>)}
      </div>
    </aside>
    <div className={s.explorerMain} id={resultId}>
      <div className={s.modelHeader}><Logo model={model} size={42} /><div><h3>{model.name}</h3><span>供应商 {model.provider} · {model.n} 份有效问卷</span></div><Status model={model} /></div>
      <div className={s.explorerBody}>
        <div className={s.replicateSection}>
          <div className={s.sectionLabel}><b>{model.n} 次完整类型</b><span>点击一份，联动原始分数</span></div>
          <div className={s.replicateGrid}>{model.replicates.map((rep) => <button type="button" key={rep.repeat} data-tone={typeTone(rep.type)}
            className={cn(s.replicate, selected.repeat === rep.repeat && s.selectedRep)} aria-pressed={selected.repeat === rep.repeat} aria-label={`第 ${rep.repeat + 1} 次 ${rep.type}`}
            onClick={() => setRepeat(rep.repeat)}><small>{String(rep.repeat + 1).padStart(2, "0")}</small><b>{rep.type}</b></button>)}</div>
          <div className={s.sectionLabel}><b>完整类型分布</b><span>众数 {model.modalCount}/{model.n}</span></div>
          <div className={s.distributionScroll} tabIndex={0} role="region" aria-label="完整类型分布详情"><Distribution model={model} /></div>
        </div>
        <div className={s.dimensionSection}>
          <div className={s.sectionLabel}><b>四维原始分数</b><span aria-live="polite">第 {String(selected.repeat + 1).padStart(2, "0")} 次 · {selected.type}</span></div>
          <div className={s.axisHeader}><span>8</span><span>24 分界</span><span>40</span></div>
          {DIMENSIONS.map((d) => {
            const stats = model.dimensions[d];
            return <div className={s.dimensionRow} key={d}>
              <div className={s.dimensionMeta}><b>{stats.lowLetter} <span>/</span> {stats.highLetter}</b><span>{DIMENSION_NAMES[d]}</span><strong>{selected.scores[d]}<small>分</small></strong></div>
              <ScorePlot model={model} dimension={d} selectedRepeat={selected.repeat} threshold={data.instrument.scoring[d].threshold} />
              <div className={s.dimensionStats}><span>均值 {stats.mean.toFixed(2)} · SD {stats.standardDeviation.toFixed(2)}</span><span>{stats.min}–{stats.max} · 边界 {stats.boundaryCount} 次</span></div>
            </div>;
          })}
          <p className={s.plotLegend}><i /> 每点一份问卷 <b>◆</b> 均值 <span>描边点为选中问卷</span></p>
        </div>
      </div>
      <div className={cn(s.modelReason, model.status !== "stable" && s.reasonAmber)} aria-live="polite">
        <b>{model.status === "stable" ? "通过判定" : "未通过原因"}</b><span>{model.reasons.length ? model.reasons.join("；") : `完整类型唯一众数 ≥${data.classification.minModalCount}/${model.n}，严格超过半数。`}</span>
      </div>
    </div>
  </div>;
}

function Stability({ data }: { data: MbtiTalkData }) {
  const comparison = ["anthropic/claude-fable-5.1", "baidu/ernie-5.1"].map((id) => data.models.find((m) => m.id.startsWith(`${id}:`)));
  return <div className={s.stability}>
    <div className={s.rulesStrip}>
      <p>只看完整类型，<br /><em>是否严格过半。</em></p>
      <div><strong>{data.classification.minModalCount}<small>/{data.repeats}</small></strong><span>完整类型：唯一众数<small>至少超过半数 · 8/16 不算</small></span></div>
      <span className={s.ruleNote}>先取得 16 份有效问卷<br />修订后研究规则，非官方 MBTI 标准</span>
    </div>
    <div className={s.comparisonCards}>{comparison.map((model) => model ? <section className={s.comparisonCard} key={model.id}>
      <div className={s.modelHeader}><Logo model={model} size={40} /><div><h3>{model.name}</h3><span>真实问卷 · 边界对照</span></div><Status model={model} /></div>
      <div className={s.modalResult}><b>{model.modalType}</b><strong>{model.modalCount}<small>/{model.n}</small></strong><span>{exactPercent(model.modalCount, model.n)} · 最高频完整类型</span></div>
      <Distribution model={model} />
      <p className={s.meterLegend}>四字母频数和连续分数保留作描述，不再决定是否稳定。</p>
      <div className={cn(s.comparisonVerdict, model.status !== "stable" && s.reasonAmber)}>{model.status === "stable" ? <><Check size={18} aria-hidden="true" /><b>唯一众数超过半数 → 稳定 {model.stableType}</b></> : <><span aria-hidden="true">↳</span><b>恰好半数，不是严格多数 → 未稳定</b></>}</div>
    </section> : null)}</div>
    <p className={s.stabilityFoot}>本次仅修订分析判据，未重新调用模型。并列众数或最高频类型 ≤8/16，均报告「未观察到稳定类型」。</p>
  </div>;
}

function Dimensions({ data }: { data: MbtiTalkData }) {
  const [dimension, setDimension] = useState<MbtiDimension>("SN");
  const [modelId, setModelId] = useState(() => data.models.find((m) => m.name === "Claude Fable 5.1")?.id ?? data.models[0].id);
  const model = data.models.find((m) => m.id === modelId)!;
  const stats = model.dimensions[dimension];
  const rule = data.instrument.scoring[dimension];
  const variationCount = data.summary.dimensionVariations.find((entry) => entry.dimension === dimension)!.count;
  return <div className={s.dimensionsLayout}>
    <div className={s.dimensionsMain}>
      <div className={s.dimensionsHeading}><div><span className={s.eyebrow}>CONTINUOUS SCORES</span><h3>标签之间，只有一条分界线。</h3></div>
        <ToggleGroup type="single" value={dimension} onValueChange={(value) => { if (value) setDimension(value as MbtiDimension); }} variant="outline" aria-label="选择维度">
          {DIMENSIONS.map((d) => <ToggleGroupItem key={d} value={d} className={s.dimensionChoice} aria-label={DIMENSION_NAMES[d]}>{data.instrument.scoring[d].lowLetter} / {data.instrument.scoring[d].highLetter}</ToggleGroupItem>)}
        </ToggleGroup>
      </div>
      <div className={s.dimensionChartHeader}><b>模型 · 点击查看</b><div><span>8 · {rule.lowLetter}</span><span>24</span><span>{rule.highLetter} · 40</span></div><b>均值</b></div>
      <div className={s.allModelPlots} aria-label={`${DIMENSION_NAMES[dimension]}：全部模型连续分数`}>
        {data.models.map((item) => <button type="button" key={item.id} className={cn(s.modelPlotRow, model.id === item.id && s.activePlotRow)}
          aria-pressed={item.id === model.id} onClick={() => setModelId(item.id)} aria-label={`${item.name}，${DIMENSION_NAMES[dimension]}，均值 ${item.dimensions[dimension].mean.toFixed(2)}`}>
          <span><Logo model={item} size={22} />{item.name}</span>
          <ScorePlot model={item} dimension={dimension} threshold={rule.threshold} />
          <strong>{item.dimensions[dimension].mean.toFixed(2)}</strong>
        </button>)}
      </div>
      <p className={s.plotLegend}><i /> 每点一份问卷 <b>◆</b> 均值 <span>横线为最小–最大值 · 原始分数 8–40</span></p>
    </div>
    <aside className={s.dimensionInsight}>
      <span className={s.eyebrow}>WHERE TYPES SHIFT</span>
      <div className={s.insightNumber}>{data.summary.onlySnVariationCount}<span>款模型<br />仅在 S/N 间变化</span></div>
      <p>它们的另外三个字母保持一致，<br />却在实感与直觉之间摆动。</p>
      <div className={s.failureCounts} aria-label="出现两侧字母的模型数，维度可重叠">
        {data.summary.dimensionVariations.map((entry) => <div key={entry.dimension} data-current={entry.dimension === dimension}>
          <b>{entry.dimension}</b><span style={{ "--count": `${entry.count / data.summary.modelCount * 100}%` } as CSSProperties} /><strong>{entry.count}</strong>
        </div>)}
        <small>16 次中两侧字母均出现 · 仅描述波动，不作稳定门槛</small>
      </div>
      <div className={s.selectedDimension} aria-live="polite">
        <div><Logo model={model} /><b>{model.name}</b></div>
        <p>{stats.lowLetter} <strong>{stats.lowLetterCount}</strong><span> : </span>{stats.highLetter} <strong>{stats.highLetterCount}</strong></p>
        <span>均值 {stats.mean.toFixed(2)} · SD {stats.standardDeviation.toFixed(2)}<br />范围 {stats.min}–{stats.max} · 恰好 24 分：{stats.boundaryCount} 次</span>
      </div>
      <p className={s.thresholdNote}><b>24 → {rule.lowLetter}，25 → {rule.highLetter}</b><br />小幅波动也会改变字母。当前维度有 {variationCount} 款模型出现过两侧字母；不影响完整类型判定。</p>
    </aside>
  </div>;
}

function Footnote({ data, view }: { data: MbtiTalkData; view: MbtiView }) {
  return <footer className={s.footer}>
    <span>{view === "method" ? <><a href={data.instrument.source} target="_blank" rel="noreferrer">OEJTS 1.2 · {data.instrument.author}</a> · CC BY-NC-SA 4.0</> : "固定英文问卷下的响应画像；不等于人类人格或能力。"}</span>
    <details className={s.notes} onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); event.stopPropagation(); } }}>
      <summary>运行修订 · Azure Mistral · 8192 / 16384 / 50000 <ChevronRight size={13} aria-hidden="true" /></summary>
      <div className={s.notesContent}><b>按最终运行修订阅读结果</b>{data.runNotes.map((note) => <div key={note.title}><strong>{note.title}</strong><p>{note.detail}</p></div>)}<small>批次 {data.runId} · Esc 收起<br />仅衡量本次提示下的重复性；未验证提示变体、跨语言或外部行为效度。</small></div>
    </details>
  </footer>;
}

/** Fits the talk shell's 1300 × 570 content slot; chapter headings belong to the parent. */
export function MbtiPanel({ data, view }: { data: MbtiTalkData; view: MbtiView }) {
  function containControlKeys(event: KeyboardEvent<HTMLElement>) {
    // A slide shell may bind arrows/Space. Preserve native control behavior without
    // letting a focused questionnaire/list control accidentally advance the talk.
    if ((event.target as HTMLElement).closest("button, input, select, summary, [tabindex='0']")
      && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", " ", "Enter"].includes(event.key)) event.stopPropagation();
  }
  return <section className={s.panel} aria-label={`OEJTS · ${VIEW_LABELS[view]}`} data-mbti-view={view} onKeyDown={containControlKeys}>
    <div className={s.content}>
      {view === "method" ? <Method data={data} /> : view === "overview" ? <Overview data={data} /> : view === "gallery" ? <Gallery data={data} /> : view === "explorer" ? <Explorer data={data} /> : view === "stability" ? <Stability data={data} /> : <Dimensions data={data} />}
    </div>
    <Footnote data={data} view={view} />
  </section>;
}

export default MbtiPanel;
