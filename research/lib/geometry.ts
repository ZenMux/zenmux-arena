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
};

function clamp(n: number, lo: number, hi: number): number {
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

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ArrowGeometry {
  path: string;
  head: string;
  label: Point;
}

/**
 * Curved arrow between two node centers, trimmed to the node circles and bowed
 * perpendicular to the chord so A→B and B→A do not overlap.
 */
export function curvedArrow(from: Point, to: Point, nodeRadius: number, bow = 0.18): ArrowGeometry {
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
  const mx = (sx + ex) / 2;
  const my = (sy + ey) / 2;
  const px = -uy;
  const py = ux;
  const cx = mx + px * len * bow;
  const cy = my + py * len * bow;
  const adx = ex - cx;
  const ady = ey - cy;
  const al = Math.hypot(adx, ady) || 1;
  const aux = adx / al;
  const auy = ady / al;
  const headLen = 18;
  const headW = 9;
  const baseX = ex - aux * headLen;
  const baseY = ey - auy * headLen;
  const lx = baseX - auy * headW;
  const ly = baseY + aux * headW;
  const rx = baseX + auy * headW;
  const ry = baseY - aux * headW;
  const t = 0.5;
  const labelX = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex;
  const labelY = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey;
  return {
    path: `M ${round(sx)} ${round(sy)} Q ${round(cx)} ${round(cy)} ${round(ex)} ${round(ey)}`,
    head: `${round(ex)},${round(ey)} ${round(lx)},${round(ly)} ${round(rx)},${round(ry)}`,
    label: { x: labelX, y: labelY },
  };
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
