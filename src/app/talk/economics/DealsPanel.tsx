"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VendorGlyph } from "../../token-economics/components";
import { useDealsFeed } from "../../token-deals/useDealsFeed";
import { DealTrendPanel } from "../../token-deals/ladder/DealTrendPanel";
import { SegmentedControl } from "../../token-deals/SegmentedControl";
import { DEAL_FILTER_OPTIONS, matchesDealFilter, percentOff, usdGrouped, type DealFilter } from "../../token-deals/lib";
import type { DealSeries } from "@research/token-deals/types";
import styles from "./economics.module.css";

type BillingScope = "total" | "payg" | "subscription";
const BILLING_OPTIONS = [
  { key: "total", label: "合计", title: "全部让利金额" },
  { key: "payg", label: "PAYG", title: "按量实际账单折扣" },
  { key: "subscription", label: "订阅", title: "订阅原价额度按同期供应商折扣换算" },
] as const;

function savedFor(deal: DealSeries, scope: BillingScope): number | null {
  if (!deal.stats) return null;
  if (scope === "total") return deal.stats.saved;
  return scope === "payg" ? deal.stats.saved - deal.stats.subSaved : deal.stats.subSaved;
}

// Money is additive and explicitly split in the canonical ledger. Token counts
// are not split on the wire: retain them and label them as BOTH families.
function scopeDeal(deal: DealSeries, scope: BillingScope): DealSeries {
  if (scope === "total") return deal;
  const money = <T extends { saved: number; paid: number; subSaved: number; subPaid: number }>(item: T): T => ({
    ...item,
    saved: scope === "payg" ? item.saved - item.subSaved : item.subSaved,
    paid: scope === "payg" ? item.paid - item.subPaid : item.subPaid,
  });
  return { ...deal, stats: deal.stats ? money(deal.stats) : null, points: deal.points?.map(money) ?? null };
}

export default function DealsPanel() {
  const { data, loading, error, refreshing, degraded, retry } = useDealsFeed();
  const [filter, setFilter] = useState<DealFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [billingScope, setBillingScope] = useState<BillingScope>("total");
  const deals = useMemo(() => [...(data?.deals ?? [])]
    .filter((deal) => matchesDealFilter(deal, filter))
    .sort((a, b) => (savedFor(b, billingScope) ?? -1) - (savedFor(a, billingScope) ?? -1)), [data?.deals, filter, billingScope]);
  const selected = deals.find((deal) => deal.id === selectedId) ?? deals[0];
  const totals = data?.live ? data.totals : null;

  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.method}><strong>降价是一个比例，让利是一笔真实账。</strong><span>优惠深度看折扣；让利金额看活动窗口内的账本。点击模型查看累计与每日变化。</span></p>
        <div className={styles.dealFilters}><SegmentedControl label="优惠类型" options={DEAL_FILTER_OPTIONS} value={filter} onChange={setFilter} /></div>
        <div className={styles.dealFilters}><SegmentedControl label="金额口径" options={BILLING_OPTIONS} value={billingScope} onChange={setBillingScope} /></div>
        <Button variant="outline" onClick={retry} disabled={refreshing}><RefreshCw data-icon="inline-start" aria-hidden="true" />{refreshing ? "刷新中…" : "刷新"}</Button>
      </div>
      {error || degraded ? <p className={styles.warning} role="alert">{error ?? "账单数据暂不可用；仅显示优惠事实，金额不以零替代。"} <Button size="sm" variant="outline" onClick={retry}>重试</Button></p> : null}
      {!data && loading ? <PendingFeed onRetry={retry} /> : null}
      {data ? (
        <>
          <div className={styles.totals} aria-label="全账本让利，包含按量和订阅">
            <div><span>全账本累计让利</span><strong>{totals ? usdGrouped(totals.saved) : "—"}</strong></div>
            <div><span>PAYG 按量让利 · 实际 discount_amount</span><strong>{totals ? usdGrouped(totals.saved - totals.subSaved) : "—"}</strong></div>
            <div><span>订阅让利 · 原价 × 同期供应商优惠比例</span><strong>{totals ? usdGrouped(totals.subSaved) : "—"}</strong></div>
          </div>
          <div className={styles.dealBody}>
            <div className={styles.dealList} aria-label="按让利排序的优惠账本">
              <div className={styles.listHeading}><span>{deals.length} 个优惠期 · 按让利排序</span><span>让利 USD</span></div>
              {deals.map((deal) => (
                <button type="button" key={deal.id} onClick={() => setSelectedId(deal.id)} aria-pressed={selected?.id === deal.id} className={styles.dealRow}>
                  <VendorGlyph vendor={deal.vendor} alt={deal.vendorName} className="size-6 shrink-0" />
                  <span><b>{deal.model}</b><small>{deal.dealType === "free" ? "FREE · 100% off" : percentOff(deal.discount)} · {deal.status === "ended" ? "已结束" : deal.status === "scheduled" ? "未开始" : "进行中"}</small></span>
                  <strong>{data.live && deal.stats ? usdGrouped(savedFor(deal, billingScope)!) : "—"}</strong>
                </button>
              ))}
              {!deals.length ? <p className={styles.empty}>此筛选条件下没有优惠期。</p> : null}
            </div>
            {selected ? (
              <div className={styles.dealDetail}>
                <div className={styles.detailHeading}><strong>{selected.model}</strong><span>金额：{BILLING_OPTIONS.find((option) => option.key === billingScope)?.label} · Token 始终为合计</span></div>
                {/* Existing chart, crosshair, daily bars, stats and model link. */}
                <DealTrendPanel deal={data.live ? scopeDeal(selected, billingScope) : { ...selected, stats: null, points: null }} />
                <p className={styles.dealSplit}>
                  优惠期 {selected.startDate} — {selected.endDate ?? "进行中"}（UTC） ·{" "}
                  本优惠期让利：PAYG {data.live && selected.stats ? usdGrouped(selected.stats.saved - selected.stats.subSaved) : "—"}
                  {" / "}订阅 {data.live && selected.stats ? usdGrouped(selected.stats.subSaved) : "—"}
                  {" · "}Developers paid 包含订阅折后额度消耗，并非全为现金付款。
                </p>
              </div>
            ) : null}
          </div>
          <footer className={styles.provenance}>
            <a href="/token-deals" target="_blank" rel="noreferrer">来源：Token Deals 实际账本 /api/token-deals/live?range=all</a>
            <span className={data.stale || degraded || error ? styles.stale : undefined}>{degraded ? "降级 · 金额不可用" : error ? "读取失败 · 保留上次快照" : data.stale ? "历史快照 · 等待追赶" : "账本已载入"}</span>
            <span>实际截至 <time dateTime={data.to}>{data.to.replace("T", " ").replace(/\.\d+Z$/, " UTC")}</time></span>
            <span>PAYG = 实际账单折扣；订阅 = 原价用量 × 同期各供应商折扣，不是订阅费减免。报价来自模型列表，账本金额不由报价倒推。</span>
          </footer>
        </>
      ) : null}
    </>
  );
}

function PendingFeed({ onRetry }: { onRetry: () => void }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 25_000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className={styles.empty} role="status" aria-live="polite">
      <strong>{slow ? "账本读取超过 25 秒" : "正在读取真实优惠账本…"}</strong>
      <p>{slow ? "可以重试；旧请求会被取消。" : "等待实际账单数据，尚无金额可展示。"}</p>
      {slow ? <Button onClick={onRetry}>重试账本</Button> : null}
    </div>
  );
}
