// Build the circular "who-points-to-whom" relationship graph as an SVG string.
// Embeds base64 logos (Node/fs side). Pure geometry lives in geometry.ts and is
// shared with the Next.js client component.

import {
  curvedArrow,
  DEFAULT_LAYOUT,
  edgeWeight,
  type GraphLayout,
  nodePositions,
  vendorColor,
} from "./geometry";
import type { GraphData } from "./types";
import { logoDataUri, logoFileDataUri, VENDORS } from "./vendors";

export interface SvgOptions {
  layout?: GraphLayout;
  /** Edges below this probability are not drawn (cuts noise). */
  threshold?: number;
  /** Only edges for this language (uses edge.byLang). Omit for aggregate. */
  langCode?: string;
  /** Draw the title/footer/branding chrome. */
  chrome?: boolean;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildGraphSvg(graph: GraphData, options: SvgOptions = {}): string {
  const layout = options.layout ?? DEFAULT_LAYOUT;
  const threshold = options.threshold ?? 0.01;
  const chrome = options.chrome ?? true;
  const { width, height } = layout;

  // Only draw nodes for real vendors (pseudo-vendors aren't placed on the ring).
  const realVendors = graph.vendors.filter((v) => !["self", "unknown", "refused"].includes(v.id));
  const pos = nodePositions(realVendors, layout);

  // Confusion edges: from != to, to is a real vendor, p >= threshold.
  const drawable = graph.edges
    .filter((e) => e.from !== e.to && !["self", "unknown", "refused"].includes(e.to))
    .map((e) => ({ e, w: edgeWeight(e, options.langCode) }))
    .filter((x) => x.w.p >= threshold && pos.has(x.e.from) && pos.has(x.e.to))
    .sort((a, b) => a.w.p - b.w.p); // weak first so strong edges render on top

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Noto Sans SC, Helvetica, Arial, sans-serif">`,
  );
  parts.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);
  // subtle dotted backdrop ring
  parts.push(
    `<circle cx="${layout.center.x}" cy="${layout.center.y}" r="${layout.radius}" fill="none" stroke="#eceef2" stroke-width="1.5" stroke-dasharray="2 6"/>`,
  );

  // Title chrome
  if (chrome) {
    parts.push(
      `<text x="${width / 2}" y="64" text-anchor="middle" font-size="34" font-weight="700" fill="#16161a">Who Are You?</text>`,
    );
    parts.push(
      `<text x="${width / 2}" y="98" text-anchor="middle" font-size="16" fill="#6b7280">Cross-Vendor Identity Confusion in Frontier LLMs${options.langCode ? ` · ${esc(langName(graph, options.langCode))}` : ""}</text>`,
    );
  }

  // Edges — solid black arrows. Stroke WIDTH scales with probability (so strong
  // confusions read as heavier), but every drawn edge stays fully opaque & legible
  // on the white background, including rare 1–2% edges.
  const EDGE_COLOR = "#16161a";
  for (const { e, w } of drawable) {
    const a = pos.get(e.from)!;
    const b = pos.get(e.to)!;
    const arrow = curvedArrow(a, b, layout.nodeRadius);
    const sw = 1.6 + w.p * 10; // 1.6px at 0% → ~11.6px at 100%
    parts.push(`<path d="${arrow.path}" fill="none" stroke="${EDGE_COLOR}" stroke-width="${r2(sw)}" stroke-opacity="0.92" stroke-linecap="round"/>`);
    parts.push(`<polygon points="${arrow.head}" fill="${EDGE_COLOR}" fill-opacity="0.95"/>`);
    // Probability label with white halo for legibility over lines.
    const label = `${Math.round(w.p * 100)}%`;
    parts.push(
      `<text x="${r2(arrow.label.x)}" y="${r2(arrow.label.y)}" text-anchor="middle" dominant-baseline="middle" font-size="15" font-weight="700" fill="${EDGE_COLOR}" stroke="#ffffff" stroke-width="3.5" paint-order="stroke" style="paint-order:stroke">${label}</text>`,
    );
  }

  // Nodes
  for (const v of realVendors) {
    const p = pos.get(v.id)!;
    const nr = layout.nodeRadius;
    // Dark chip: the maker logos are white/light variants, so they read on a dark fill.
    parts.push(
      `<circle cx="${r2(p.x)}" cy="${r2(p.y)}" r="${nr}" fill="#16161a" stroke="#2a2a31" stroke-width="1.5"/>`,
    );
    const uri = logoDataUri(v.id);
    if (uri) {
      const s = nr * 1.15;
      parts.push(
        `<image href="${uri}" x="${r2(p.x - s / 2)}" y="${r2(p.y - s / 2)}" width="${r2(s)}" height="${r2(s)}" preserveAspectRatio="xMidYMid meet"/>`,
      );
    } else {
      parts.push(
        `<text x="${r2(p.x)}" y="${r2(p.y)}" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="#374151">${esc(v.name)}</text>`,
      );
    }
    parts.push(
      `<text x="${r2(p.x)}" y="${r2(p.y + nr + 20)}" text-anchor="middle" font-size="15" font-weight="600" fill="#16161a">${esc(v.name)}</text>`,
    );
  }

  // Footer branding
  if (chrome) {
    const fy = height - 46;
    // ZenMux-Light.png is the dark-ink variant, legible on the white footer.
    const zen = logoFileDataUri("ZenMux-Light.png");
    const text = "以上研究由 thinkthinking | ZenMux.ai 测试";
    if (zen) {
      // logo (wide wordmark) + text centered as a unit
      const tw = 230; // approx text width budget
      const logoW = 86;
      const logoH = 26;
      const groupW = logoW + 12 + tw;
      const startX = width / 2 - groupW / 2;
      parts.push(`<image href="${zen}" x="${r2(startX)}" y="${r2(fy - 19)}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet"/>`);
      parts.push(
        `<text x="${r2(startX + logoW + 12)}" y="${r2(fy - 1)}" font-size="16" fill="#374151">${esc(text)}</text>`,
      );
    } else {
      parts.push(`<text x="${width / 2}" y="${fy}" text-anchor="middle" font-size="16" fill="#374151">${esc(text)}</text>`);
    }
    parts.push(
      `<text x="${width / 2}" y="${height - 22}" text-anchor="middle" font-size="11" fill="#9ca3af">Generated ${esc(graph.generatedAt)} · run ${esc(graph.runId)} · n=${graph.summary.totalAnswers} answers</text>`,
    );
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}

function langName(graph: GraphData, code: string): string {
  return graph.languages.find((l) => l.code === code)?.name ?? code;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Re-export for convenience.
export { VENDORS };
