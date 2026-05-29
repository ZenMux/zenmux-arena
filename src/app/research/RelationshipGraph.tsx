"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  curvedArrow,
  DEFAULT_RENDER,
  edgeLangWeights,
  edgeWeight,
  isPseudo,
  type LangWeight,
  makeLayout,
  nodePositions,
  paletteFor,
  type RenderConfig,
  vendorColor,
} from "@research/lib/geometry";
import type { GraphData, VendorId } from "@research/lib/types";

const LOGO: Record<string, string> = {
  anthropic: "anthropic.png",
  openai: "openai.png",
  google: "google.png",
  deepseek: "deepseek.png",
  qwen: "qwen.png",
  baidu: "baidu.png",
  bytedance: "bytedance.png",
  moonshot: "moonshot.png",
  "z-ai": "z-ai.png",
  stepfun: "stepfun.png",
  "x-ai": "x-ai.png",
  minimax: "minimax.png",
  kwai: "kwai.png",
  xiaomi: "xiaomi.png",
  tencent: "tencent.png",
  inclusionai: "inclusionai.png",
  zenmux: "ZenMux.png",
};

function logoSrc(id: VendorId): string | null {
  const f = LOGO[id];
  return f ? `/maker-logo/${encodeURIComponent(f)}` : null;
}

interface HoverEdge {
  from: VendorId;
  to: VendorId;
  p: number;
  count: number;
  total: number;
  x: number;
  y: number;
  /** Per-language breakdown (aggregate view only). */
  langs: LangWeight[];
}

function langName(graph: GraphData, code: string): string {
  return graph.languages.find((l) => l.code === code)?.name ?? code;
}

/** One edge label line: colored text with a background-colored halo (paint-order stroke). */
function EdgeText({
  x,
  y,
  color,
  casing,
  fontSize,
  opacity,
  children,
}: {
  x: number;
  y: number;
  color: string;
  casing: string;
  fontSize: number;
  opacity: number;
  children: ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={fontSize}
      fontWeight={700}
      fill={color}
      stroke={casing}
      strokeWidth={3.5}
      style={{ paintOrder: "stroke", opacity }}
    >
      {children}
    </text>
  );
}

