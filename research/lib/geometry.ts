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
    "baidu-ernie": "#2932e1",
    doubao: "#1664ff",
    moonshot: "#16161a",
    zhipu: "#1a73e8",
    stepfun: "#005bff",
    xai: "#16161a",
    minimax: "#ff2d6f",
    kwai: "#ff6200",
    xiaomi: "#ff6900",
    tencent: "#2d7ff9",
    inclusion: "#3b82f6",
  };
  if (palette[id]) return palette[id]!;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 65% 45%)`;
}

const PSEUDO: VendorId[] = ["self", "unknown", "refused"];

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
