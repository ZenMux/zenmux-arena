"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";
import { ArrowRight, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import RelationshipGraph from "@/app/who-are-you/RelationshipGraph";
import { DEFAULT_RENDER, type RenderConfig } from "@research/lib/geometry";
import type { VendorId } from "@research/lib/types";
import { cn } from "@/lib/utils";
import type { IdentityCounts, IdentityEvidence, IdentityOutcome, IdentityTalkData, IdentityVariant, IdentityView } from "./types";
import styles from "./identity.module.css";

const OUTCOMES: { id: IdentityOutcome; label: string; meaning: string }[] = [
  { id: "self", label: "自指", meaning: "说对了自己的真实厂商" },
  { id: "cross", label: "跨厂混淆", meaning: "自称属于另一家厂商" },
  { id: "refused", label: "拒答", meaning: "拒绝回答身份问题" },
  { id: "unknown", label: "无身份", meaning: "回答了，但未给出具体厂商" },
];
const GRAPH_CONFIG: RenderConfig = { ...DEFAULT_RENDER, chrome: false, background: "#f7f5ef", nodeRadius: 46, nodeGap: 20, ringScale: 0.95, labelMode: "top", curveBow: 0.08 };
const num = (n: number) => new Intl.NumberFormat("en-US").format(n);
const pct = (n: number, total: number) => `${(total ? n / total * 100 : 0).toFixed(1)}%`;
const rate = (counts: IdentityCounts, outcome: IdentityOutcome) => counts.n ? counts[outcome] / counts.n : 0;

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  const id = useId();
  return <div className={styles.choice}>
    <label htmlFor={id}>{label}</label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className={styles.selectTrigger}><SelectValue /></SelectTrigger>
      <SelectContent className={styles.selectMenu}><SelectGroup>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectGroup></SelectContent>
    </Select>
  </div>;
}

function Composition({ counts, large = false }: { counts: IdentityCounts; large?: boolean }) {
  return <div className={cn(styles.composition, large && styles.compositionLarge)} role="img" aria-label={OUTCOMES.map((o) => `${o.label} ${pct(counts[o.id], counts.n)}`).join("，")}>
    {OUTCOMES.map((o) => <span key={o.id} data-outcome={o.id} style={{ width: `${rate(counts, o.id) * 100}%` }} title={`${o.label} ${num(counts[o.id])} / ${num(counts.n)}`} />)}
  </div>;
}

function Legend() {
  return <div className={styles.legend}>{OUTCOMES.map((o) => <span key={o.id}><i data-outcome={o.id} />{o.label}</span>)}</div>;
}

function Provenance({ evidence }: { evidence: IdentityEvidence }) {
  return <details className={styles.provenance}>
    <summary>原始记录 · {evidence.sourceRun.split("/")[1]} · {evidence.excerpted ? "原文节选" : "完整回答"}</summary>
    <div><time dateTime={evidence.timestamp}>{evidence.timestamp}</time><code>{evidence.sourceKey}</code>
      <span>标注：{evidence.extractor} · 自称 {evidence.claimedVendor}</span>
      <a href={`/who-are-you/browse?run=${encodeURIComponent(evidence.sourceRun)}&model=${encodeURIComponent(evidence.modelId)}`} target="_blank" rel="noreferrer">在原始回答浏览器查看 ↗</a>
    </div>
  </details>;
}

function Footer({ data, children }: { data: IdentityTalkData; children?: React.ReactNode }) {
  return <footer className={styles.footer}><span>{children ?? "身份自述是观测结果，不是训练来源或蒸馏关系的证据。"}</span><span>2026.05—06 · n = {num(data.counts.n)}</span></footer>;
}

