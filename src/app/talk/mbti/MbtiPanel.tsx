"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import Image from "next/image";
import { VendorIcon } from "@/components/ZenMuxIcons";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { scoreAdministration } from "@research/personality/score";
import type { MbtiDimension, MbtiModel, MbtiTalkData, MbtiView } from "./types";
import s from "./mbti.module.css";

export type { MbtiTalkData, MbtiView } from "./types";
/** A request from another scene to open one model in the explorer; nonce makes repeats distinct. */
export type MbtiFocus = { id: string; nonce: number };
type Inspect = ((id: string) => void) | undefined;

const DIMENSIONS: MbtiDimension[] = ["IE", "SN", "FT", "JP"];
const DIMENSION_NAMES: Record<MbtiDimension, string> = {
  IE: "内向 / 外向", SN: "实感 / 直觉", FT: "情感 / 思考", JP: "判断 / 感知",
};
const VIEW_LABELS: Record<MbtiView, string> = {
  method: "问卷与计分", overview: "研究总览", gallery: "全模型人格一览", distribution: "模型类型分布", vendors: "厂商 × 类型分布", explorer: "模型探索", stability: "稳定性判定", dimensions: "连续维度",
};
const percent = (n: number, total: number) => `${(100 * n / total).toFixed(1)}%`;
const exactPercent = (n: number, total: number) => `${Number((100 * n / total).toFixed(2))}%`;
const position = (score: number) => `${(score - 8) / 32 * 100}%`;
const typeTone = (type: string) => type[1] === "N" ? (type[2] === "T" ? "analyst" : "diplomat") : type[3] === "J" ? "sentinel" : "explorer";
/** The 16 types in the conventional four temperament groups; tones match typeTone. */
const TYPE_GROUPS = [
  { tone: "analyst", label: "分析家", code: "NT", types: ["INTJ", "INTP", "ENTJ", "ENTP"] },
  { tone: "diplomat", label: "外交家", code: "NF", types: ["INFJ", "INFP", "ENFJ", "ENFP"] },
  { tone: "sentinel", label: "守护者", code: "SJ", types: ["ISTJ", "ISFJ", "ESTJ", "ESFJ"] },
  { tone: "explorer", label: "探险家", code: "SP", types: ["ISTP", "ISFP", "ESTP", "ESFP"] },
] as const;
const ALL_TYPES: string[] = TYPE_GROUPS.flatMap((group) => [...group.types]);
const byConsistency = (a: MbtiModel, b: MbtiModel) => b.modalCount - a.modalCount || a.name.localeCompare(b.name);

function Logo({ model, size = 28 }: { model: MbtiModel; size?: number }) {
  return <VendorIcon vendor={model.logo} size={size} className={s.logo} />;
}

function Status({ model }: { model: MbtiModel }) {
  return <Badge variant={model.status === "stable" ? "default" : "outline"}>
    {model.status === "stable" ? <><Check data-icon="inline-start" />稳定 {model.stableType}</> : "未观察到稳定类型"}
  </Badge>;
}

/** One cell per questionnaire, modal type first; solid cells are the modal type. */
function TypeStrip({ model }: { model: MbtiModel }) {
  return <span className={s.typeStrip} aria-hidden="true">
    {model.distribution.flatMap((item) => Array.from({ length: item.count }, (_, i) =>
      <i key={`${item.type}-${i}`} data-tone={typeTone(item.type)} data-modal={item.count === model.modalCount} />))}
  </span>;
}