export default function RelationshipGraph({
  graph,
  config,
  lang: controlledLang,
  onLangChange,
  hideLangPicker = false,
}: {
  graph: GraphData;
  /** Visual knobs; omit to use the defaults (the report page's look). */
  config?: RenderConfig;
  /** Controlled language filter ("" = aggregate). Omit for internal state. */
  lang?: string;
  onLangChange?: (lang: string) => void;
  /** Hide the built-in language <select> (e.g. when the studio owns it). */
  hideLangPicker?: boolean;
}) {
  const cfg = config ?? DEFAULT_RENDER;
  // Foreground palette derived from the (custom) background — light ink on dark
  // backgrounds and vice versa, so the graph stays legible on any color.
  const pal = useMemo(() => paletteFor(cfg.background), [cfg.background]);
  const [internalLang, setInternalLang] = useState<string>("");
  const lang = controlledLang ?? internalLang;
  const setLang = (v: string) => (onLangChange ? onLangChange(v) : setInternalLang(v));
  const [hoverNode, setHoverNode] = useState<VendorId | null>(null);
  const [hoverEdge, setHoverEdge] = useState<HoverEdge | null>(null);

  const realVendors = useMemo(
    () => graph.vendors.filter((v) => !isPseudo(v.id)),
    [graph.vendors],
  );
  const layout = useMemo(() => makeLayout(realVendors.length, cfg), [realVendors.length, cfg]);
  const pos = useMemo(() => nodePositions(realVendors, layout), [realVendors, layout]);

  const threshold = cfg.threshold;
  const edges = useMemo(() => {
    return graph.edges
      .filter((e) => e.from !== e.to && !isPseudo(e.to))
      .filter((e) => pos.has(e.from) && pos.has(e.to))
      .map((e) => {
        if (lang) {
          const w = edgeWeight(e, lang);
          return { e, p: w.p, count: w.count, total: w.total, langs: [] as LangWeight[] };
        }
        // Aggregate: keep the edge if ANY language confuses A→B, label per-language.
        const langs = edgeLangWeights(e).filter((l) => l.p >= threshold);
        const p = langs.length ? langs[0].p : 0;
        return { e, p, count: e.count, total: e.total, langs };
      })
      .filter((x) => (lang ? x.p >= threshold : x.langs.length > 0))
      .sort((a, b) => a.p - b.p);
  }, [graph.edges, lang, pos, threshold]);

  function nodeActive(id: VendorId): boolean {
    if (!hoverNode) return true;
    if (id === hoverNode) return true;
    return edges.some(
      ({ e }) => (e.from === hoverNode && e.to === id) || (e.to === hoverNode && e.from === id),
    );
  }

  function edgeActive(from: VendorId, to: VendorId): boolean {
    if (!hoverNode) return true;
    return from === hoverNode || to === hoverNode;
  }

  return (
    <div className="relative w-full">
      {!hideLangPicker && (
        <div className="mb-4 flex items-center gap-3 text-sm">
          <label htmlFor="lang" className="text-neutral-500">
            Language
          </label>
          <select
            id="lang"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="">All languages (aggregate)</option>
            {graph.languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
          {hoverNode && (
            <span className="text-neutral-400">
              Highlighting <strong>{hoverNode}</strong>
            </span>
          )}
        </div>
      )}

      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="w-full h-auto select-none"
        onMouseLeave={() => {
          setHoverNode(null);
          setHoverEdge(null);
        }}
      >
        <rect width={layout.width} height={layout.height} fill={cfg.background} />
        <circle
          cx={layout.center.x}
          cy={layout.center.y}
          r={layout.radius}
          fill="none"
          stroke={pal.faint}
          strokeOpacity={0.4}
          strokeWidth={1.5}
          strokeDasharray="2 6"
        />

        {/* Title (chrome) */}
        {cfg.chrome && (
          <>
            <text
              x={layout.width / 2}
              y={64}
              textAnchor="middle"
              fontSize={34}
              fontWeight={700}
              fill={pal.ink}
            >
              Who Are You?
            </text>
            <text x={layout.width / 2} y={98} textAnchor="middle" fontSize={16} fill={pal.muted}>
              Cross-Vendor Identity Confusion in Frontier LLMs
              {lang ? ` · ${graph.languages.find((l) => l.code === lang)?.name ?? lang}` : ""}
            </text>
          </>
        )}

        {/* Edges — colored per SOURCE vendor (configurable) so overlapping curves
            can be told apart; stroke width scales with probability. A white casing
            under each line keeps crossings legible. Hover dims the rest. Label mode
            "all" flattens EVERY driving language; "top" shows dominant + "+N";
            "none" hides labels. */}
        {edges.map(({ e, p, count, total, langs }) => {
          const a = pos.get(e.from)!;
          const b = pos.get(e.to)!;
          const arrow = curvedArrow(a, b, layout.nodeRadius, cfg.curveBow);
          const active = edgeActive(e.from, e.to);
          const color = cfg.colorBySource ? vendorColor(e.from) : pal.mono;
          const sw = cfg.edgeBaseWidth + p * cfg.edgeWidthScale;
          const op = 0.95 * (active ? 1 : 0.1);
          const labelOp = active ? 1 : 0.12;
          const lineH = 17;
          const startY = arrow.label.y - ((langs.length - 1) * lineH) / 2;
          return (
            <g
              key={`${e.from}->${e.to}`}
              onMouseEnter={() =>
                setHoverEdge({ from: e.from, to: e.to, p, count, total, x: arrow.label.x, y: arrow.label.y, langs })
              }
              onMouseLeave={() => setHoverEdge(null)}
              style={{ cursor: "pointer" }}
            >
              <path d={arrow.path} fill="none" stroke={pal.ink} strokeWidth={sw + 8} strokeOpacity={0} strokeLinecap="round" />
              <path d={arrow.path} fill="none" stroke={pal.casing} strokeWidth={sw + 3} strokeOpacity={active ? 0.85 : 0.1} strokeLinecap="round" />
              <path d={arrow.path} fill="none" stroke={color} strokeWidth={sw} strokeOpacity={op} strokeLinecap="round" />
              <polygon points={arrow.head} fill={color} fillOpacity={op} />
              {lang ? (
                <EdgeText x={arrow.label.x} y={arrow.label.y} color={color} casing={pal.casing} fontSize={15} opacity={labelOp}>
                  {Math.round(p * 100)}%
                </EdgeText>
              ) : cfg.labelMode === "none" ? null : cfg.labelMode === "top" ? (
                langs[0] && (
                  <EdgeText x={arrow.label.x} y={arrow.label.y} color={color} casing={pal.casing} fontSize={13} opacity={labelOp}>
                    {langName(graph, langs[0].code)} {Math.round(langs[0].p * 100)}%
                    {langs.length > 1 ? ` +${langs.length - 1}` : ""}
                  </EdgeText>
                )
              ) : (
                langs.map((l, i) => (
                  <EdgeText key={l.code} x={arrow.label.x} y={startY + i * lineH} color={color} casing={pal.casing} fontSize={13} opacity={labelOp}>
                    {langName(graph, l.code)} {Math.round(l.p * 100)}%
                  </EdgeText>
                ))
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {realVendors.map((v) => {
          const p = pos.get(v.id)!;
          const nr = layout.nodeRadius;
          const active = nodeActive(v.id);
          const src = logoSrc(v.id);
          return (
            <g
              key={v.id}
              opacity={active ? 1 : 0.25}
              onMouseEnter={() => setHoverNode(v.id)}
              onMouseLeave={() => setHoverNode(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Dark chip regardless of background: the maker logos are white/light
                  variants, so they must sit on a dark fill to be visible. */}
              <circle cx={p.x} cy={p.y} r={nr} fill={pal.chip} stroke={pal.chipStroke} strokeWidth={1.5} />
              {src ? (
                <image
                  href={src}
                  x={p.x - (nr * 1.15) / 2}
                  y={p.y - (nr * 1.15) / 2}
                  width={nr * 1.15}
                  height={nr * 1.15}
                  preserveAspectRatio="xMidYMid meet"
                />
              ) : (
                <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={600} fill="#f4f4f5">
                  {v.name}
                </text>
              )}
              <text x={p.x} y={p.y + nr + 20} textAnchor="middle" fontSize={15} fontWeight={600} fill={pal.ink}>
                {v.name}
              </text>
            </g>
          );
        })}

        {/* Edge tooltip — aggregate view lists every language driving the edge. */}
        {hoverEdge && (() => {
          const rows = lang
            ? [`${(hoverEdge.p * 100).toFixed(1)}% · ${hoverEdge.count}/${hoverEdge.total}`]
            : hoverEdge.langs.map((l) => `${langName(graph, l.code)} ${(l.p * 100).toFixed(0)}% · ${l.count}/${l.total}`);
          const rowH = 16;
          const padTop = 34;
          const h = padTop + rows.length * rowH + 6;
          return (
            <g pointerEvents="none">
              <rect x={hoverEdge.x - 100} y={hoverEdge.y - h} width={200} height={h} rx={6} fill="#16161a" opacity={0.92} />
              <text x={hoverEdge.x} y={hoverEdge.y - h + 20} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">
                {hoverEdge.from} → {hoverEdge.to}
              </text>
              {rows.map((r, i) => (
                <text key={i} x={hoverEdge.x} y={hoverEdge.y - h + padTop + i * rowH} textAnchor="middle" fontSize={12} fill="#cbd5e1">
                  {r}
                </text>
              ))}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
