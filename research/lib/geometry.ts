// Pure, DOM-free, fs-free graph geometry. Safe to import from both the Node SVG
// builder (svg.ts) and the Next.js client component (RelationshipGraph.tsx).

import type { Edge, VendorId } from "./types";

export interface Point {
  x: number;
  y: number;
}

export interface GraphLayout {
  width: number;
  height: number;
  center: Point;
  radius: number;
  nodeRadius: number;
}

export const DEFAULT_LAYOUT: GraphLayout = {
  width: 1200,
  height: 1320,
  center: { x: 600, y: 700 },
  radius: 430,
  nodeRadius: 58,
};

/**
 * Visual knobs shared by BOTH renderers — the interactive preview
 * (RelationshipGraph.tsx) and the static export (svg.ts). Keeping a single
 * config object is what makes the export WYSIWYG with the on-screen graph:
 * the studio builds one RenderConfig, the preview draws it live, and the
 * export route re-draws the very same config server-side at N× scale.
 */
export interface RenderConfig {
  /** Multiplies the auto ring radius — the master "spacing" control. */
  ringScale: number;
  /** Node chip radius in px. */
  nodeRadius: number;
  /** Extra arc gap (px) reserved between neighbouring chips when sizing the ring. */
  nodeGap: number;
  /** Stroke width (px) at probability 0. */
  edgeBaseWidth: number;
  /** Extra stroke width (px) added at probability 1. */
  edgeWidthScale: number;
  /** Color edges by their source vendor (vs a single ink color). */
  colorBySource: boolean;
  /** Edge labels: every language flat / dominant + "+N" / none. */
  labelMode: "all" | "top" | "none";
  /** Arc curvature (perpendicular bow as a fraction of chord length). */
  curveBow: number;
  /** Edges below this probability are not drawn. */
  threshold: number;
  /** Draw the title/footer/branding chrome. */
  chrome: boolean;
  /** Canvas background color (any CSS hex). Text/strokes adapt to its luminance. */
  background: string;
  /**
   * Reorder ring nodes so strongly-connected pairs sit far apart on
   * the circle, improving edge readability. When false, nodes are
   * evenly spaced in their natural (graph.vendors) order.
   */
  optimizeOrder: boolean;
}