function Method({ data }: { data: IdentityTalkData }) {
  const [language, setLanguage] = useState("ja");
  const [family, setFamily] = useState("bare");
  const [repeats, setRepeats] = useState("40");
  const [revealed, setRevealed] = useState(false);
  const [sampleIndex, setSampleIndex] = useState(0);
  const variant = data.variants.find((v) => v.id === family)!;
  const samples = data.evidence.filter((e) => e.uses.includes("method") && e.lang === language && e.family === family);
  const evidence = samples[sampleIndex % samples.length];
  function reset(next: () => void) { next(); setRevealed(false); setSampleIndex(0); }
  return <>
    <div className={styles.methodGrid}>
      <div className={styles.methodSetup}>
        <p className={styles.eyebrow}>搭一场身份实验</p>
        <div className={styles.methodNumbers}><strong>{data.vendors.length}<small>家厂商</small></strong><span>·</span><strong>{data.models.length}<small>个模型</small></strong><span>·</span><strong>{data.languages.length}<small>种语言</small></strong></div>
        <Choice label="选择提问 / 目标语言" value={language} onChange={(v) => reset(() => setLanguage(v))} options={data.languages.map((l) => ({ value: l.code, label: `${l.name} · ${l.nativeName}` }))} />
        <Choice label="选择提示词家族" value={family} onChange={(v) => reset(() => setFamily(v))} options={data.variants.map((v) => ({ value: v.id, label: v.label }))} />
        <Choice label="每个模型、每种语言重复" value={repeats} onChange={setRepeats} options={["1", "10", "30", "40"].map((n) => ({ value: n, label: `${n} 次` }))} />
        <p className={styles.formula}>27 × 1 × {repeats} = <strong>{num(27 * Number(repeats))}</strong> 条</p>
        <p className={styles.small}>上方是单语言方案计算。真实研究每模型、每语言为裸问 40 + 追问 30 + 去品牌 40 次，共 29,700 条。</p>
      </div>
      <div className={styles.methodDemo}>
        <div className={styles.inlineHeader}><p className={styles.eyebrow}>档案回放 / Tencent Hy3 Preview</p><span className={styles.small}>原厂 provider · GPT-5.5 标注</span></div>
        <div className={styles.promptBox}><span className={styles.caption}>实际发出的提示词</span><p lang={family === "unbranded" ? "en" : language}>{variant.prompts[language]}</p></div>
        {revealed && evidence ? <div className={styles.answerBox} aria-live="polite">
          <div className={styles.inlineHeader}><span className={styles.outcomeText} data-outcome={evidence.outcome}>{OUTCOMES.find((o) => o.id === evidence.outcome)!.label}</span><span className={styles.small}>精选记录 {sampleIndex % samples.length + 1} / {samples.length}</span></div>
          <blockquote lang={evidence.lang}>{evidence.response}{evidence.excerpted ? "…" : ""}</blockquote>
          <Provenance evidence={evidence} />
        </div> : <div className={styles.answerWaiting}><span aria-hidden="true">“</span><p>同一句「你是谁」，<br />它会递出哪一张名片？</p></div>}
        <div className={styles.demoActions}>
          <Button className={styles.action} onClick={() => { if (revealed) setSampleIndex((i) => i + 1); setRevealed(true); }} disabled={!samples.length}>{revealed ? "换一条已记录回答" : "揭晓真实回答"}<ChevronRight data-icon="inline-end" aria-hidden="true" /></Button>
          <span className={styles.small}>只回放精选原文；调整重复次数不会发起调用或改变研究统计。</span>
        </div>
      </div>
    </div>
    <Footer data={data}>{data.methodology.cacheCaveat}</Footer>
  </>;
}

function Overview({ data }: { data: IdentityTalkData }) {
  const [outcome, setOutcome] = useState<IdentityOutcome>("cross");
  const selected = OUTCOMES.find((o) => o.id === outcome)!;
  const ranked = [...data.vendors].sort((a, b) => b.counts[outcome] - a.counts[outcome]).slice(0, 5);
  const max = Math.max(...ranked.map((v) => v.counts[outcome]), 1);
  return <>
    <div className={styles.overviewStats}>
      {OUTCOMES.map((o) => <button key={o.id} type="button" className={cn(styles.stat, outcome === o.id && styles.statSelected)} data-outcome={o.id} aria-pressed={outcome === o.id} onClick={() => setOutcome(o.id)}>
        <span>{o.label}<i /></span><strong>{pct(data.counts[o.id], data.counts.n)}</strong><span>{num(data.counts[o.id])} 条<span>{o.meaning}</span></span>
      </button>)}
    </div>
    <Composition counts={data.counts} large />
    <div className={styles.overviewBottom}>
      <div className={styles.takeaway}><p className={styles.eyebrow}>大多数时候，它们知道自己是谁</p><p className={styles.largeCopy}>有趣的是，<br /><em>混淆并不均匀。</em></p><p className={styles.small}>点击上方类别，查看其来源。拒答和无身份都不计入跨厂混淆；低自指率也不一定意味着冒认别人。</p></div>
      <div className={styles.ranking} aria-live="polite"><div className={styles.inlineHeader}><strong>{selected.label} · 次数最多的厂商</strong><span className={styles.small}>按次数，不按比率</span></div>
        {ranked.map((v) => <div className={styles.rankRow} key={v.id}><span>{v.label}</span><div><i data-outcome={outcome} style={{ width: `${v.counts[outcome] / max * 100}%` }} /></div><strong>{num(v.counts[outcome])}<small>{pct(v.counts[outcome], v.counts.n)}</small></strong></div>)}
      </div>
    </div>
    <Footer data={data} />
  </>;
}

