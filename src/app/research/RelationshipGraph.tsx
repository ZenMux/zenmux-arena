"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useMemo, useRef, useState } from "react";
import {
  apexToCurve,
  curvedArrow,
  DEFAULT_RENDER,
  type EdgeCurves,
  edgeKey,
  edgeLangWeights,
  badgeLayout,
  edgeWeight,
  edgeWeightColor,
  isDarkBackground,
  isNonNode,
  isOffByDefault,
  type LangWeight,
  legendLayout,
  makeLayout,
  nodePositions,
  optimizeNodeOrder,
  type Palette,
  paletteFor,
  type Point,
  type RenderConfig,
  vendorColor,
} from "@research/lib/geometry";
import {
  AUTHOR_URL,
  BADGE_TEXT,
  GITHUB_MARK_PATH,
  REPO_LABEL,
  REPO_URL,
  ZENMUX_URL,
} from "@research/lib/branding";
import type { GraphData, VendorId } from "@research/lib/types";

// Theme-aware ZenMux wordmark, matching StudyBadge.tsx's counterintuitive naming:
// ZenMux-Light.png is the DARK wordmark (for light backgrounds) and ZenMux.png is
// the WHITE one (for dark backgrounds).
const WORDMARK = {
  light: "/maker-logo/ZenMux-Light.png",
  dark: "/maker-logo/ZenMux.png",
};

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
  meta: "meta.png",
  mistral: "mistral.png",
  agnes: "agnes.png",
};

/**
 * Resolve a vendor's logo URL. Prefers the `logo` filename carried in the loaded
 * aggregate (so dynamically-discovered vendors — e.g. `other:yandex`, `other:baai`
 * — light up the moment a logo is dropped under public/maker-logo/), and falls
 * back to the static map keyed by id. Returns null when no logo is known, in
 * which case callers render a text/initial fallback.
 */