export const DEFAULT_RENDER: RenderConfig = {
  ringScale: 1,
  nodeRadius: 58,
  nodeGap: 46,
  edgeBaseWidth: 1.4,
  edgeWidthScale: 4.6,
  colorBySource: true,
  labelMode: "all",
  curveBow: 0.18,
  threshold: 0.01,
  chrome: true,
  background: "#ffffff",
  optimizeOrder: true,
};

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Parse a #rgb / #rrggbb hex string to [r,g,b] (0–255). Falls back to white. */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [255, 255, 255];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** True when a background is dark enough that foreground text should be light. */
export function isDarkBackground(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  // Perceived luminance (ITU-R BT.601).
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

/**
 * Foreground palette derived from a background color, so the graph stays legible
 * on any custom background — light text/strokes on dark backgrounds and vice
 * versa. `casing` is the halo drawn under edges/labels to separate crossings;
 * it matches the background so lines read as "cut out" from it.
 */
export interface Palette {
  /** Primary ink (titles, node names, node text fallback). */
  ink: string;
  /** Muted ink (subtitle, footer). */
  muted: string;
  /** Faint ink (generated-line, dotted ring). */
  faint: string;
  /** Halo/casing under edges & labels (≈ the background). */
  casing: string;
  /** Node chip fill. */
  chip: string;
  /** Node chip stroke. */
  chipStroke: string;
  /** Mono edge color when colorBySource is off. */
  mono: string;
}

export function paletteFor(background: string): Palette {
  const dark = isDarkBackground(background);
  return dark
    ? {
        ink: "#f4f4f5",
        muted: "#a1a1aa",
        faint: "#52525b",
        casing: background,
        chip: "#000000",
        chipStroke: "#3f3f46",
        mono: "#f4f4f5",
      }
    : {
        ink: "#16161a",
        muted: "#6b7280",
        faint: "#9ca3af",
        casing: background,
        chip: "#16161a",
        chipStroke: "#2a2a31",
        mono: "#16161a",
      };
}

/**
 * Geometry of the attribution badge drawn in the top chrome band, just below the
 * subtitle and above the ring. Returned as plain coordinates so BOTH renderers —
 * the React preview (RelationshipGraph.tsx) and the Node export (svg.ts) — place
 * every piece identically; only the markup (web `<img>` path vs. base64 data URI,
 * `<a>` links vs. none) differs. The chrome band is a fixed 130px tall, and the
 * topmost ring node sits at y≈194, so this two-line badge lives in the ~100–194
 * gap. Centered on `cx` (the canvas mid-line). Width budgets are approximate —
 * they only balance the centered group, like the export footer's own estimates.
 */
export interface BadgeLayout {
  /** Line 1 — attribution text ("by thinkthinking |"), left edge at x. */
  attr: { x: number; y: number; fontSize: number };
  /** Line 1 — ZenMux wordmark image rect, following the text. */
  logo: { x: number; y: number; w: number; h: number };
  /** Line 2 — GitHub mark + repo label, centered as a unit. */
  repo: {
    mark: { x: number; y: number; size: number };
    text: { x: number; y: number; fontSize: number };
  };
}

export function badgeLayout(cx: number): BadgeLayout {
  // Line 1: "by thinkthinking |" + ZenMux wordmark, centered as a group. The
  // brand shows ONCE (as the logo), so the text deliberately omits "ZenMux.ai".
  const attrFont = 16;
  const attrW = 122; // approx render width of "by thinkthinking |" at 16px
  const gap1 = 8;
  const logoW = 84;
  const logoH = 25;
  const line1 = 138; // text baseline
  const group1 = attrW + gap1 + logoW;
  const startX1 = cx - group1 / 2;

  // Line 2: GitHub mark + repo label centered as a group.
  const markSize = 13;
  const gap2 = 6;
  const repoW = 210; // approx render width of REPO_LABEL at 12.5px monospace
  const line2 = 166; // text baseline
  const group2 = markSize + gap2 + repoW;
  const startX2 = cx - group2 / 2;

  return {
    attr: { x: startX1, y: line1, fontSize: attrFont },
    // Wordmark sits on the text baseline: nudge it up so its optical center
    // aligns with the lowercase text (logoH ≈ 25, baseline minus ~19).
    logo: { x: startX1 + attrW + gap1, y: line1 - 19, w: logoW, h: logoH },
    repo: {
      mark: { x: startX2, y: line2 - markSize + 2, size: markSize },
      text: { x: startX2 + markSize + gap2, y: line2, fontSize: 12.5 },
    },
  };
}

/**
 * Build a layout that auto-scales to the number of nodes so the ring (and the
 * interior the edges sweep through) stays uncrowded regardless of vendor count.
 * The ring radius grows so that adjacent circles + their name labels never
 * touch; `cfg.ringScale` then stretches/compresses that baseline (spacing),
 * and `cfg.nodeRadius`/`cfg.nodeGap` size the chips and the gap between them.
 * The canvas is sized to the ring plus margins (and optional title/footer chrome).
 */
export function makeLayout(nodeCount: number, cfg: Partial<RenderConfig> = {}): GraphLayout {
  const chrome = cfg.chrome ?? true;
  const ringScale = cfg.ringScale ?? 1;
  const nodeGap = cfg.nodeGap ?? DEFAULT_RENDER.nodeGap;
  const n = Math.max(1, nodeCount);
  // Default chip radius shrinks as nodes are added; an explicit cfg.nodeRadius wins.
  const nodeRadius = cfg.nodeRadius ?? clamp(Math.round(1100 / Math.max(8, n)), 36, 58);
  // Arc length we want per node so neighbouring circles keep a clear gap.
  const perNode = nodeRadius * 2 + nodeGap;
  const baseRadius = Math.max(380, Math.round((n * perNode) / (2 * Math.PI)));
  const radius = Math.round(baseRadius * ringScale);
  // Room outside the ring for a node circle + its name label below it.
  const ringMargin = nodeRadius + 64;
  const ringSpan = (radius + ringMargin) * 2;
  const top = chrome ? 130 : ringMargin;
  const bottom = chrome ? 96 : ringMargin;
  const width = ringSpan;
  const height = ringSpan + top + bottom;
  return {
    width,
    height,
    center: { x: width / 2, y: top + ringSpan / 2 },
    radius,
    nodeRadius,
  };
}

/** Place vendor nodes evenly on a circle, starting at the top (−90°), clockwise. */
export function nodePositions(vendors: { id: VendorId }[], layout: GraphLayout): Map<VendorId, Point> {
  const out = new Map<VendorId, Point>();
  const n = vendors.length;
  vendors.forEach((v, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, n);
    out.set(v.id, {
      x: layout.center.x + layout.radius * Math.cos(angle),
      y: layout.center.y + layout.radius * Math.sin(angle),
    });
  });
  return out;
}