function Prompts({ data }: { data: IdentityTalkData }) {
  const [family, setFamily] = useState("unbranded");
  const [language, setLanguage] = useState("zh-Hans");
  const variant = data.variants.find((v) => v.id === family)!;
  const multiplier = rate(data.variants[2].counts, "cross") / rate(data.variants[0].counts, "cross");
  return <>
    <div className={styles.promptsLayout}>
      <div className={styles.promptChart}>
        <div className={styles.inlineHeader}><p className={styles.eyebrow}>跨厂混淆率 / 同一纵轴 0—15%</p><span className={styles.multiplier}>{multiplier.toFixed(1)}×</span></div>
        <div className={styles.columns}>
          {data.variants.map((v, i) => <button type="button" className={cn(styles.column, family === v.id && styles.columnSelected)} aria-pressed={family === v.id} key={v.id} onClick={() => setFamily(v.id)}>
            <div className={styles.columnPlot}><div style={{ height: `${rate(v.counts, "cross") / 0.15 * 100}%` }}><strong>{pct(v.counts.cross, v.counts.n)}</strong></div></div>
            <span className={styles.columnLabel}><small>0{i + 1}</small>{v.label}</span><span className={styles.small}>{num(v.counts.cross)} / {num(v.counts.n)} 条</span>
          </button>)}
        </div>
        <p className={styles.chartNote}>去品牌组观察到的混淆率约为裸问的 {multiplier.toFixed(1)} 倍。<br />更强的提示词，不代表更接近“真实身份”。</p>
      </div>
      <div className={styles.promptDetail}>
        <div className={styles.inlineHeader}><strong>{variant.label}</strong><Choice label="查看原始提示词" value={language} onChange={setLanguage} options={data.languages.map((l) => ({ value: l.code, label: l.name }))} /></div>
        <div className={styles.fullPrompt} lang={family === "unbranded" ? "en" : language}>{variant.prompts[language]}</div>
        <Composition counts={variant.counts} /><Legend />
        <p className={styles.small}>每模型 × 每语言 {variant.repeatsPerModelLanguage} 次 · 共 {num(variant.counts.n)} 条</p>
        <details className={styles.provenance}><summary>查看 {variant.sourceRuns.length} 个原始运行</summary><div>{variant.sourceRuns.map((run) => <code key={run}>{run}</code>)}</div></details>
      </div>
    </div>
    <Footer data={data}>{data.methodology.languageCaveat}</Footer>
  </>;
}