function InspectButton({ model, onInspect }: { model: MbtiModel; onInspect: Inspect }) {
  if (!onInspect) return null;
  return <Button variant="outline" size="sm" className={s.inspectButton} onClick={() => onInspect(model.id)}>
    查看 16 次<ArrowRight data-icon="inline-end" />
  </Button>;
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

function Overview({ data, onInspect }: { data: MbtiTalkData; onInspect: Inspect }) {
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
    <div className={s.overviewReadout} aria-live="polite">{selected ? <><Logo model={selected} size={22} /><b>{selected.name}</b><span>众数 {selected.modalType} · {selected.modalCount}/{selected.n}</span><span>{selected.status === "stable" ? "完整类型唯一众数严格超过半数" : selected.reasons.join("；")}</span><InspectButton model={selected} onInspect={onInspect} /></> : <><ArrowUpRight size={17} aria-hidden="true" /><span>点击任意模型，查看稳定性依据。未稳定不是能力评价，也不等于没有答题倾向。</span></>}</div>
  </div>;
}

const GALLERY_COLUMNS = 10;

function Gallery({ data, onInspect }: { data: MbtiTalkData; onInspect: Inspect }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data.models.find((model) => model.id === selectedId);
  const find = (id: string) => data.models.find((m) => m.id === id)!;
  // One band per stable type, then everything without a stable type. Bands keep the
  // grid honest: a stable card never sits next to an unstable one of the same mode.
  const bands = [
    ...data.summary.stableGroups.map((group) => ({ key: group.type, type: group.type as string | null, illustration: group.illustration, models: group.modelIds.map(find) })),
    { key: "unstable", type: null, illustration: null, models: data.models.filter((m) => m.status !== "stable") },
  ].filter((band) => band.models.length).map((band) => ({ ...band, models: [...band.models].sort(byConsistency) }));
  return <div className={s.gallery}>
    <div className={s.galleryHeading}>
      <span><b>{data.summary.modelCount}</b> 款模型 <i /> 每款 {data.repeats} 次完整问卷 <i /> 色条 = {data.repeats} 份问卷的完整类型，实色为最高频</span>
      <span><b>{data.summary.stableCount}</b> 稳定 · <b>{data.summary.unstableCount}</b> 未稳定</span>
    </div>
    <div className={s.galleryBands} aria-label="全部模型的最高频 MBTI 类型与占比"
      style={{ gridTemplateRows: bands.map((band) => `${Math.ceil(band.models.length / GALLERY_COLUMNS)}fr`).join(" ") }}>
      {bands.map((band) => <section key={band.key} className={s.galleryBand} data-tone={band.type ? typeTone(band.type) : undefined} data-band={band.type ? "stable" : "unstable"}
        aria-label={band.type ? `稳定 ${band.type}，${band.models.length} 款` : `未观察到稳定类型，${band.models.length} 款`}>
        <header className={s.bandLabel}>
          {band.illustration ? <Image src={band.illustration} width={40} height={44} alt="" unoptimized /> : <span className={s.bandQuestion} aria-hidden="true">?</span>}
          <div><b>{band.type ?? "未稳定"}</b><span>{band.type ? <>稳定 · {band.models.length} 款</> : <>{band.models.length} 款 · 仅展示最高频</>}</span></div>
        </header>
        <div className={s.bandCards}>{band.models.map((model) => {
          const modes = model.distribution.filter((item) => item.count === model.modalCount);
          return <button type="button" key={model.id} className={cn(s.personalityCard, selectedId === model.id && s.personalitySelected)}
            data-tone={typeTone(modes[0].type)} data-stable={model.status === "stable"} aria-pressed={selectedId === model.id} title={model.name}
            aria-label={`${model.name}，${model.status === "stable" ? "稳定类型" : "未稳定，最高频类型"} ${modes.map((m) => m.type).join("、")}，各 ${model.modalCount}/${model.n}，${exactPercent(model.modalCount, model.n)}`}
            onClick={() => setSelectedId((id) => id === model.id ? null : model.id)}>
            <span className={s.personalityModel}><Logo model={model} size={16} /><span>{model.name}</span></span>
            <span className={s.personalityShare}>
              {model.status !== "stable" && <b>{modes.length === 1 ? modes[0].type : "并列"}</b>}
              <strong>{exactPercent(model.modalCount, model.n)}</strong><small>{model.modalCount}/{model.n}</small>
            </span>
            <TypeStrip model={model} />
          </button>;
        })}</div>
      </section>)}
    </div>
    <div className={s.galleryReadout} aria-live="polite">{selected ? <><Logo model={selected} size={20} /><b>{selected.name}</b><span>{selected.distribution.map((item) => `${item.type} ${item.count}/${selected.n}`).join(" · ")}</span><InspectButton model={selected} onInspect={onInspect} /></> : <><ArrowUpRight size={16} aria-hidden="true" /><span>点击模型查看完整分布。百分比 = 最高频完整类型出现次数 ÷ 16；不是人格置信度。虚线卡片未达到稳定标准。</span></>}</div>
  </div>;
}

type Scope = "stable" | "all";
/** Where a model sits: its stable type, or (scope "all") every tied modal type of an unstable model. */
function placements(model: MbtiModel, scope: Scope): string[] {
  if (model.status === "stable" && model.stableType) return [model.stableType];
  if (scope === "stable") return [];
  return model.distribution.filter((item) => item.count === model.modalCount).map((item) => item.type);
}
const tieLabel = (model: MbtiModel) => model.distribution.filter((item) => item.count === model.modalCount).length > 1 ? "并列最高频" : "最高频";
const sortPlaced = (a: MbtiModel, b: MbtiModel) => Number(b.status === "stable") - Number(a.status === "stable") || byConsistency(a, b);

function ScopeToggle({ scope, setScope, data }: { scope: Scope; setScope: (scope: Scope) => void; data: MbtiTalkData }) {
  return <ToggleGroup type="single" variant="outline" size="sm" value={scope} aria-label="统计范围"
    onValueChange={(value) => { if (value) setScope(value as Scope); }}>
    <ToggleGroupItem value="stable" className={s.orderChoice}>稳定 {data.summary.stableCount}</ToggleGroupItem>
    <ToggleGroupItem value="all" className={s.orderChoice}>全部 {data.summary.modelCount}</ToggleGroupItem>
  </ToggleGroup>;
}

function ScopeLegend() {
  return <span className={s.scopeLegend}><i data-kind="stable" />稳定类型<i data-kind="unstable" />未稳定 · 最高频</span>;
}

/** Models stacked over the 16-type axis; nearer the axis = more consistent. Unstable = dashed, lighter. */
const MAP_ROW_CAP = 15;

function TypeMap({ data, onInspect }: { data: MbtiTalkData; onInspect: Inspect }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [order, setOrder] = useState<"consistency" | "vendor">("consistency");
  const [scope, setScope] = useState<Scope>("all");
  const selected = data.models.find((m) => m.id === selectedId && placements(m, scope).length);
  const byType = new Map<string, MbtiModel[]>(ALL_TYPES.map((type) => [type, []]));
  for (const model of data.models) for (const type of placements(model, scope)) byType.get(type)?.push(model);
  for (const models of byType.values()) models.sort(order === "vendor"
    ? (a, b) => Number(b.status === "stable") - Number(a.status === "stable") || a.vendor.localeCompare(b.vendor) || byConsistency(a, b) : sortPlaced);
  const maxCount = Math.max(1, ...[...byType.values()].map((m) => m.length));
  // Shared sub-column count keeps stack height proportional to count; tiny columns may use fewer.
  const subcols = Math.ceil(maxCount / MAP_ROW_CAP);
  const rows = Math.ceil(maxCount / subcols);
  const colsFor = (type: string) => Math.min(subcols, byType.get(type)!.length);
  const populated = ALL_TYPES.filter((type) => byType.get(type)!.length);
  const placedCount = data.models.filter((m) => placements(m, scope).length).length;
  const counts = new Map(selected?.distribution.map((item) => [item.type, item.count]));
  return <div className={s.typeMap}>
    <div className={s.typeMapHeading}>
      <span><b>{placedCount}</b> 款模型 <i /> 16 种类型中 <b>{populated.length}</b> 种出现 <i /> 数字 = 16 次中该类型出现次数，越靠近横轴越一致 {scope === "all" && <><i /><ScopeLegend /></>}</span>
      <span className={s.headingControls}>
        <ScopeToggle scope={scope} setScope={(next) => { setScope(next); setSelectedId(null); }} data={data} />
        <ToggleGroup type="single" variant="outline" size="sm" value={order} aria-label="列内排序"
          onValueChange={(value) => { if (value) setOrder(value as typeof order); }}>
          <ToggleGroupItem value="consistency" className={s.orderChoice}>按一致度</ToggleGroupItem>
          <ToggleGroupItem value="vendor" className={s.orderChoice}>按厂商</ToggleGroupItem>
        </ToggleGroup>
      </span>
    </div>
    <div className={s.typeMapChart} data-selecting={Boolean(selected)} data-scope={scope} role="group" aria-label={`模型在 16 种 MBTI 类型上的分布：${populated.map((type) => `${type} ${byType.get(type)!.length} 款`).join("，")}，其余类型 0 款`}
      style={{ gridTemplateColumns: ALL_TYPES.map((type) => colsFor(type) ? `minmax(calc(var(--filled-column) * ${colsFor(type)} / 2), ${colsFor(type)}fr)` : "var(--empty-column)").join(" ") }}>
      {TYPE_GROUPS.map((group) => {
        const total = group.types.reduce((sum, type) => sum + byType.get(type)!.length, 0);
        return <div key={group.code} className={s.temperament} data-tone={group.tone} data-empty={total === 0}>
          <b>{group.label}</b><span>{group.code}</span><small>{total} 款</small>
        </div>;
      })}
      {ALL_TYPES.map((type) => {
        const models = byType.get(type)!;
        const cols = Math.max(1, colsFor(type));
        return <div key={type} className={cn(s.typeColumn, !models.length && s.typeColumnEmpty)} data-tone={typeTone(type)} data-hit={Boolean(counts.get(type))}
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
          {models.map((model, i) => {
            const stable = model.status === "stable";
            return <button type="button" key={model.id} title={model.name} data-stable={stable}
              className={cn(s.mapChip, selectedId === model.id && s.mapChipSelected, selected && selected.vendor === model.vendor && s.mapChipKin)}
              style={{ gridRow: rows - Math.floor(i / cols), gridColumn: (i % cols) + 1 }}
              aria-pressed={selectedId === model.id} aria-label={`${model.name}，${stable ? "稳定" : `未稳定，${tieLabel(model)}`} ${type}，${model.modalCount}/${model.n} 次`}
              onClick={() => setSelectedId((id) => id === model.id ? null : model.id)}>
              <Logo model={model} size={16} /><span>{model.name}</span><small>{model.modalCount}</small>
            </button>;
          })}
        </div>;
      })}
      {ALL_TYPES.map((type) => {
        const models = byType.get(type)!;
        const stableN = models.filter((m) => m.status === "stable").length;
        const hit = counts.get(type) ?? 0;
        return <div key={type} className={s.typeAxis} data-tone={typeTone(type)} data-empty={models.length === 0}>
          <span className={s.axisType}>{stableN > 0 && <Image src={`/mbti/${type.toLowerCase()}.svg`} width={24} height={26} alt="" unoptimized />}<b>{type}</b>
            {models.length > 0 && <small>{stableN > 0 && `${stableN} 款`}{models.length > stableN && <i>{stableN > 0 ? " +" : ""}{models.length - stableN}</i>}</small>}</span>
          {models.length === 0 && <span className={s.axisZero}>0</span>}
          {selected && <em className={s.axisHit} data-zero={hit === 0} style={{ "--share": `${hit / selected.n * 100}%` } as CSSProperties}
            aria-label={`${selected.name} ${type} ${hit}/${selected.n}`}>{hit}</em>}
        </div>;
      })}
    </div>
    <div className={s.galleryReadout} aria-live="polite">{selected ? <><Logo model={selected} size={20} /><b>{selected.name}</b>
      <span>{selected.status === "stable" ? `稳定 ${selected.stableType}` : `未稳定 · ${tieLabel(selected)} ${placements(selected, "all").join(" / ")}`} · 横轴下方为 16 次的完整类型频数：{selected.distribution.map((item) => `${item.type} ${item.count}`).join(" · ")}；同厂商模型保持高亮</span>
      <InspectButton model={selected} onInspect={onInspect} /></>
      : <><ArrowUpRight size={16} aria-hidden="true" /><span>{scope === "stable"
        ? `仅含 ${data.summary.stableCount} 款稳定模型；切换「全部」可加入 ${data.summary.unstableCount} 款未稳定模型的最高频类型（虚线，浅色）。点击模型，横轴下方显示完整频数。`
        : "虚线浅色 = 未稳定模型，只放在最高频类型列（并列则各列都放），不是稳定标签。轴上「+n」为未稳定数。点击模型，横轴下方显示完整频数。"}</span></>}</div>
  </div>;
}

// Brand words that the vendor row already says; chips drop them (full name stays in title/readout).
const BRAND_PREFIX = /^(Claude|Gemini|Grok|Kimi|MiniMax|MiMo|Mistral|DeepSeek|Muse|LongCat|Doubao|GLM|Step|ERNIE|Fugu)\s+/;
const shortName = (name: string) => name.replace(BRAND_PREFIX, "");

/** Vendor rows × 16 type columns; each cell lists that vendor's models placed in the type. */
function VendorMap({ data, onInspect }: { data: MbtiTalkData; onInspect: Inspect }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const selected = data.models.find((m) => m.id === selectedId && placements(m, scope).length);
  const vendors = [...new Map(data.models.map((m) => [m.vendor, m])).values()].map((first) => {
    const models = data.models.filter((m) => m.vendor === first.vendor);
    const cells = new Map<string, MbtiModel[]>();
    for (const model of models) for (const type of placements(model, scope)) cells.set(type, [...(cells.get(type) ?? []), model]);
    for (const list of cells.values()) list.sort(sortPlaced);
    return { id: first.vendor, name: first.vendorName, logo: first, models, cells, stable: models.filter((m) => m.status === "stable").length };
  }).sort((a, b) => b.models.length - a.models.length || b.stable - a.stable || a.name.localeCompare(b.name));
  // Column width follows the busiest cell in that column so wide cells wrap less.
  const weight = (type: string) => Math.min(5, Math.max(0, ...vendors.map((v) => v.cells.get(type)?.length ?? 0)));
  const typeTotals = new Map(ALL_TYPES.map((type) => [type, vendors.reduce((sum, v) => sum + (v.cells.get(type)?.length ?? 0), 0)]));
  return <div className={s.vendorMap}>
    <div className={s.typeMapHeading}>
      <span><b>{vendors.length}</b> 家厂商 <i /> 每行一家，格内为该厂商落在此类型的模型 <i /><ScopeLegend /></span>
      <span className={s.headingControls}><ScopeToggle scope={scope} setScope={(next) => { setScope(next); setSelectedId(null); }} data={data} /></span>
    </div>
    <div className={s.vendorScroll} tabIndex={0} role="region" aria-label="厂商 × MBTI 类型矩阵">
      <div className={s.vendorGrid} data-selecting={Boolean(selected)}
        style={{ gridTemplateColumns: `112px ${ALL_TYPES.map((type) => weight(type) ? `minmax(${weight(type) === 1 ? "86px" : "0"}, ${weight(type)}fr)` : "var(--empty-column)").join(" ")} 40px` }}>
        <div className={s.vendorCorner}>厂商 \ 类型</div>
        {ALL_TYPES.map((type) => <div key={type} className={s.vendorHead} data-tone={typeTone(type)} data-empty={!typeTotals.get(type)}>
          <b>{type}</b>{Boolean(typeTotals.get(type)) && <small>{typeTotals.get(type)}</small>}
        </div>)}
        <div className={s.vendorCorner} data-align="end">稳定</div>
        {vendors.map((vendor, row) => <div key={vendor.id} className={s.vendorRow} data-alt={row % 2 === 1}>
          <div className={s.vendorName}><Logo model={vendor.logo} size={18} /><span>{vendor.name}</span></div>
          {ALL_TYPES.map((type) => {
            const models = vendor.cells.get(type) ?? [];
            return <div key={type} className={s.vendorCell} data-tone={typeTone(type)} data-empty={!models.length}>
              {models.map((model) => <button type="button" key={model.id} title={`${model.name} · ${model.modalCount}/${model.n}`} data-stable={model.status === "stable"}
                className={cn(s.vendorChip, selectedId === model.id && s.mapChipSelected)} aria-pressed={selectedId === model.id}
                aria-label={`${vendor.name} ${model.name}，${model.status === "stable" ? "稳定" : `未稳定，${tieLabel(model)}`} ${type}，${model.modalCount}/${model.n} 次`}
                onClick={() => setSelectedId((id) => id === model.id ? null : model.id)}>
                <span>{shortName(model.name)}</span><small>{model.modalCount}</small>
              </button>)}
            </div>;
          })}
          <div className={s.vendorTally}><b>{vendor.stable}</b><small>/{vendor.models.length}</small></div>
        </div>)}
      </div>
    </div>
    <div className={s.galleryReadout} aria-live="polite">{selected ? <><Logo model={selected} size={20} /><b>{selected.name}</b>
      <span>{selected.vendorName} · {selected.status === "stable" ? `稳定 ${selected.stableType}` : `未稳定 · ${tieLabel(selected)} ${placements(selected, "all").join(" / ")}`} · {selected.distribution.map((item) => `${item.type} ${item.count}/${selected.n}`).join(" · ")}</span>
      <InspectButton model={selected} onInspect={onInspect} /></>
      : <><ArrowUpRight size={16} aria-hidden="true" /><span>实线 = 稳定类型；虚线浅色 = 未稳定模型的最高频类型（并列则各列都放）。格内数字为 16 次中出现次数；右侧为稳定数 / 全部数。点击模型查看完整分布。</span></>}</div>
  </div>;
}

function Explorer({ data, focus }: { data: MbtiTalkData; focus?: MbtiFocus | null }) {
  const [modelId, setModelId] = useState(() => data.models.find((m) => m.id === focus?.id)?.id ?? data.models[0].id);
  const [repeat, setRepeat] = useState(0);
  const [seenFocus, setSeenFocus] = useState(focus?.nonce);
  const list = useRef<HTMLDivElement>(null);
  // Another scene asked for a model: adopt it once per request (adjust state during render).
  if (focus && focus.nonce !== seenFocus) {
    setSeenFocus(focus.nonce);
    const target = data.models.find((m) => m.id === focus.id);
    if (target) { setModelId(target.id); setRepeat(target.replicates[0].repeat); }
  }
  useEffect(() => {
    // Keep the active model visible inside its own list without scrolling the stage.
    const container = list.current;
    const active = container?.querySelector<HTMLElement>("[aria-pressed='true']");
    if (!container || !active) return;
    const top = active.offsetTop - container.offsetTop;
    if (top < container.scrollTop || top + active.offsetHeight > container.scrollTop + container.clientHeight) {
      container.scrollTop = top - container.clientHeight / 2 + active.offsetHeight / 2;
    }
  }, [modelId]);
  const model = data.models.find((m) => m.id === modelId)!;
  const selected = model.replicates.find((r) => r.repeat === repeat) ?? model.replicates[0];
  const resultId = useId();
  return <div className={s.explorerLayout}>
    <aside className={s.modelSidebar}>
      <div className={s.sidebarHeading}><b>选择模型</b><span>{data.models.length} 款 · 原始顺序</span></div>
      <div className={s.modelList} aria-label="全部模型" ref={list}>
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
export function MbtiPanel({ data, view, focus, onInspect }: {
  data: MbtiTalkData; view: MbtiView;
  /** Explorer only: a model requested from another scene. */
  focus?: MbtiFocus | null;
  /** Overview / gallery / distribution / vendors: open a model in the explorer scene. */
  onInspect?: (id: string) => void;
}) {
  function containControlKeys(event: KeyboardEvent<HTMLElement>) {
    // A slide shell may bind arrows/Space. Preserve native control behavior without
    // letting a focused questionnaire/list control accidentally advance the talk.
    if ((event.target as HTMLElement).closest("button, input, select, summary, [tabindex='0']")
      && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", " ", "Enter"].includes(event.key)) event.stopPropagation();
  }
  return <section className={s.panel} aria-label={`OEJTS · ${VIEW_LABELS[view]}`} data-mbti-view={view} onKeyDown={containControlKeys}>
    <div className={s.content}>
      {view === "method" ? <Method data={data} />
        : view === "overview" ? <Overview data={data} onInspect={onInspect} />
        : view === "gallery" ? <Gallery data={data} onInspect={onInspect} />
        : view === "distribution" ? <TypeMap data={data} onInspect={onInspect} />
        : view === "vendors" ? <VendorMap data={data} onInspect={onInspect} />
        : view === "explorer" ? <Explorer data={data} focus={focus} />
        : view === "stability" ? <Stability data={data} />
        : <Dimensions data={data} />}
    </div>
    <Footnote data={data} view={view} />
  </section>;
}

export default MbtiPanel;