/**
 * Signed shortest angular distance from `a` to `b` on a circle, in radians.
 * Result is always in [-π, π], so sin(diff) correctly points "the short way".
 */
export function shortestAngularDiff(a: number, b: number): number {
  let d = b - a;
  // Normalise to [0, 2π) — the double-mod handles JS negative %.
  d = ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  return d;
}

/**
 * Reorder vendor nodes so that strongly-connected pairs sit as far apart as
 * possible on the ring, improving edge readability.
 *
 * Uses gradient descent on continuous angular positions: minimises
 * Σ w_ij · cos(d_ij) so connected nodes settle near opposite sides (cos π = -1),
 * with a weak regularisation toward even spacing that keeps isolated nodes in
 * place. After convergence the angles are sorted to produce the final ring order.
 *
 * Deterministic — same inputs always produce the same output.
 */
export function optimizeNodeOrder(
  vendors: { id: VendorId }[],
  edges: { from: VendorId; to: VendorId; probability: number }[],
): { id: VendorId }[] {
  const n = vendors.length;
  if (n <= 2) return vendors.map((v) => ({ id: v.id }));

  // ── Build symmetric weight matrix ───────────────────────────────
  const idx = new Map(vendors.map((v, i) => [v.id, i]));
  const W: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const e of edges) {
    const i = idx.get(e.from);
    const j = idx.get(e.to);
    if (i !== undefined && j !== undefined && i !== j) {
      W[i][j] += e.probability;
    }
  }
  // Symmetrise: total bidirectional confusion
  let maxW = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const w = W[i][j] + W[j][i];
      W[i][j] = W[j][i] = w;
      if (w > maxW) maxW = w;
    }
  }
  // All-zero: nothing to optimise, return input order.
  if (maxW === 0) return vendors.map((v) => ({ id: v.id }));

  // Normalise by global max so the largest force is ≤ 1.0.
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) W[i][j] /= maxW;

  // Per-node weight sum for gradient normalisation (avoids high-degree
  // nodes rocketing past their neighbours in a single step).
  const sumW = W.map((row) => row.reduce((s, w) => s + w, 0));

  // ── Gradient descent ────────────────────────────────────────────
  const TWO_PI = 2 * Math.PI;
  const LR = 0.01; // learning rate
  const LAMBDA = 0.05; // regularisation strength
  const ITER = 300;

  const theta = vendors.map((_, i) => (TWO_PI * i) / n); // even spacing
  const init = [...theta];

  for (let iter = 0; iter < ITER; iter++) {
    for (let i = 0; i < n; i++) {
      // Edge repulsion: push i away from every connected node j.
      let edgeGrad = 0;
      for (let j = 0; j < n; j++) {
        if (i === j || W[i][j] === 0) continue;
        // sin(shortestDiff(j,i)) > 0 when j is ahead (short way),
        // pushing i backward — away from j. Both directions handled
        // by the shortest-diff sign.
        edgeGrad += W[i][j] * Math.sin(shortestAngularDiff(theta[j], theta[i]));
      }
      // Normalise so the gradient magnitude doesn't grow with degree.
      if (sumW[i] > 0) edgeGrad /= sumW[i];

      // Regularisation: weak pull toward initial even-spacing anchor.
      const regGrad = LAMBDA * Math.sin(shortestAngularDiff(theta[i], init[i]));

      theta[i] += LR * (edgeGrad + regGrad);
    }
    // Re-wrap angles to [0, 2π) each iteration.
    for (let i = 0; i < n; i++) {
      theta[i] = ((theta[i] % TWO_PI) + TWO_PI) % TWO_PI;
    }
  }

  // ── Sort by final angle, rotate so the top (−π/2) starts ───────
  const indexed = vendors.map((v, i) => ({ id: v.id, angle: theta[i] }));
  indexed.sort((a, b) => a.angle - b.angle);

  // Find the node closest to 3π/2 (which is −π/2 mod 2π, the "top").
  const target = (3 * Math.PI) / 2;
  let topIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < n; i++) {
    const a = indexed[i].angle;
    const d = Math.abs(a - target);
    const dist = Math.min(d, TWO_PI - d);
    if (dist < bestDist) {
      bestDist = dist;
      topIdx = i;
    }
  }

  return [
    ...indexed.slice(topIdx).map((x) => ({ id: x.id })),
    ...indexed.slice(0, topIdx).map((x) => ({ id: x.id })),
  ];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ArrowGeometry {
  path: string;
  head: string;
  label: Point;
}

