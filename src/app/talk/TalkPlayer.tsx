"use client";

import { Activity, Component, type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Check, Expand, ExternalLink, Grid2X2, Keyboard, Minimize, Pause, Play, RotateCcw, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHAPTERS, SLIDES, type TalkSlide } from "./story";
import { Challenge, ChapterCard, Closing, Cover, LoadingPanel, Observatory, Opening, PriceMethod, Reflection, UsageMethod, ValueMethod } from "./Narrative";
import type { IdentityTalkData, IdentityView } from "./identity/types";
import type { MbtiTalkData, MbtiView } from "./mbti/types";
import type { EconomicsView } from "./economics/types";
import styles from "./talk.module.css";

const IdentityPanel = dynamic(() => import("./identity/IdentityPanel").then(m => m.IdentityPanel), { loading: LoadingPanel });
const MbtiPanel = dynamic(() => import("./mbti/MbtiPanel").then(m => m.MbtiPanel), { loading: LoadingPanel });
const EconomicsPanel = dynamic(() => import("./economics/EconomicsPanel").then(m => m.EconomicsPanel), { loading: LoadingPanel });
const IdentityRelations = dynamic(() => import("./IdentityRelations").then(m => m.IdentityRelations), { loading: LoadingPanel });
const LOCATION_EVENT = "arena:talk-slide";
const FULL_BLEED = new Set(["cover", "opening", "chapter", "identity-end", "economics-end", "mbti-end", "closing"]);

function readIndex() {
  const index = SLIDES.findIndex(slide => slide.id === window.location.hash.slice(1));
  return index < 0 ? 0 : index;
}
function subscribeIndex(notify: () => void) {
  window.addEventListener(LOCATION_EVENT, notify);
  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);
  const initial = window.setTimeout(notify, 0);
  return () => { clearTimeout(initial); window.removeEventListener(LOCATION_EVENT, notify); window.removeEventListener("popstate", notify); window.removeEventListener("hashchange", notify); };
}

class ChartBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className={styles.loadingPanel} role="alert"><p>这张研究图表暂时未能展开。</p><span>可以重试，或继续下一页。原始研究入口仍然可用。</span><Button onClick={() => this.setState(({ attempt }) => ({ failed: false, attempt: attempt + 1 }))}>重新展开</Button></div>;
    return <div key={this.state.attempt} className={styles.boundary}>{this.props.children}</div>;
  }
}

function TalkClock() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running) return;
    const start = Date.now() - seconds * 1000;
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
    // Capture the elapsed time only when resuming; ticks must not restart the interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  return <div className={styles.clock}><Button variant="ghost" size="icon" onClick={() => setRunning(v => !v)} aria-label={running ? "暂停演讲计时" : "开始演讲计时"}>{running ? <Pause /> : <Play />}</Button><span aria-label={`演讲计时 ${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`}>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span><Button variant="ghost" size="icon" onClick={() => { setRunning(false); setSeconds(0); }} aria-label="重置演讲计时"><RotateCcw /></Button></div>;
}

