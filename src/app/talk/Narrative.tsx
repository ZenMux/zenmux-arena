"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import katex from "katex";
import { ArrowDown, ArrowRight, Check, ExternalLink, GitBranch, MessageCircle, MousePointer2, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { CHAPTERS, type TalkSlide } from "./story";
import styles from "./talk.module.css";

const MARKS = [
  ["claude_color.svg", "Claude"], ["chatgpt_color.svg", "OpenAI"],
  ["gemini_color.svg", "Gemini"], ["deepeek_color.svg", "DeepSeek"],
  ["qwen_color.svg", "Qwen"], ["kimi_color.svg", "Kimi"],
  ["minimax_color.svg", "MiniMax"], ["doubao_color.svg", "Doubao"],
] as const;

export function Formula({ tex, small = false }: { tex: string; small?: boolean }) {
  const html = useMemo(() => katex.renderToString(tex, { displayMode: true, throwOnError: false, trust: false, output: "htmlAndMathml" }), [tex]);
  return <div className={cn(styles.formula, small && styles.formulaSmall)} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Cover({ onStart }: { onStart: () => void }) {
  return <div className={styles.cover}>
    <div className={styles.coverCopy}>
      <p className={styles.eyebrow}>ZENMUX ARENA · A LIVING RESEARCH TALK</p>
      <h1 className={styles.coverTitle}>如果 <span>Token</span><br />会说话<span className={styles.titleDot}>。</span></h1>
      <p className={styles.coverEnglish}>If tokens could talk.</p>
      <div className={styles.coverLine} />
      <p className={styles.coverSubtitle}>一些关于身份、性格与选择的观察</p>
      <a className={styles.author} href="https://thinkthinking.ai/" target="_blank" rel="noreferrer"><span className={styles.authorMark}>t.</span><span><strong>thinkthinking</strong><small>ZenMuxAI & AgentOS 联合创始人 · 产品负责人</small></span></a>
      <Button onClick={onStart} className={styles.startButton}>开始倾听 <ArrowRight data-icon="inline-end" /></Button>
    </div>
    <div className={styles.specimen} aria-label="八个模型围绕着同一枚 Token，象征三个研究的共同起点">
      <div className={styles.specimenRing} /><div className={styles.specimenRingInner} />
      <div className={styles.tokenObject}><Quote aria-hidden="true" /><span>token</span><small>一枚小小的回声</small></div>
      {MARKS.map(([file, name], i) => <div key={name} className={styles.orbitMark} style={{ left: `${50 + 42 * Math.cos((i * Math.PI) / 4 - Math.PI / 2)}%`, top: `${47 + 42 * Math.sin((i * Math.PI) / 4 - Math.PI / 2)}%` }}><Image src={`/model-logo/${file}`} width={44} height={44} alt={name} unoptimized /><span>{name}</span></div>)}
      <span className={styles.specimenCaption}>FIG. 00 &nbsp; THE SMALLEST WITNESS</span>
    </div>
    <p className={styles.coverFootnote}>灵感致意《如果国宝会说话》 &nbsp; / &nbsp; 研究、图表与故事来自 ZenMux Arena</p>
  </div>;
}

export function Opening({ onJump }: { onJump: (id: string) => void }) {
  const [active, setActive] = useState(0);
  const entries = [
    { number: "01", text: "你是谁？", answer: "有时，我会递出别人的名片。", chapter: "identity", label: "身份的回声" },
    { number: "02", text: "你是什么性格？", answer: "问我十六次，再看看回答的习惯。", chapter: "personality", label: "回答的习惯" },
    { number: "03", text: "选择了谁？", answer: "答案，留在每一次真实调用里。", chapter: "economics", label: "市场的选择" },
  ];
  return <div className={styles.opening}>
    <div className={styles.openingText}><p className={styles.eyebrow}>THREE QUESTIONS · ONE OBSERVATORY</p><h1>每一次生成，<br />都会留下痕迹。</h1><p>一句自我介绍，一份反复填写的问卷，<br />一次真实调用。</p><span className={styles.smallNote}>Token 是文本处理与生成的基本单位，不总等于一个字或一个词。</span></div>
    <div className={styles.questionStack}>{entries.map((entry, i) => <button key={entry.number} className={cn(styles.questionTile, active === i && styles.questionActive)} onClick={() => setActive(i)} aria-pressed={active === i}><span>{entry.number} / {entry.label}</span><strong>{entry.text}</strong>{active === i && <p>{entry.answer}</p>}<MessageCircle aria-hidden="true" /></button>)}<Button variant="ghost" className={styles.textButton} onClick={() => onJump(entries[active].chapter)}>进入这一章 <ArrowRight data-icon="inline-end" /></Button></div>
  </div>;
}

export function Observatory() {
  return <div className={styles.observatory}>
    <div className={styles.observatoryHub}><p className={styles.eyebrow}>A SHARED WINDOW</p><Image src="/maker-logo/ZenMux-Light.png" width={248} height={65} alt="ZenMux" style={{ height: "auto" }} unoptimized /><p>让不同模型，在同一个地方相遇。</p><div className={styles.logoRow}>{MARKS.map(([file, name]) => <Image key={name} src={`/model-logo/${file}`} width={37} height={37} alt={name} unoptimized />)}</div><a href="https://zenmux.ai" target="_blank" rel="noreferrer">zenmux.ai <ExternalLink size={14} /></a></div>
    <div className={styles.observationList}>{[
      ["01", "主动提问", "同一套实验，观察不同模型怎样介绍自己。", "Who Are You?"],
      ["02", "重复测量", "在固定问卷里，观察回答模式能否复现。", "OEJTS Personality"],
      ["03", "真实选择", "从真实调用的结果，看 Token 最后投给了谁。", "Token Economics / Deals"],
    ].map(([n, title, description, english]) => <div key={n}><span>{n}</span><section><small>{english}</small><h2>{title}</h2><p>{description}</p></section></div>)}<p className={styles.scopeNote}>一个平台的观察窗口。所有结论都带着模型版本、时间与实验条件。</p></div>
  </div>;
}

export function ChapterCard({ slide }: { slide: TalkSlide }) {
  const number = CHAPTERS.find(chapter => chapter.id === slide.chapter)!.number;
  const english = slide.chapter === "identity" ? "THE ECHO OF IDENTITY" : slide.chapter === "economics" ? "THE RECORD OF A CHOICE" : "THE PATTERN OF AN ANSWER";
  return <div className={styles.chapterCard}><div className={styles.chapterNumber} aria-hidden="true">{number}</div><p className={styles.eyebrow}>CHAPTER {number} &nbsp; / &nbsp; {english}</p><h1>{slide.title.split("\n").map((line, i) => <span key={i}>{line}<br /></span>)}</h1><p className={styles.chapterSubtitle}>{slide.subtitle}</p><span className={styles.chapterRule} /><span className={styles.chapterEnd}>FROM ZENMUX, WITH CURIOSITY.</span></div>;
}

const DAYS = [12, 18, 16, 23, 0, 0, 20, 17, 21, 19, 24, 0, 0, 22, 15, 20, 18, 25];
export function UsageMethod() {
  const [spike, setSpike] = useState(false);
  const days = DAYS.map((v, i) => i === 0 && spike ? 94 : v);
  const sorted = days.filter(v => v > 0).toSorted((a, b) => a - b);
  const median = (sorted[6] + sorted[7]) / 2;
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return <div className={styles.formulaLayout}>
    <div className={styles.methodExplanation}><p className={styles.eyebrow}>01 / NORMALIZE USAGE</p><Formula tex={String.raw`W_m = \operatorname{First}_{14}\{d \ge r_m\mid d\in\mathcal B\}`} small /><p>从发布日开始，取前 <b>14 个工作日</b>。<br />周末不计入窗口。</p><Formula tex={String.raw`A_m=\{d\in W_m\mid x_{m,d}>0\}`} small /><Formula tex={String.raw`U_m=\begin{cases}\operatorname{median}_{d\in A_m}x_{m,d},&|A_m|>0\\0,&|A_m|=0\end{cases}`} small /><p className={styles.smallNote}>r：发布日 · B：工作日 · x：当日 Token 用量<br />只在固定窗口内，取有实际用量日的中位数。</p></div>
    <div className={styles.methodDemo}><div className={styles.demoTop}><span>发布早期的典型一天</span><span className={styles.demoLabel}>方法演示 · 非实际模型数据</span></div><div className={styles.dayChart}>{days.map((v, i) => <div key={i} className={styles.dayBarSlot}><span className={styles.dayBar} style={{ height: `${v * 2.45}px`, background: i === 0 && spike ? "#bb743e" : undefined }} /><small>{v === 0 ? "休" : i + 1}</small></div>)}</div><div className={styles.demoStats}><div><small>中位数</small><strong>{median.toFixed(1)}<em>M / day</em></strong></div><div><small>平均数</small><strong>{mean.toFixed(1)}<em>M / day</em></strong></div></div><Button variant="outline" onClick={() => setSpike(v => !v)} aria-pressed={spike} className={styles.demoButton}>{spike ? "移除首日尖峰" : "加入首日尖峰"}<ArrowRight data-icon="inline-end" /></Button><p className={styles.smallNote}>上线第一天的热闹，不应定义每一个普通工作日。</p></div>
  </div>;
}

export function PriceMethod() {
  const [inputK, setInputK] = useState(100);
  const [inputPrice, setInputPrice] = useState(1);
  const cost = inputK / 1000 * inputPrice + .001 * 5;
  return <div className={styles.priceLayout}>
    <div className={styles.priceStatement}><p className={styles.eyebrow}>02 / NORMALIZE PRICE</p><div className={styles.basketNumbers}><span>100<small>K input</small></span><b>+</b><span>1<small>K output</small></span></div><p>文章中观察到的 Coding / Agent 调用结构，<br />约为 <strong>100 : 1</strong>。</p><Formula tex={String.raw`P_m = 0.1p_m^{\mathrm{in}} + 0.001p_m^{\mathrm{out}}`} /><p className={styles.smallNote}>p 的单位：$/1M tokens；P 的单位：$/标准篮子。<br />基础篮子不包含缓存命中折扣；100:1 不代表所有场景。</p></div>
    <div className={styles.calculator}><div className={styles.demoTop}><span>换一种工作流</span><span className={styles.demoLabel}>教学计算器 · 假设报价</span></div><label className={styles.sliderLabel}>输入 / 输出比 <strong>{inputK} : 1</strong></label><Slider aria-label="输入输出 Token 比例" value={[inputK]} min={1} max={200} step={1} onValueChange={([v]) => setInputK(v)} /><div className={styles.sliderTicks}><span>轻对话 1 : 1</span><span>重上下文 200 : 1</span></div><label className={styles.sliderLabel}>输入报价 <strong>${inputPrice.toFixed(2)} / M</strong></label><Slider aria-label="假设输入单价" value={[inputPrice]} min={.1} max={5} step={.1} onValueChange={([v]) => setInputPrice(v)} /><p className={styles.smallNote}>输出固定 1K tokens，假设报价 $5 / M。</p><div className={styles.calculatorTotal}><small>这一篮子的成本</small><strong>${cost.toFixed(4)}</strong><span>{inputK}K input + 1K output</span></div><Button variant="ghost" onClick={() => { setInputK(100); setInputPrice(1); }}>回到标准篮子</Button><p className={styles.smallNote}>此处仅改变演示计算，研究图表仍采用标准 100 : 1。</p></div>
  </div>;
}

export function ValueMethod() {
  const examples = [
    { name: "低价，也被大量使用", usage: 100, price: .02, text: "低价格 + 高用量", type: "value play" },
    { name: "昂贵，仍然被选择", usage: 200, price: .2, text: "高价格 + 高用量", type: "premium demand" },
    { name: "很便宜，暂时少人用", usage: 1, price: .02, text: "低价格 + 低用量", type: "emerging demand" },
  ];
  const [selected, setSelected] = useState(0);
  const example = examples[selected];
  return <div className={styles.valueMethod}><div><p className={styles.eyebrow}>03 / READ PRICE AND DEMAND TOGETHER</p><Formula tex={String.raw`V_m = \frac{U_m}{P_m}`} /><p className={styles.valueDefinition}>真实日用量 ÷ 标准篮子成本</p><p className={styles.smallNote}>tokens / ($ · day)<br />研究定义的比值，用来一起观察价格和使用。<br />它不等于能力评分，也不等于一美元能买到的 Token 数。</p></div><div className={styles.valueExamples}><p className={styles.demoLabel}>方法演示 · 非实际模型排名</p><div className={styles.exampleChoices}>{examples.map((x, i) => <Button key={x.name} variant={selected === i ? "default" : "outline"} onClick={() => setSelected(i)} aria-pressed={selected === i}>{x.name}</Button>)}</div><div className={styles.valueEquation}><span>{example.usage}M<small>tokens / day</small></span><b>÷</b><span>${example.price}<small>每标准篮子</small></span><b>=</b><span>{(example.usage / example.price).toLocaleString()}M<small>tokens / ($ · day)</small></span></div><p className={styles.valueExampleTitle}>{example.text}</p><p className={styles.valueExampleEnglish}>{example.type}</p><p>真正值得观察的是：<br /><strong>用户愿意持续把多少 Token 投给它。</strong></p></div></div>;
}

const HISTORIC_PRICES = [
  { name: "Qwen3.7 Max", price: .2575, logo: "qwen_color.svg" },
  { name: "GLM 5.2", price: .1444, logo: "zai_color.svg" },
  { name: "Kimi K2.7 Code", price: .099, logo: "kimi_color.svg" },
  { name: "Qwen3.7 Plus", price: .0416, logo: "qwen_color.svg" },
  { name: "MiniMax M3", price: .0312, logo: "minimax_color.svg" },
];

export function Challenge() {
  const [selected, setSelected] = useState(0);
  const model = HISTORIC_PRICES[selected];
  const anchor = model.price > .04437 ? .04437 : model.price > .01428 ? .01428 : model.price;
  const pro = model.price > .04437;
  return <div className={styles.challengeLayout}><div className={styles.challengeList}><p className={styles.eyebrow}>THE DEEPSEEK ANCHOR CHALLENGE</p><p>选一个模型，看看它的价格落向哪里。</p>{HISTORIC_PRICES.map((item, i) => <button key={item.name} className={cn(styles.challengeModel, selected === i && styles.challengeSelected)} onClick={() => setSelected(i)} aria-pressed={selected === i}><Image src={`/model-logo/${item.logo}`} width={30} height={30} alt="" unoptimized /><span>{item.name}</span><small>${item.price.toFixed(4)}</small><ArrowRight size={16} /></button>)}</div><div className={styles.anchorExperiment}><div className={styles.demoTop}><span>标准篮子成本的变化</span><span className={styles.demoLabel}>文章实验快照 · 非当前报价</span></div><div className={styles.anchorPrices}><div><small>原价格</small><strong>${model.price.toFixed(4)}</strong></div><ArrowRight size={34} /><div><small>对齐 DeepSeek V4 {pro ? "Pro" : "Flash"}</small><strong>${anchor.toFixed(5)}</strong></div></div><div className={styles.priceReduction}>−{((1 - anchor / model.price) * 100).toFixed(1)}<span>%</span></div><p>把价格尽量压平，<br /><strong>然后，观察真实选择。</strong></p><div className={styles.anchorRules}><span><Check size={15} /> 高于 Pro → 对齐 Pro</span><span><Check size={15} /> Flash 与 Pro 之间 → 对齐 Flash</span><span><Check size={15} /> 低于 Flash → 保持原价</span></div><p className={styles.smallNote}>模型能力、工具生态、用户群与时间仍不同；这不是随机对照实验。</p></div></div>;
}

export function Reflection({ slide }: { slide: TalkSlide }) {
  const lines = slide.title.split("\n");
  const annotations = slide.kind === "identity-end" ? [
    ["观察", "跨厂混淆有方向，也受语言与问法影响。"],
    ["解释", "公开语料、合成数据和产品包装，都可能留下身份模板。"],
    ["边界", "2026 年 5–6 月的快照；身份自述不能证明蒸馏关系。"],
  ] : slide.kind === "economics-end" ? [
    ["低价", "更低的进入门槛，还需要真正被使用。"],
    ["溢价", "更高的价格，也可以伴随持续的真实需求。"],
    ["边界", "ZenMux 平台观测；用量不是能力分数，也不是全网份额。"],
  ] : [
    ["测到了", "固定英文问卷与本轮参数下，重复出现的自我描述。"],
    ["未排除", "缓存、单一措辞与固定题序，对重复结果的影响。"],
    ["下一步", "用保持语义的提示词扰动与缓存对照，再检验画像是否仍然稳定。"],
  ];
  return <div className={styles.reflection}><Quote className={styles.reflectionQuote} aria-hidden="true" /><h1>{lines.map(line => <span key={line}>{line}<br /></span>)}</h1><p className={styles.reflectionSubtitle}>{slide.subtitle}</p><div className={styles.reflectionNotes}>{annotations.map(([label, text]) => <div key={label}><small>{label}</small><p>{text}</p></div>)}</div>{slide.kind === "identity-end" && <p className={styles.cacheNote}>关于缓存：Prompt / KV 缓存复用输入计算，不等于复用整段生成答案；本研究没有验证响应缓存对分布的影响。</p>}{slide.kind === "mbti-end" && <p className={styles.cacheNote}>缓存仍是待排除项：后续记录缓存命中信息，并用提示词扰动与必要的绕缓存对照比较分布。Prompt / KV 缓存不等于复用整段答案；本轮未验证其影响。</p>}</div>;
}

export function Closing({ onJump }: { onJump: (id: string) => void }) {
  return <div className={styles.closing}><p className={styles.eyebrow}>THE CONVERSATION CONTINUES</p><h1>如果 Token 会说话，<br />我们愿意继续听<span>。</span></h1><p>名字里的回声，回答中的习惯，账单上的选择。</p><div className={styles.closingLinks}>{[
    ["01", "身份关系图", "/who-are-you/studio?run=who-are-you/mix-20260601T062425", "把每一条线，点开看看。"],
    ["02", "模型人格图谱", "#mbti-explorer", "比起标签，更值得看的是过程。"],
    ["03", "Token 经济学", "#live", "回看这段时间，Token 投给了谁。"],
  ].map(([n, title, href, desc]) => <a key={n} href={href} target={href.startsWith("#") ? undefined : "_blank"} rel="noreferrer" onClick={href.startsWith("#") ? e => { e.preventDefault(); onJump(href.slice(1)); } : undefined}><span>{n}</span><h2>{title}<ArrowRight size={22} /></h2><p>{desc}</p></a>)}</div><div className={styles.closingFooter}><span><strong>thinkthinking</strong><small>Ideas Worth Spreading.</small></span><a href="https://github.com/ZenMux/zenmux-arena" target="_blank" rel="noreferrer"><GitBranch size={18} /> 源码、研究与原始数据 <ExternalLink size={14} /></a></div></div>;
}

export function LoadingPanel() {
  return <div className={styles.loadingPanel} role="status"><MousePointer2 size={26} /><p>正在展开研究图表…</p><span>你可以继续翻页，或稍后回来。</span><ArrowDown size={17} /></div>;
}