/**
 * A user reshape of one edge, expressed in the chord's LOCAL frame so it stays
 * attached to its endpoints when the ring reflows (e.g. after a vendor is
 * hidden). Both components are signed fractions of the chord length:
 *  - `bow`   : perpendicular offset of the apex (the default curve uses
 *              `RenderConfig.curveBow`; an override replaces it per edge).
 *  - `along` : offset of the apex parallel to the chord (0 = mid-chord). Lets
 *              the user slide the bend toward either endpoint, not just push it
 *              out — so two near-parallel edges can be pulled fully apart.
 */
export interface CurveOverride {
  bow: number;
  along: number;
}

/** Per-edge curve overrides, keyed by edgeKey(from, to). */
export type EdgeCurves = Record<string, CurveOverride>;

/** Stable identifier for a directed edge — matches the React key used in the graph. */
export function edgeKey(from: VendorId, to: VendorId): string {
  return `${from}->${to}`;
}

const CURVE_BOW_LIMIT = 1.6;
const CURVE_ALONG_LIMIT = 0.9;

/** Clamp a (possibly untrusted) curve override to sane bounds; coerce non-finite to 0. */
export function sanitizeCurve(c: { bow?: unknown; along?: unknown } | null | undefined): CurveOverride {
  const bow = typeof c?.bow === "number" && Number.isFinite(c.bow) ? c.bow : 0;
  const along = typeof c?.along === "number" && Number.isFinite(c.along) ? c.along : 0;
  return {
    bow: clamp(bow, -CURVE_BOW_LIMIT, CURVE_BOW_LIMIT),
    along: clamp(along, -CURVE_ALONG_LIMIT, CURVE_ALONG_LIMIT),
  };
}