export function TalkPlayer({ identity, mbti }: { identity: IdentityTalkData; mbti: MbtiTalkData }) {
  const index = useSyncExternalStore(subscribeIndex, readIndex, () => 0);
  const [visited, setVisited] = useState<number[]>([0]);
  const [overview, setOverview] = useState(false);
  const [notes, setNotes] = useState(false);
  const [help, setHelp] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState("");
  const [direction, setDirection] = useState(1);
  const stage = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const slide = SLIDES[index];
  const chapter = CHAPTERS.find(x => x.id === slide.chapter)!;
  const mounted = [...new Set([...visited, index])].sort((a, b) => a - b);

  const go = useCallback((next: number) => {
    const safe = Math.max(0, Math.min(SLIDES.length - 1, next));
    setDirection(safe >= index ? 1 : -1);
    setVisited(items => [...new Set([...items, index, safe])]);
    const url = new URL(window.location.href);
    url.hash = SLIDES[safe].id;
    window.history.pushState(null, "", url);
    window.dispatchEvent(new Event(LOCATION_EVENT));
    setOverview(false);
  }, [index]);
  const jump = useCallback((id: string) => go(Math.max(0, SLIDES.findIndex(x => x.id === id))), [go]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (!document.fullscreenEnabled) setMessage("当前内嵌浏览器未开放全屏。请在 Chrome 或 Safari 打开本页，再进入全屏。");
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else setMessage("当前浏览器未开放全屏。可以使用浏览器的「进入全屏」菜单。");
    } catch { setMessage("浏览器没有进入全屏。可以使用浏览器的「进入全屏」菜单。"); }
  }, []);

  useEffect(() => {
    const target = viewport.current;
    if (!target) return;
    const update = () => stage.current?.style.setProperty("--stage-scale", String(Math.min(target.clientWidth / 1440, target.clientHeight / 900)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const changed = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || overview || help) return;
      const target = event.target as HTMLElement;
      // Give controls, editable fields, chart sliders and menus their own keyboard semantics.
      if (target.closest("input,textarea,select,summary,[role='slider'],[role='tab'],[role='radio'],[role='checkbox'],[role='switch'],[role='menuitem'],[role='combobox'],[contenteditable='true'],[role='dialog']")) return;
      if (event.key === " " && target.closest("button,a")) return;
      if (["ArrowRight", "PageDown", " "].includes(event.key)) { event.preventDefault(); go(index + 1); }
      else if (["ArrowLeft", "PageUp"].includes(event.key)) { event.preventDefault(); go(index - 1); }
      else if (event.key === "Home") { event.preventDefault(); go(0); }
      else if (event.key === "End") { event.preventDefault(); go(SLIDES.length - 1); }
      else if (event.key.toLowerCase() === "f") void toggleFullscreen();
      else if (event.key.toLowerCase() === "g") setOverview(true);
      else if (event.key.toLowerCase() === "n") setNotes(v => !v);
      else if (event.key === "?") setHelp(true);
      else if (event.key === "Escape") setNotes(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [go, help, index, overview, toggleFullscreen]);

  function content(item: TalkSlide) {
    switch (item.kind) {
      case "cover": return <Cover onStart={() => go(1)} />;
      case "opening": return <Opening onJump={jump} />;
      case "observatory": return <Observatory />;
      case "chapter": return <ChapterCard slide={item} />;
      case "identity": return <IdentityPanel data={identity} view={item.view as IdentityView} />;
      case "identity-relations": return <IdentityRelations data={identity} />;
      case "mbti": return <MbtiPanel data={mbti} view={item.view as MbtiView} />;
      case "economics": return <EconomicsPanel view={item.view as EconomicsView} />;
      case "usage-formula": return <UsageMethod />;
      case "price-formula": return <PriceMethod />;
      case "value-formula": return <ValueMethod />;
      case "challenge": return <Challenge />;
      case "closing": return <Closing onJump={jump} />;
      default: return <Reflection slide={item} />;
    }
  }

  return <div ref={viewport} className={styles.viewport} lang="zh-CN">
    <div ref={stage} className={cn(styles.stage, slide.kind === "chapter" && styles.darkStage)} style={{ "--chapter-accent": chapter.color, "--slide-direction": direction } as CSSProperties}>
      <header className={styles.topbar}><Link href="/" aria-label="返回 ZenMux Arena" className={styles.brand}><Image src={slide.kind === "chapter" ? "/maker-logo/ZenMux.png" : "/maker-logo/ZenMux-Light.png"} width={90} height={25} alt="ZenMux" style={{ height: "auto" }} unoptimized /><span>ARENA</span></Link><span className={styles.topbarTitle}>如果 Token 会说话</span><Button variant="ghost" onClick={() => setOverview(true)} className={styles.chapterButton} aria-label="打开章节总览"><span>{chapter.number}</span> {chapter.english}<Grid2X2 data-icon="inline-end" /></Button></header>
      <main className={styles.main} aria-label="演讲舞台" tabIndex={-1}>
        {mounted.map(i => <Activity key={SLIDES[i].id} mode={i === index ? "visible" : "hidden"}><article className={cn(styles.slide, FULL_BLEED.has(SLIDES[i].kind) && styles.fullBleed)} data-slide={SLIDES[i].id} aria-label={`${i + 1} / ${SLIDES.length}：${SLIDES[i].title}`}>
          {!FULL_BLEED.has(SLIDES[i].kind) && <div className={styles.slideHeading}><div><h1>{SLIDES[i].title}</h1><p>{SLIDES[i].subtitle}</p></div><span className={styles.figureIndex}>FIG. {String(i).padStart(2, "0")}</span></div>}
          <div className={styles.slideBody}><ChartBoundary>{content(SLIDES[i])}</ChartBoundary></div>
        </article></Activity>)}
      </main>
      <footer className={styles.footer}><div className={styles.footerUpper}><span className={styles.cue}>{slide.cue ?? "按 →，继续倾听"}</span><div className={styles.footerTools}>{slide.source && <Button variant="ghost" size="icon" asChild><a href={slide.source} target="_blank" rel="noreferrer" aria-label="打开本页研究来源"><ExternalLink /></a></Button>}<Button variant="ghost" size="icon" onClick={() => setNotes(v => !v)} aria-label="讲者备注" aria-pressed={notes}><BookOpen /></Button><Button variant="ghost" size="icon" onClick={() => setHelp(true)} aria-label="快捷键与资料"><Keyboard /></Button><Button variant="ghost" size="icon" onClick={toggleFullscreen} aria-label={fullscreen ? "退出全屏" : "进入全屏"}>{fullscreen ? <Minimize /> : <Expand />}</Button><span className={styles.toolDivider} /><Button variant="ghost" size="icon" onClick={() => go(index - 1)} disabled={index === 0} aria-label="上一页"><ArrowLeft /></Button><span className={styles.pageCounter}>{String(index + 1).padStart(2, "0")} <small>/ {SLIDES.length}</small></span><Button variant="ghost" size="icon" onClick={() => go(index + 1)} disabled={index === SLIDES.length - 1} aria-label="下一页"><ArrowRight /></Button></div></div><div className={styles.progress} aria-label="演讲页面导航">{SLIDES.map((item, i) => <button key={item.id} onClick={() => go(i)} aria-label={`跳转至第 ${i + 1} 页：${item.title.replaceAll("\n", "")}`} aria-current={i === index ? "step" : undefined} className={cn(styles.progressStep, i <= index && styles.progressDone, i === index && styles.progressCurrent)} title={`${i + 1}. ${item.title.replaceAll("\n", "")}`} />)}</div></footer>
      <aside hidden={!notes} className={styles.notes} aria-label="讲者备注面板"><div className={styles.notesHeader}><p>讲者备注 <small>此面板会显示在投屏中</small></p><Button variant="ghost" size="icon" onClick={() => setNotes(false)} aria-label="关闭讲者备注"><X /></Button></div><h2>{slide.title.replaceAll("\n", "")}</h2><p className={styles.noteText}>{slide.note}</p><div className={styles.notesBottom}><TalkClock /><span>下一页：{SLIDES[index + 1]?.title.replaceAll("\n", "") ?? "演讲结束"}</span></div></aside>
      {message && <div className={styles.toast} role="status"><span>{message}</span><Button variant="ghost" size="icon" onClick={() => setMessage("")} aria-label="关闭提示"><X /></Button></div>}
      <div className="sr-only" aria-live="polite" aria-atomic="true">第 {index + 1} 页，共 {SLIDES.length} 页。{slide.title.replaceAll("\n", "")}</div>
    </div>
    <Dialog open={overview} onOpenChange={setOverview}><DialogContent className={styles.overviewDialog}><DialogHeader><DialogTitle className={styles.dialogTitle}>从哪里，开始倾听？</DialogTitle><DialogDescription>按章节跳转。图表保留本次访问中的互动状态。</DialogDescription></DialogHeader><div className={styles.chapterGrid}>{CHAPTERS.map(ch => <section key={ch.id}><h2 style={{ color: ch.color }}><span>{ch.number}</span>{ch.title}</h2>{SLIDES.map((item, i) => item.chapter === ch.id && <button key={item.id} onClick={() => go(i)} className={cn(styles.overviewSlide, i === index && styles.overviewCurrent)}><span>{String(i + 1).padStart(2, "0")}</span><p>{item.title.replaceAll("\n", "")}</p>{i === index && <Check size={14} />}</button>)}</section>)}</div></DialogContent></Dialog>
    <Dialog open={help} onOpenChange={setHelp}><DialogContent className={styles.helpDialog}><DialogHeader><DialogTitle className={styles.dialogTitle}>像 PPT 一样讲，像网页一样探索。</DialogTitle><DialogDescription>所有研究图表都可以点击。数据查询与翻页独立运行。</DialogDescription></DialogHeader><div className={styles.shortcuts}>{[["← / →", "上一页 / 下一页"], ["Space / PageDown", "继续下一页"], ["Home / End", "开场 / 结束"], ["G", "章节总览"], ["F", "进入 / 退出全屏"], ["N", "讲者备注（投屏可见）"], ["?", "打开帮助"]].map(([key, label]) => <div key={key}><kbd>{key}</kbd><span>{label}</span></div>)}</div><div className={styles.helpSources}><h3>资料与口径</h3><p>身份研究：2026 年 5–6 月，29,700 条回答的固定快照。经济学与 Deals：在线接口，页面显示实际数据截止时间；不会用演示数据替代失败请求。OEJTS：2026-09-11 批次，27 款模型、432 份有效问卷。</p><p>OEJTS 1.2 © Open-Source Psychometrics Project · CC BY-NC-SA 4.0。题目与计分保留原始署名与许可；结果是 MBTI 风格画像，不是官方 MBTI® 认证。</p><a href="https://openpsychometrics.org/tests/OJTS/development/" target="_blank" rel="noreferrer">OEJTS 量表来源 <ExternalLink size={13} /></a><a href="https://github.com/ZenMux/zenmux-arena" target="_blank" rel="noreferrer">研究代码与原始数据 <ExternalLink size={13} /></a><a href="https://tv.cctv.com/2018/07/17/ARTIt9MmAXFLY4G9Y74huYpC180717.shtml" target="_blank" rel="noreferrer">标题灵感：《如果国宝会说话》 <ExternalLink size={13} /></a></div></DialogContent></Dialog>
  </div>;
}