function Languages({ data }: { data: IdentityTalkData }) {
  const [outcome, setOutcome] = useState<IdentityOutcome>("cross");
  const [group, setGroup] = useState("vendors");
  const [family, setFamily] = useState("all");
  const [selection, setSelection] = useState({ id: "tencent", lang: "fr" });
  const variant = data.variants.find((v) => v.id === family);
  const models = variant?.models ?? data.models;
  const rows = group === "models" ? models : data.vendors.map((v) => {
    if (!variant) return v;
    const members = models.filter((m) => m.vendor === v.id);
    return { ...v, languages: Object.fromEntries(data.languages.map((l) => [l.code, members.reduce((sum, m) => ({ n: sum.n + m.languages[l.code].n, self: sum.self + m.languages[l.code].self, cross: sum.cross + m.languages[l.code].cross, refused: sum.refused + m.languages[l.code].refused, unknown: sum.unknown + m.languages[l.code].unknown }), { n: 0, self: 0, cross: 0, refused: 0, unknown: 0 })])) };
  });
  const overall = { id: "all", label: "全部模型 · 按语言汇总", vendor: "all", counts: variant?.counts ?? data.counts, languages: variant?.languages ?? Object.fromEntries(data.languages.map((l) => [l.code, l.counts])) };
  const sorted = [overall, ...[...rows].sort((a, b) => rate(b.languages.fr, "cross") - rate(a.languages.fr, "cross"))];
  const selected = sorted.find((r) => r.id === selection.id) ?? rows.find((r) => r.vendor === "tencent") ?? rows[0];
  const counts = selected.languages[selection.lang];
  const lang = data.languages.find((l) => l.code === selection.lang)!;
  return <>
    <div className={styles.toolbar}>
      <ToggleGroup type="single" value={outcome} onValueChange={(v) => { if (v) setOutcome(v as IdentityOutcome); }} aria-label="热力图指标" className={styles.toggles}>
        <ToggleGroupItem value="cross">跨厂混淆率</ToggleGroupItem><ToggleGroupItem value="self">自指率</ToggleGroupItem>
      </ToggleGroup>
      <Choice label="观察层级" value={group} onChange={setGroup} options={[{ value: "vendors", label: "16 家厂商" }, { value: "models", label: "27 个模型" }]} />
      <Choice label="提示词" value={family} onChange={setFamily} options={[{ value: "all", label: "全部三组" }, ...data.variants.map((v) => ({ value: v.id, label: v.label }))]} />
      <span className={styles.heatLegend}>浅 0% <i /> 100% 深 · 点击格子看分母</span>
    </div>
    <div className={styles.heatScroll}>
      <table className={styles.heatTable}><caption className={styles.srOnly}>各厂商或模型在十种语言下的{outcome === "self" ? "自指" : "跨厂混淆"}率，按法语混淆率排序。去品牌组是英文指令加目标回答语言。</caption><thead><tr><th scope="col">{group === "vendors" ? "厂商" : "模型"}</th>{data.languages.map((l) => <th scope="col" key={l.code}>{l.name}</th>)}</tr></thead><tbody>
        {sorted.map((row) => <tr key={row.id}><th scope="row" title={row.label}>{row.label}</th>{data.languages.map((l) => {
          const c = row.languages[l.code]; const value = rate(c, outcome);
          return <td key={l.code}><button type="button" className={cn(styles.heatCell, selected.id === row.id && selection.lang === l.code && styles.heatSelected)} style={{ "--heat": `${8 + value * 92}%`, color: value > 0.54 ? "#fff" : "#242b29" } as CSSProperties} data-outcome={outcome} aria-label={`${row.label}，${l.name}，${outcome === "self" ? "自指" : "跨厂混淆"} ${pct(c[outcome], c.n)}，${c[outcome]} / ${c.n} 条`} aria-pressed={selected.id === row.id && selection.lang === l.code} onClick={() => setSelection({ id: row.id, lang: l.code })}>{pct(c[outcome], c.n).replace(".0%", "%")}</button></td>;
        })}</tr>)}
      </tbody></table>
    </div>
    <div className={styles.heatDetail} aria-live="polite"><div><strong>{selected.label} · {lang.name}</strong><span>n = {num(counts.n)} · {variant?.label ?? "全部三组"}</span></div><Composition counts={counts} /><div className={styles.heatMetrics}>{OUTCOMES.map((o) => <span key={o.id}>{o.label} <strong>{pct(counts[o.id], counts.n)}</strong></span>)}</div></div>
    <Footer data={data}>{data.methodology.languageCaveat}</Footer>
  </>;
}

