"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IdentityTalkData } from "./identity/types";
import styles from "./talk.module.css";

const PSEUDO = new Set(["self", "unknown", "refused"]);

export function IdentityRelations({ data }: { data: IdentityTalkData }) {
  const [mode, setMode] = useState<"count" | "degree">("count");
  const [focus, setFocus] = useState("anthropic");
  const ranks = useMemo(() => {
    const edges = data.graph.edges.filter(e => e.from !== e.to && !PSEUDO.has(e.to) && !PSEUDO.has(e.from) && e.count > 0);
    return data.graph.vendors.filter(v => !PSEUDO.has(v.id) && !v.id.startsWith("other:")).map(vendor => {
      const incoming = edges.filter(e => e.to === vendor.id);
      const outgoing = edges.filter(e => e.from === vendor.id);
      return { ...vendor, incoming: incoming.reduce((n, e) => n + e.count, 0), outgoing: outgoing.reduce((n, e) => n + e.count, 0), inDegree: new Set(incoming.filter(e => !e.from.startsWith("other:")).map(e => e.from)).size, outDegree: new Set(outgoing.filter(e => !e.to.startsWith("other:")).map(e => e.to)).size };
    });
  }, [data.graph]);
  const selected = ranks.find(r => r.id === focus)!;
  const centerCount = ranks.filter(r => ["anthropic", "openai", "google"].includes(r.id)).reduce((n, r) => n + r.incoming, 0);
  return <div className={styles.relations}>
    <div className={styles.relationsTop}><p>次数看「多响」，边数看「多散」。</p><div><Button variant={mode === "count" ? "default" : "outline"} onClick={() => setMode("count")} aria-pressed={mode === "count"}>按回答次数</Button><Button variant={mode === "degree" ? "default" : "outline"} onClick={() => setMode("degree")} aria-pressed={mode === "degree"}>按关系边数</Button></div></div>
    <div className={styles.relationsGrid}>{(["in", "out"] as const).map(direction => {
      const key = mode === "count" ? direction === "in" ? "incoming" : "outgoing" : direction === "in" ? "inDegree" : "outDegree";
      const rows = [...ranks].sort((a, b) => b[key] - a[key]).slice(0, 5);
      return <div key={direction} className={styles.relationsRank}><h2>{direction === "in" ? "谁被借用了名字" : "谁借用了别人的名字"}</h2><p>{mode === "count" ? direction === "in" ? "被其他厂商自称的回答数" : "自称为其他厂商的回答数" : direction === "in" ? "有多少个不同厂商曾自称为它" : "曾自称为多少个不同厂商"}</p>{rows.map((row, i) => <button key={row.id} aria-pressed={focus === row.id} onClick={() => setFocus(row.id)} className={cn(styles.relationRow, focus === row.id && styles.relationActive)}><span>{String(i + 1).padStart(2,"0")}</span>{row.logo && <Image src={`/maker-logo/${row.logo}`} width={25} height={25} alt="" unoptimized />}<span className={styles.relationName}>{row.name}</span><div className={styles.relationBar}><i style={{ transform: `scaleX(${row[key] / Math.max(1, rows[0][key])})` }} /></div><strong>{row[key]}<small>{mode === "count" ? "次" : "条"}</small></strong></button>)}</div>;
    })}</div>
    <div className={styles.relationConclusion}><div><span>Anthropic · OpenAI · Google</span><strong>{(centerCount / data.counts.cross * 100).toFixed(1)}<small>%</small></strong><p>三种身份，吸收了大部分跨厂混淆。</p></div><div><span>聚焦：{selected.name}</span><p>被冒认 <b>{selected.incoming}</b> 次 · 冒认他人 <b>{selected.outgoing}</b> 次</p><p>入边 <b>{selected.inDegree}</b> 条 · 出边 <b>{selected.outDegree}</b> 条</p><small>边数仅统计规范厂商节点，同一方向计一条；次数保留罕见身份。</small></div></div>
  </div>;
}