function logoSrc(id: VendorId, logo?: string): string | null {
  const f = logo || LOGO[id];
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

/**
 * Short label for a logo-less node chip. Latin names → up to two leading
 * letters ("Yandex" → "Y", "Alibaba Cloud" → "AC"); CJK / other scripts →
 * the first character, which is already meaningful on its own ("百灵" → "百").
 */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (/^[\x00-\x7F]+$/.test(name)) {
    return words
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("");
  }
  return Array.from(name)[0] ?? "?";
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

/**
 * The attribution badge, drawn as SVG chrome in the top band (below the subtitle,
 * above the ring). On-screen twin of svg.ts's export badge — both consume the
 * shared `badgeLayout` so the live preview and the exported PNG/SVG never drift.
 * Links are real <a> elements here; the static export drops them (a flat image).
 */
function BadgeChrome({ cx, pal, dark }: { cx: number; pal: Palette; dark: boolean }) {
  const b = badgeLayout(cx);
  return (
    <g>
      {/* Line 1: "by thinkthinking |" → author, then the ZenMux wordmark → zenmux.ai. */}
      <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer">
        <text
          x={b.attr.x}
          y={b.attr.y}
          dominantBaseline="alphabetic"
          fontSize={b.attr.fontSize}
          fill={pal.muted}
        >
          {BADGE_TEXT}
        </text>
      </a>
      <a href={ZENMUX_URL} target="_blank" rel="noopener noreferrer">
        <image
          href={dark ? WORDMARK.dark : WORDMARK.light}
          x={b.logo.x}
          y={b.logo.y}
          width={b.logo.w}
          height={b.logo.h}
          preserveAspectRatio="xMidYMid meet"
        />
      </a>
      {/* Line 2: GitHub mark + repo label → source repo. */}
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
        <g transform={`translate(${b.repo.mark.x}, ${b.repo.mark.y}) scale(${b.repo.mark.size / 16})`}>
          <path d={GITHUB_MARK_PATH} fill={pal.faint} />
        </g>
        <text
          x={b.repo.text.x}
          y={b.repo.text.y}
          dominantBaseline="alphabetic"
          fontSize={b.repo.text.fontSize}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill={pal.faint}
        >
          {REPO_LABEL}
        </text>
      </a>
    </g>
  );
}

/**
 * The reading-key legend, drawn as SVG chrome in the bottom band (above the
 * provenance footer). On-screen twin of svg.ts's export legend — both consume
 * the shared `legendLayout` so preview and export never drift. Explains the
 * arrow semantics with a mini sample edge: "A → B = a model by A claims to be B".
 */
function LegendChrome({ cx, y, pal }: { cx: number; y: number; pal: Palette }) {
  const lg = legendLayout(cx, y);
  const sampleColor = edgeWeightColor(0); // blue — the base weight tier
  return (
    <g>
      <line
        x1={lg.sample.x1}
        y1={lg.sample.y1}
        x2={lg.sample.x2}
        y2={lg.sample.y2}
        stroke={sampleColor}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <polygon points={lg.sample.head} fill={sampleColor} />
      <circle cx={lg.dotA.x} cy={lg.dotA.y} r={lg.dotA.r} fill={pal.ink} />
      <circle cx={lg.dotB.x} cy={lg.dotB.y} r={lg.dotB.r} fill={pal.ink} />
      <text x={lg.aLabel.x} y={lg.aLabel.y} textAnchor="middle" fontSize={lg.aLabel.fontSize} fontWeight={700} fill={pal.muted}>
        A
      </text>
      <text x={lg.bLabel.x} y={lg.bLabel.y} textAnchor="middle" fontSize={lg.bLabel.fontSize} fontWeight={700} fill={pal.muted}>
        B
      </text>
      <text x={lg.text.x} y={lg.text.y} fontSize={lg.text.fontSize} fill={pal.muted}>
        <tspan fontWeight={700} fill={pal.ink}>
          A → B
        </tspan>
        {" = a model made by A identifies itself as B"}
      </text>
    </g>
  );
}

export default function RelationshipGraph({
  graph,
  config,
  lang: controlledLang,
  onLangChange,
  hideLangPicker = false,
  showVendorPicker = false,
  hidden: controlledHidden,
  onHiddenChange,
  curves: controlledCurves,
  onCurvesChange,
  editableEdges = false,
  showEdgeLabels: controlledShowLabels,
  onShowEdgeLabelsChange,
}: {
  graph: GraphData;
  /** Visual knobs; omit to use the defaults (the report page's look). */
  config?: RenderConfig;
  /** Controlled language filter ("" = aggregate). Omit for internal state. */
  lang?: string;
  onLangChange?: (lang: string) => void;
  /** Hide the built-in language <select> (e.g. when the studio owns it). */
  hideLangPicker?: boolean;
  /** Show the side panel of vendor checkboxes that hide/show ring nodes. */
  showVendorPicker?: boolean;
  /**
   * Controlled set of hidden vendor ids. When provided (with onHiddenChange),
   * the studio owns this state so it can forward it to the export; omit for
   * self-contained internal state (the report page).
   */
  hidden?: Set<VendorId>;
  onHiddenChange?: Dispatch<SetStateAction<Set<VendorId>>>;
  /** Controlled per-edge curve overrides, paired with onCurvesChange. */
  curves?: EdgeCurves;
  onCurvesChange?: Dispatch<SetStateAction<EdgeCurves>>;
  /** Enable drag-to-reshape on edges (studio only). */
  editableEdges?: boolean;
  /** Controlled edge-label visibility (default false = clean lines only). */
  showEdgeLabels?: boolean;
  onShowEdgeLabelsChange?: Dispatch<SetStateAction<boolean>>;
}) {
  const cfg = config ?? DEFAULT_RENDER;
  // Foreground palette derived from the (custom) background — light ink on dark
  // backgrounds and vice versa, so the graph stays legible on any color.
  const pal = useMemo(() => paletteFor(cfg.background), [cfg.background]);
  const [internalLang, setInternalLang] = useState<string>("");
  const lang = controlledLang ?? internalLang;
  const setLang = (v: string) => (onLangChange ? onLangChange(v) : setInternalLang(v));
  const [internalShowLabels, setInternalShowLabels] = useState<boolean>(false);
  const showLabels = controlledShowLabels ?? internalShowLabels;
  const setShowLabels = onShowEdgeLabelsChange ?? setInternalShowLabels;
  const [hoverNode, setHoverNode] = useState<VendorId | null>(null);
  const [hoverEdge, setHoverEdge] = useState<HoverEdge | null>(null);

  // Every vendor eligible for a ring node + a picker row: canonical vendors,
  // the analytical buckets (unknown/refused), and discovered other:<brand>s.
  // Only the structural non-nodes (self, bare `other`) are excluded.
  const pickableVendors = useMemo(
    () => graph.vendors.filter((v) => !isNonNode(v.id)),
    [graph.vendors],
  );

  // Which vendors are drawn on the ring. The picker toggles membership and the
  // layout re-flows from the visible count. Default-hidden = the off-by-default
  // set (unknown/refused/other:<brand>), so the graph opens as just the canonical
  // vendors and the user opts the rest in. Controlled by the parent when provided
  // (so the studio can export the same filtered set), otherwise self-contained.
  const [internalHidden, setInternalHidden] = useState<Set<VendorId>>(
    () => new Set(graph.vendors.filter((v) => isOffByDefault(v.id)).map((v) => v.id)),
  );
  const hidden = controlledHidden ?? internalHidden;
  const setHidden = onHiddenChange ?? setInternalHidden;
  const shownVendors = useMemo(
    () => pickableVendors.filter((v) => !hidden.has(v.id)),
    [pickableVendors, hidden],
  );
  const toggleVendor = (id: VendorId) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Per-edge curve reshapes (from dragging). Same controlled-or-internal pattern.
  const [internalCurves, setInternalCurves] = useState<EdgeCurves>({});
  const curves = controlledCurves ?? internalCurves;
  const setCurves = onCurvesChange ?? setInternalCurves;

  // Edge dragging. `svgRef` lets us map screen→SVG coords; `dragRef` holds the
  // in-flight grab (no re-render per move); `draggingKey` drives cursor/visual.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{
    from: VendorId;
    to: VendorId;
    startPointer: Point;
    startApex: Point;
  } | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  // Layout/positions track the *visible* set, so hiding a vendor reflows the ring.
  // When `optimizeOrder` is on, the visible vendors are reordered so strongly-
  // connected pairs sit far apart on the circle — thin edges stay readable.
  const orderedVendors = useMemo(
    () => (cfg.optimizeOrder ? optimizeNodeOrder(shownVendors, graph.edges) : shownVendors),
    [shownVendors, graph.edges, cfg.optimizeOrder],
  );
  const layout = useMemo(() => makeLayout(shownVendors.length, cfg), [shownVendors.length, cfg]);
  const pos = useMemo(() => nodePositions(orderedVendors, layout), [orderedVendors, layout]);

  const threshold = cfg.threshold;
  const edges = useMemo(() => {
    return graph.edges
      .filter((e) => e.from !== e.to && !isNonNode(e.to))
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

  /** Map a pointer event's client coords into the SVG's user coordinate space. */
  function toSvgPoint(clientX: number, clientY: number): Point | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  // ── Edge drag: grab anywhere on a line and bend it. We track the pointer's
  // delta from grab to now and add it to the apex at grab time, so the curve
  // doesn't jump to the cursor — it follows your hand from wherever you grabbed.
  function onEdgePointerDown(e: React.PointerEvent, from: VendorId, to: VendorId) {
    if (!editableEdges) return;
    e.stopPropagation();
    e.preventDefault();
    const a = pos.get(from);
    const b = pos.get(to);
    const start = toSvgPoint(e.clientX, e.clientY);
    if (!a || !b || !start) return;
    const ov = curves[edgeKey(from, to)];
    const arrow = curvedArrow(a, b, layout.nodeRadius, ov ? ov.bow : cfg.curveBow, ov?.along ?? 0);
    dragRef.current = { from, to, startPointer: start, startApex: arrow.label };
    setDraggingKey(edgeKey(from, to));
    setHoverEdge(null);
    // Capture on the <svg> (stable across re-renders) rather than the edge <g>,
    // so move/up events keep flowing even when the pointer leaves the thin line.
    svgRef.current?.setPointerCapture(e.pointerId);
  }

  function onSvgPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const a = pos.get(drag.from);
    const b = pos.get(drag.to);
    const now = toSvgPoint(e.clientX, e.clientY);
    if (!a || !b || !now) return;
    const apex: Point = {
      x: drag.startApex.x + (now.x - drag.startPointer.x),
      y: drag.startApex.y + (now.y - drag.startPointer.y),
    };
    const next = apexToCurve(a, b, layout.nodeRadius, apex);
    setCurves((prev) => ({ ...prev, [edgeKey(drag.from, drag.to)]: next }));
  }

  function endDrag() {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDraggingKey(null);
  }

  /** Double-click an edge to drop its override and snap back to the default arc. */
  function resetEdge(from: VendorId, to: VendorId) {
    if (!editableEdges) return;
    setCurves((prev) => {
      const key = edgeKey(from, to);
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
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
          <label className="flex items-center gap-1.5 text-neutral-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
              className="size-3.5 accent-neutral-900 dark:accent-neutral-100"
            />
            Show edge labels
          </label>
          {hoverNode && (
            <span className="text-neutral-400">
              Highlighting <strong>{hoverNode}</strong>
            </span>
          )}
        </div>
      )}

      <div className={showVendorPicker ? "flex flex-col gap-4 lg:flex-row lg:items-start" : undefined}>
        {showVendorPicker && (
          <VendorPicker
            vendors={pickableVendors}
            hidden={hidden}
            onToggle={toggleVendor}
            onAll={() => setHidden(new Set())}
            onNone={() => setHidden(new Set(pickableVendors.map((v) => v.id)))}
            hoverNode={hoverNode}
            onHover={setHoverNode}
          />
        )}
        <div className="min-w-0 flex-1">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="w-full h-auto select-none"
        style={draggingKey ? { cursor: "grabbing", touchAction: "none" } : undefined}
        onMouseLeave={() => {
          setHoverNode(null);
          setHoverEdge(null);
        }}
        onPointerMove={editableEdges ? onSvgPointerMove : undefined}
        onPointerUp={editableEdges ? endDrag : undefined}
        onPointerCancel={editableEdges ? endDrag : undefined}
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

        {/* Title + attribution badge (chrome). The badge is drawn here (not as an
            HTML overlay) so it sits centered under the subtitle and is baked into
            the server-rendered export — kept in lockstep with svg.ts. */}
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
            <BadgeChrome
              cx={layout.width / 2}
              pal={pal}
              dark={isDarkBackground(cfg.background)}
            />
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
          const key = edgeKey(e.from, e.to);
          const ov = curves[key];
          const arrow = curvedArrow(a, b, layout.nodeRadius, ov ? ov.bow : cfg.curveBow, ov?.along ?? 0);
          const active = edgeActive(e.from, e.to);
          const color = edgeWeightColor(p);
          const sw = cfg.edgeBaseWidth + p * cfg.edgeWidthScale;
          const op = 0.95 * (active ? 1 : 0.1);
          const labelOp = active ? 1 : 0.12;
          const lineH = 17;
          const startY = arrow.label.y - ((langs.length - 1) * lineH) / 2;
          const isDragging = draggingKey === key;
          const isHovered = hoverEdge?.from === e.from && hoverEdge?.to === e.to;
          // Fat invisible hit path: widened in edit mode so even thin, low-probability
          // edges are easy to grab; carries the drag + double-click-to-reset handlers.
          const hitWidth = editableEdges ? Math.max(sw + 14, 24) : sw + 8;
          return (
            <g
              key={key}
              onMouseEnter={() => {
                if (!dragRef.current)
                  setHoverEdge({ from: e.from, to: e.to, p, count, total, x: arrow.label.x, y: arrow.label.y, langs });
              }}
              onMouseLeave={() => {
                if (!dragRef.current) setHoverEdge(null);
              }}
              onPointerDown={editableEdges ? (ev) => onEdgePointerDown(ev, e.from, e.to) : undefined}
              onDoubleClick={editableEdges ? () => resetEdge(e.from, e.to) : undefined}
              style={{ cursor: editableEdges ? (isDragging ? "grabbing" : "grab") : "pointer" }}
            >
              <path
                d={arrow.path}
                fill="none"
                stroke={pal.ink}
                strokeWidth={hitWidth}
                strokeOpacity={0}
                strokeLinecap="round"
                style={editableEdges ? { pointerEvents: "stroke" } : undefined}
              />
              <path d={arrow.path} fill="none" stroke={pal.casing} strokeWidth={sw + 3} strokeOpacity={active || isDragging ? 0.85 : 0.1} strokeLinecap="round" style={{ pointerEvents: "none" }} />
              <path d={arrow.path} fill="none" stroke={color} strokeWidth={sw} strokeOpacity={isDragging ? 1 : op} strokeLinecap="round" style={{ pointerEvents: "none" }} />
              <polygon points={arrow.head} fill={color} fillOpacity={isDragging ? 1 : op} style={{ pointerEvents: "none" }} />
              {/* Grab handle at the apex — only in edit mode, while hovering/dragging,
                  to signal "drag me" without cluttering the static graph or export. */}
              {editableEdges && (isHovered || isDragging) && (
                <circle
                  cx={arrow.label.x}
                  cy={arrow.label.y}
                  r={isDragging ? 7 : 5.5}
                  fill={color}
                  stroke={pal.casing}
                  strokeWidth={2}
                  style={{ pointerEvents: "none" }}
                />
              )}
              {showLabels && (lang ? (
                <EdgeText x={arrow.label.x} y={arrow.label.y} color={color} casing={pal.casing} fontSize={15} opacity={labelOp}>
                  {(p * 100).toFixed(2)}%
                </EdgeText>
              ) : cfg.labelMode === "none" ? null : cfg.labelMode === "top" ? (
                langs[0] && (
                  <EdgeText x={arrow.label.x} y={arrow.label.y} color={color} casing={pal.casing} fontSize={13} opacity={labelOp}>
                    {langName(graph, langs[0].code)} {(langs[0].p * 100).toFixed(2)}%
                    {langs.length > 1 ? ` +${langs.length - 1}` : ""}
                  </EdgeText>
                )
              ) : (
                langs.map((l, i) => (
                  <EdgeText key={l.code} x={arrow.label.x} y={startY + i * lineH} color={color} casing={pal.casing} fontSize={13} opacity={labelOp}>
                    {langName(graph, l.code)} {(l.p * 100).toFixed(2)}%
                  </EdgeText>
                ))
              ))}
            </g>
          );
        })}

        {/* Nodes */}
        {shownVendors.map((v) => {
          const p = pos.get(v.id)!;
          const nr = layout.nodeRadius;
          const active = nodeActive(v.id);
          const src = logoSrc(v.id, v.logo);
          return (
            <g
              key={v.id}
              opacity={active ? 1 : 0.25}
              onMouseEnter={() => setHoverNode(v.id)}
              onMouseLeave={() => setHoverNode(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Dark chip regardless of background: the maker logos are white/light
                  variants, so they must sit on a dark fill to be visible. Vendors
                  discovered from the data without a logo (e.g. other:yandex,
                  other:baai) fall back to a colored chip + initials so they're
                  still distinguishable on the ring. */}
              {src ? (
                <>
                  <circle cx={p.x} cy={p.y} r={nr} fill={pal.chip} stroke={pal.chipStroke} strokeWidth={1.5} />
                  <image
                    href={src}
                    x={p.x - (nr * 1.15) / 2}
                    y={p.y - (nr * 1.15) / 2}
                    width={nr * 1.15}
                    height={nr * 1.15}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </>
              ) : (
                <>
                  <circle cx={p.x} cy={p.y} r={nr} fill={vendorColor(v.id)} stroke={pal.chipStroke} strokeWidth={1.5} />
                  <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={nr * 0.66} fontWeight={700} fill="#ffffff">
                    {initials(v.name)}
                  </text>
                </>
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
            ? [`${(hoverEdge.p * 100).toFixed(2)}% · ${hoverEdge.count}/${hoverEdge.total}`]
            : hoverEdge.langs.map((l) => `${langName(graph, l.code)} ${(l.p * 100).toFixed(2)}% · ${l.count}/${l.total}`);
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

        {/* Reading-key legend (bottom chrome) — baked into the export too. */}
        {cfg.chrome && (
          <LegendChrome cx={layout.width / 2} y={layout.height - 62} pal={pal} />
        )}
      </svg>
        </div>
      </div>
    </div>
  );
}

/**
 * Side panel of vendor toggles. Every vendor is checked by default; unchecking
 * one removes it from the ring and the layout reflows around the remaining set.
 * Hovering a row mirrors the graph's node-highlight so the two stay in sync.
 */
function VendorPicker({
  vendors,
  hidden,
  onToggle,
  onAll,
  onNone,
  hoverNode,
  onHover,
}: {
  vendors: { id: VendorId; name: string; logo?: string }[];
  hidden: Set<VendorId>;
  onToggle: (id: VendorId) => void;
  onAll: () => void;
  onNone: () => void;
  hoverNode: VendorId | null;
  onHover: (id: VendorId | null) => void;
}) {
  const shownCount = vendors.length - hidden.size;
  return (
    <div className="w-full shrink-0 rounded-xl border border-neutral-200 bg-white/60 p-3 lg:w-56 dark:border-neutral-800 dark:bg-neutral-950/60">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Vendors
        </span>
        <span className="font-mono text-[11px] tabular-nums text-neutral-400">
          {shownCount}/{vendors.length}
        </span>
      </div>
      <div className="mb-2 flex gap-1.5 px-1">
        <button
          type="button"
          onClick={onAll}
          className="rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          All
        </button>
        <button
          type="button"
          onClick={onNone}
          className="rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          None
        </button>
      </div>
      <div className="flex flex-wrap gap-1 lg:max-h-[28rem] lg:flex-col lg:flex-nowrap lg:overflow-y-auto">
        {vendors.map((v) => {
          const checked = !hidden.has(v.id);
          const dimmed = hoverNode != null && hoverNode !== v.id;
          const src = logoSrc(v.id, v.logo);
          return (
            <label
              key={v.id}
              onMouseEnter={() => onHover(v.id)}
              onMouseLeave={() => onHover(null)}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900 ${
                dimmed ? "opacity-50" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(v.id)}
                className="size-3.5 shrink-0 accent-neutral-900 dark:accent-neutral-100"
              />
              {src ? (
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-neutral-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="size-4 object-contain" />
                </span>
              ) : (
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded text-[9px] font-bold leading-none text-white"
                  style={{ backgroundColor: vendorColor(v.id) }}
                >
                  {initials(v.name)}
                </span>
              )}
              <span
                className={`truncate ${
                  checked
                    ? "text-neutral-800 dark:text-neutral-100"
                    : "text-neutral-400 line-through dark:text-neutral-600"
                }`}
              >
                {v.name}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