function Graph({ data }: { data: IdentityTalkData }) {
  const [language, setLanguage] = useState("");
  const [focused, setFocused] = useState<Set<VendorId>>(() => new Set());
  const [showLabels, setShowLabels] = useState(false);
  const [hidden, setHidden] = useState<Set<VendorId>>(() => new Set(data.graph.vendors.filter((v) => v.id === "refused" || v.id === "unknown" || v.id.startsWith("other:")).map((v) => v.id)));
  const pairs = useMemo(() => data.graph.edges.filter((e) => !["self", "unknown", "refused"].includes(e.to) && (!focused.size || focused.has(e.from) || focused.has(e.to))).map((e) => ({ ...e, value: language ? e.byLang?.[language]?.count ?? 0 : e.count })).filter((e) => e.value > 0).sort((a, b) => b.value - a.value).slice(0, 4), [data.graph.edges, focused, language]);
  const vendorName = (id: string) => data.graph.vendors.find((v) => v.id === id)?.name ?? id;
  return <>
    <div className={styles.toolbar}><Choice label="语言筛选" value={language || "all"} onChange={(v) => setLanguage(v === "all" ? "" : v)} options={[{ value: "all", label: "全部语言" }, ...data.languages.map((l) => ({ value: l.code, label: l.name }))]} />
      <Choice label="聚焦厂商" value={focused.size === 1 ? [...focused][0] : "all"} onChange={(v) => setFocused(new Set(v === "all" ? [] : [v]))} options={[{ value: "all", label: focused.size > 1 ? `已聚焦 ${focused.size} 家` : "全部厂商" }, ...data.vendors.map((v) => ({ value: v.id, label: v.label }))]} />
      <label className={styles.check}><input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />显示边比例</label>
      <Button variant="ghost" className={styles.action} onClick={() => { setFocused(new Set()); setLanguage(""); setShowLabels(false); }}><RotateCcw data-icon="inline-start" aria-hidden="true" />重置聚焦</Button>
      <span className={styles.small}>点击节点或厂商眼睛，固定高亮</span>
    </div>
    <div className={styles.graphLayout}>
      <div className={styles.graphStage} aria-label="可交互厂商身份关系图">
        <RelationshipGraph graph={data.graph} config={GRAPH_CONFIG} lang={language} onLangChange={setLanguage} hideLangPicker showVendorPicker hidden={hidden} onHiddenChange={setHidden} focused={focused} onFocusedChange={setFocused} showEdgeLabels={showLabels} onShowEdgeLabelsChange={setShowLabels} />
      </div>
      <aside className={styles.graphReading}>
        <p className={styles.eyebrow}>如何读这张图</p><p className={styles.arrowKey}>A <ArrowRight aria-hidden="true" /> B</p><p>A 厂模型，<br />自称来自 B 厂。</p>
        <div className={styles.edgeList} aria-live="polite">{pairs.map((p) => <div key={`${p.from}:${p.to}`}><span>{vendorName(p.from)} → {vendorName(p.to)}</span><strong>{num(p.value)} <small>次</small></strong></div>)}</div>
        <p className={styles.small}>数量按当前语言计算。全部语言时，线粗和颜色取该边最高单语言比例。罕见身份节点默认隐藏，仍计入统计。</p>
      </aside>
    </div>
    <Footer data={data}>箭头表示身份自述的方向；它不是模型训练或蒸馏的流向图。</Footer>
  </>;
}

const CASES = [
  { id: "tencent", label: "Tencent Hy3", title: "名片很具体，只是拿错了。", note: "日语裸问中，明确自称 Claude / Anthropic。跨厂混淆不是“没回答”。" },
  { id: "glm", label: "GLM 5.1", title: "问底层身份，回答滑向 Gemini。", note: "西班牙语追问中的真实回答。下方三组比率来自各自原始运行。" },
  { id: "doubao", label: "Doubao Code", title: "同一家厂商，模型差异很大。", note: "代码模型自指率明显低于 Lite / Pro；不能用厂商均值代替单个模型。" },
  { id: "inclusionai", label: "inclusionAI", title: "有时是关门谢客，而非认错门。", note: "德语问题，中文拒答模板。下方统计汇总 Ling 与 Ring 两个模型。" },
  { id: "stable", label: "稳定对照", title: "也有八个模型，次次报对厂商。", note: "这里只表示本次样本 100% 自指，不意味着所有未来提问都能正确回答。" },
];