interface ChordFrame {
  /** Trimmed start (offset off the source chip). */
  sx: number;
  sy: number;
  /** Trimmed end (offset off the target chip, leaving room for the arrowhead). */
  ex: number;
  ey: number;
  /** Midpoint of the trimmed chord. */
  mx: number;
  my: number;
  /** Full center-to-center distance — the scale `bow`/`along` are fractions of. */
  len: number;
  /** Chord unit vector (from → to). */
  ux: number;
  uy: number;
  /** Perpendicular unit vector (−uy, ux). */
  px: number;
  py: number;
}

/** The geometry both curvedArrow and apexToCurve build on, so they stay in lockstep. */
function chordFrame(from: Point, to: Point, nodeRadius: number): ChordFrame {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const gap = nodeRadius + 10;
  const sx = from.x + ux * gap;
  const sy = from.y + uy * gap;
  const ex = to.x - ux * (gap + 6);
  const ey = to.y - uy * (gap + 6);
  return {
    sx,
    sy,
    ex,
    ey,
    mx: (sx + ex) / 2,
    my: (sy + ey) / 2,
    len,
    ux,
    uy,
    px: -uy,
    py: ux,
  };
}

/**
 * Curved arrow between two node centers, trimmed to the node circles and bowed
 * perpendicular to the chord so A→B and B→A do not overlap. `bow` pushes the
 * apex out perpendicular to the chord; the optional `along` slides it parallel
 * to the chord (0 = centered). Both are fractions of the chord length.
 */
export function curvedArrow(
  from: Point,
  to: Point,
  nodeRadius: number,
  bow = 0.18,
  along = 0,
): ArrowGeometry {
  const f = chordFrame(from, to, nodeRadius);
  const cx = f.mx + f.px * f.len * bow + f.ux * f.len * along;
  const cy = f.my + f.py * f.len * bow + f.uy * f.len * along;
  const adx = f.ex - cx;
  const ady = f.ey - cy;
  const al = Math.hypot(adx, ady) || 1;
  const aux = adx / al;
  const auy = ady / al;
  const headLen = 18;
  const headW = 9;
  const baseX = f.ex - aux * headLen;
  const baseY = f.ey - auy * headLen;
  const lx = baseX - auy * headW;
  const ly = baseY + aux * headW;
  const rx = baseX + auy * headW;
  const ry = baseY - aux * headW;
  const t = 0.5;
  const labelX = (1 - t) * (1 - t) * f.sx + 2 * (1 - t) * t * cx + t * t * f.ex;
  const labelY = (1 - t) * (1 - t) * f.sy + 2 * (1 - t) * t * cy + t * t * f.ey;
  return {
    path: `M ${round(f.sx)} ${round(f.sy)} Q ${round(cx)} ${round(cy)} ${round(f.ex)} ${round(f.ey)}`,
    head: `${round(f.ex)},${round(f.ey)} ${round(lx)},${round(ly)} ${round(rx)},${round(ry)}`,
    label: { x: labelX, y: labelY },
  };
}

/**
 * Inverse of curvedArrow's apex (its t=0.5 point, which is also where the label
 * and the drag handle sit): given a target apex the user dragged to, return the
 * {bow, along} that reproduces it. Because the apex of a quadratic Bézier is
 * `m + ½·perp·L·bow + ½·chord·L·along`, we just project the apex offset onto the
 * chord frame and double it. Result is clamped via sanitizeCurve.
 */
export function apexToCurve(from: Point, to: Point, nodeRadius: number, apex: Point): CurveOverride {
  const f = chordFrame(from, to, nodeRadius);
  const dx = apex.x - f.mx;
  const dy = apex.y - f.my;
  return sanitizeCurve({
    bow: (2 * (dx * f.px + dy * f.py)) / f.len,
    along: (2 * (dx * f.ux + dy * f.uy)) / f.len,
  });
}

