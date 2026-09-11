"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { EconomicsResponse, EconomicsView } from "./types";
import { deepSeekChallengeHistory } from "./history";
import styles from "./economics.module.css";

const ValueMap = dynamic(() => import("../../token-economics/ValueMap").then((m) => m.ValueMap), { loading: PanelLoading });
const ValueByVendor = dynamic(() => import("../../token-economics/ValueByVendor").then((m) => m.ValueByVendor), { loading: PanelLoading });
const LiveLeaderboard = dynamic(() => import("../../token-economics/LiveLeaderboard").then((m) => m.LiveLeaderboard), { loading: PanelLoading });
const DealsPanel = dynamic(() => import("./DealsPanel"), { loading: PanelLoading });

export interface EconomicsPanelProps {
  view: EconomicsView;
}

/** Mount only the active slide. No data requests or chart imports on the cover. */
export function EconomicsPanel({ view }: EconomicsPanelProps) {
  return (
    <div className={styles.panel} data-economics-view={view}>
      {view === "map" || view === "ladder" ? <ValuePanel view={view} /> : null}
      {view === "live" ? (
        <>
          <p className={styles.method}>回看 2026 年 6 月 23 日—8 月 23 日：开发者实际把 Token 投给了谁？切换逐日 / 累计、Token / Cost，查看这段时间的结果。</p>
          <div className={styles.live}><LiveLeaderboard presentation historicalData={deepSeekChallengeHistory} /></div>
        </>
      ) : null}
      {view === "deals" ? <DealsPanel /> : null}
    </div>
  );
}

// Reuse within this client session when returning to the adjacent map/ladder
// slides. This is never presented as a new fetch or as live billing coverage.
let lastResult: EconomicsResponse | null = null;

function ValuePanel({ view }: { view: "map" | "ladder" }) {
  const [result, setResult] = useState<EconomicsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      try {
        if (lastResult && attempt === 0) {
          setResult(lastResult);
          setLoading(false);
          return;
        }
        const response = await fetch("/talk/economics/data", {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35_000)]),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || `读取失败（${response.status}）`);
        if (!body.data?.models || !body.provenance) throw new Error("数据格式不可用，请重试。");
        if (!active) return;
        lastResult = body as EconomicsResponse;
        setResult(lastResult);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error && err.name !== "TimeoutError" ? err.message : "数据读取超时，请重试。");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [attempt]);

  const retry = () => { setLoading(true); setError(null); setAttempt((n) => n + 1); };
  const plottable = result?.data.models.some((m) => (m.avgDailyPerDollar ?? 0) > 0);
  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.method}>
          <strong>{view === "map" ? "贵，不一定没人用。便宜，也不等于被选择。" : "Value = 日用量 ÷ 标准调用价格"}</strong>
          <span>100K 输入 + 1K 输出 · 发布后 14 个工作日，取有用量日的中位数 · 非能力评分</span>
        </p>
        <Button variant="outline" onClick={retry} disabled={loading}>
          <RefreshCw data-icon="inline-start" aria-hidden="true" />{loading ? "读取中…" : "刷新数据"}
        </Button>
      </div>
      {error ? <p className={styles.warning} role="alert">{error}{result ? " 当前仍展示上次成功读取的数据。" : ""}</p> : null}
      {!result && loading ? <PanelLoading /> : null}
      {result && plottable ? (
        <div className={cn(styles.value, view === "map" ? styles.map : styles.ladder)}>
          {view === "map" ? <ValueMap data={result.data} presentation /> : <ValueByVendor data={result.data} presentation />}
        </div>
      ) : result ? (
        <div className={styles.empty} role="status">
          <strong>发布窗口用量暂不可用</strong>
          <p>{result.provenance.managementConfigured ? "当前未获得可绘制的用量观测，请稍后重试。" : "服务端尚未配置管理接口访问，暂时只有模型价格数据。"}</p>
          <Button onClick={retry} disabled={loading}>重试发布窗口数据</Button>
        </div>
      ) : null}
      {result ? (
        <footer className={styles.provenance}>
          <a href={result.data.source} target="_blank" rel="noreferrer">来源：ZenMux 模型列表</a>
          <span>价格读取 <time dateTime={result.provenance.listingRetrievedAt}>{utcStamp(result.provenance.listingRetrievedAt)}</time></span>
          <span>发布窗口缓存 24h · {result.provenance.observedModels}/{result.provenance.requestedModels} 个模型有日序列</span>
          <span>各模型按自身发布窗口统计；最晚观测日 {result.provenance.latestObservedUsageDate ?? "未报告"}，非全体统一截止</span>
          {result.provenance.observedModels < result.provenance.requestedModels ? <span>缺失序列可能是零用量或请求失败；不据此断言零需求。</span> : null}
        </footer>
      ) : null}
    </>
  );
}

export function utcStamp(value: string) {
  return Number.isNaN(Date.parse(value)) ? "未报告" : value.replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

function PanelLoading() {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <span>正在读取真实数据…</span>
      <Skeleton className="h-5 w-72" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default EconomicsPanel;