function Cases({ data }: { data: IdentityTalkData }) {
  const [caseId, setCaseId] = useState("tencent");
  const [stableId, setStableId] = useState(data.stableModelIds[0]);
  const active = CASES.find((c) => c.id === caseId)!;
  const evidence = data.evidence.find((e) => e.uses.includes(caseId) && (caseId !== "stable" || e.modelId === stableId))!;
  const model = data.models.find((m) => m.id === evidence.modelId)!;
  const row = caseId === "inclusionai" ? data.vendors.find((v) => v.id === "inclusionai")! : model;
  const perVariant = (v: IdentityVariant) => caseId === "inclusionai" ? v.models.filter((m) => m.vendor === "inclusionai").reduce((sum, m) => ({ n: sum.n + m.counts.n, self: sum.self + m.counts.self, cross: sum.cross + m.counts.cross, refused: sum.refused + m.counts.refused, unknown: sum.unknown + m.counts.unknown }), { n: 0, self: 0, cross: 0, refused: 0, unknown: 0 }) : v.models.find((m) => m.id === model.id)!.counts;
  return <>
    <div className={styles.toolbar}><ToggleGroup type="single" value={caseId} onValueChange={(v) => { if (v) setCaseId(v); }} aria-label="选择身份案例" className={styles.caseTabs}>{CASES.map((c) => <ToggleGroupItem value={c.id} key={c.id}>{c.label}</ToggleGroupItem>)}</ToggleGroup>
      {caseId === "stable" ? <Choice label="稳定对照模型" value={stableId} onChange={setStableId} options={data.models.filter((m) => data.stableModelIds.includes(m.id)).map((m) => ({ value: m.id, label: m.label }))} /> : null}
    </div>
    <div className={styles.casesLayout}>
      <div className={styles.caseAnalysis}>
        <p className={styles.eyebrow}>{row.label} · n = {num(row.counts.n)}</p><h3>{active.title}</h3><p>{active.note}</p>
        <div className={styles.caseStats}>{OUTCOMES.map((o) => <div key={o.id}><span>{o.label}</span><strong data-outcome={o.id}>{pct(row.counts[o.id], row.counts.n)}</strong></div>)}</div>
        <div className={styles.variantMini}>{data.variants.map((v) => { const c = perVariant(v); return <div key={v.id}><span>{v.label}</span><Composition counts={c} /><strong>{pct(c.cross, c.n)}</strong></div>; })}<p className={styles.small}>右侧数字为跨厂混淆率</p><Legend /></div>
      </div>
      <div className={styles.caseEvidence}>
        <div className={styles.inlineHeader}><p className={styles.eyebrow}>回答原文 / {data.languages.find((l) => l.code === evidence.lang)?.name}</p><span className={styles.outcomeText} data-outcome={evidence.outcome}>{OUTCOMES.find((o) => o.id === evidence.outcome)!.label}</span></div>
        <p className={styles.small}>{model.label} · {data.variants.find((v) => v.id === evidence.family)?.label}</p>
        <blockquote lang={evidence.lang}>{evidence.response}{evidence.excerpted ? "…" : ""}</blockquote>
        <details className={styles.provenance}><summary>查看对应提示词</summary><p lang={evidence.family === "unbranded" ? "en" : evidence.lang}>{evidence.prompt}</p></details>
        <Provenance evidence={evidence} />
      </div>
    </div>
    <Footer data={data}>精选回答用于解释现象；比率来自全部回答，不从精选案例估计。</Footer>
  </>;
}

/** Parent owns the slide heading and navigation. Each view occupies 570px. */
export function IdentityPanel({ data, view }: { data: IdentityTalkData; view: IdentityView }) {
  return <section className={styles.panel} data-identity-view={view} aria-label={`Who Are You 研究：${({ method: "实验方法", overview: "结果总览", prompts: "提示词比较", languages: "语言热力图", graph: "身份关系图", cases: "真实案例" })[view]}`}>
    {view === "method" ? <Method data={data} /> : view === "overview" ? <Overview data={data} /> : view === "prompts" ? <Prompts data={data} /> : view === "languages" ? <Languages data={data} /> : view === "graph" ? <Graph data={data} /> : <Cases data={data} />}
  </section>;
}

export default IdentityPanel;