/** Deterministic, pleasant edge color per source vendor. */
export function vendorColor(id: VendorId): string {
  const palette: Partial<Record<VendorId, string>> = {
    anthropic: "#d97757",
    openai: "#10a37f",
    google: "#4285f4",
    deepseek: "#4d6bfe",
    qwen: "#7b5cff",
    baidu: "#2932e1",
    bytedance: "#1664ff",
    moonshot: "#111827",
    "z-ai": "#1a73e8",
    stepfun: "#005bff",
    "x-ai": "#52525b",
    minimax: "#ff2d6f",
    kwai: "#ff6200",
    xiaomi: "#ff6900",
    tencent: "#2d7ff9",
    inclusionai: "#3b82f6",
    meta: "#0064e0",
    mistral: "#fa520f",
    agnes: "#6d28d9",
    // Analytical buckets — muted gray so they read as "not a real vendor" when
    // opted into the ring, instead of getting an arbitrary hashed hue below.
    unknown: "#9ca3af",
    refused: "#6b7280",
  };
  if (palette[id]) return palette[id]!;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 65% 45%)`;
}

const PSEUDO: VendorId[] = ["self", "unknown", "refused", "other"];

/**
 * True for the analytical buckets that never get a circle on the ring:
 * `self`, `unknown`, `refused`, and the bare `other` parent. Dynamic
 * per-brand ids of the form `other:<slug>` are NOT pseudo — they render
 * as named nodes (text label, no logo).
 */
export function isPseudo(id: VendorId): boolean {
  return PSEUDO.includes(id);
}

/** Aggregates that can never be a ring node or an edge target. */
const NON_NODE: VendorId[] = ["self", "other"];

/**
 * STRUCTURAL test: ids that never get a circle on the ring (nor land as an edge
 * target). Only `self` (the derived correct-claim bucket) and the bare `other`
 * parent qualify — `unknown`/`refused` and the dynamic `other:<slug>` brands ARE
 * drawable nodes now. This is the node/edge-drawing gate; it must keep `self`
 * excluded because self-edges (from=real vendor, to="self") are NOT caught by an
 * `e.from !== e.to` filter.
 */
export function isNonNode(id: VendorId): boolean {
  return NON_NODE.includes(id);
}

/**
 * UI DEFAULT test: nodes that exist on the ring but start UNCHECKED in the vendor
 * picker, so the default graph is just the canonical registry vendors. Covers the
 * two analytical buckets plus every extractor-discovered `other:<slug>` brand.
 * Registry-free on purpose (keeps this module client-safe): over the post-aggregate
 * node domain — canonical ∪ {unknown,refused} ∪ {other:*} — "not canonical" is
 * exactly this structural test, so no import of the vendor registry is needed.
 */
export function isOffByDefault(id: VendorId): boolean {
  return id === "unknown" || id === "refused" || id.startsWith("other:");
}

/** Edge weight under an optional language filter (uses edge.byLang). */
export function edgeWeight(edge: Edge, langCode?: string): { p: number; count: number; total: number } {
  if (langCode) {
    const b = edge.byLang?.[langCode];
    if (!b || b.total === 0) return { p: 0, count: 0, total: 0 };
    return { p: b.count / b.total, count: b.count, total: b.total };
  }
  return { p: edge.probability, count: edge.count, total: edge.total };
}

export interface LangWeight {
  code: string;
  /** count / total within that language. */
  p: number;
  count: number;
  total: number;
}

/**
 * Per-language breakdown of one edge (A→B), one entry per language that has at
 * least one answer, sorted strongest-first. Used to label aggregate edges with
 * the language(s) that drive the confusion (e.g. "简体中文 40% · English 20%").
 */
export function edgeLangWeights(edge: Edge): LangWeight[] {
  const out: LangWeight[] = [];
  for (const [code, b] of Object.entries(edge.byLang ?? {})) {
    if (b.total > 0) out.push({ code, p: b.count / b.total, count: b.count, total: b.total });
  }
  return out.sort((a, b) => b.p - a.p);
}
