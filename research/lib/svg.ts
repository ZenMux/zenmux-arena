// Build the circular "who-points-to-whom" relationship graph as an SVG string.
// Embeds base64 logos (Node/fs side). Pure geometry lives in geometry.ts and is
// shared with the Next.js client component.

import { BADGE_TEXT, REPO_LABEL } from "./branding";
import {
  curvedArrow,
  DEFAULT_RENDER,
  type EdgeCurves,
  edgeKey,
  edgeLangWeights,
  edgeWeight,
  type GraphLayout,
  isDarkBackground,
  type LangWeight,
  makeLayout,
  nodePositions,
  paletteFor,
  type RenderConfig,
  sanitizeCurve,
  vendorColor,
} from "./geometry";
import type { GraphData, VendorId } from "./types";
import { logoDataUri, logoFileDataUri, VENDORS } from "./vendors";

export interface SvgOptions {
  /** Visual knobs (spacing, node size, edge width, label mode…). */
  config?: Partial<RenderConfig>;
  /** Explicit layout override (skips makeLayout). Rarely needed. */
  layout?: GraphLayout;
  /** Edges below this probability are not drawn. Overrides config.threshold. */
  threshold?: number;
  /** Only edges for this language (uses edge.byLang). Omit for aggregate. */
  langCode?: string;
  /** Draw the title/footer/branding chrome. Overrides config.chrome. */
  chrome?: boolean;
  /**
   * Vendor ids the user hid in the studio. They (and every edge touching them)
   * are dropped, and the ring reflows around the survivors — so the export
   * matches the on-screen, post-filter graph. Pseudo-vendors are already
   * excluded; this is for hiding real vendors.
   */
  hidden?: VendorId[];
  /** Per-edge curve reshapes from dragging in the studio, keyed by edgeKey. */
  curves?: EdgeCurves;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildGraphSvg(graph: GraphData, options: SvgOptions = {}): string {
  const cfg: RenderConfig = { ...DEFAULT_RENDER, ...options.config };
  // Back-compat: top-level threshold/chrome override the config fields.
  const threshold = options.threshold ?? cfg.threshold;
  const chrome = options.chrome ?? cfg.chrome;
  // Foreground palette adapts to the (custom) background so everything stays legible.
  const pal = paletteFor(cfg.background);

  // Only draw nodes for real vendors (pseudo-vendors aren't placed on the ring).
  // Dynamic `other:<slug>` brands ARE drawn (as labeled circles); only the
  // analytical buckets and the bare `other` parent are excluded from the ring.
  // A `hidden` set (vendors the user unchecked in the studio) drops more, so the
  // export reflows around exactly the vendors left on screen.
  const hidden = new Set(options.hidden ?? []);
  const realVendors = graph.vendors.filter(
    (v) => !["self", "unknown", "refused", "other"].includes(v.id) && !hidden.has(v.id),
  );
  // Layout auto-scales to the vendor count (and the config's spacing) so the ring never crowds.
  const layout = options.layout ?? makeLayout(realVendors.length, { ...cfg, chrome });
  const { width, height } = layout;
  const pos = nodePositions(realVendors, layout);

  // Confusion edges: from != to, to is a real vendor.
  //  - Language-filtered (langCode set): single rate for that language, p >= threshold.
  //  - Aggregate (no langCode): draw the edge if ANY language confuses A→B at
  //    p >= threshold, and label it with the per-language rates. `p` (used for
  //    stroke width + draw order) is the strongest single-language rate.
  const drawable = graph.edges
    .filter((e) => e.from !== e.to && !["self", "unknown", "refused", "other"].includes(e.to))
    .filter((e) => pos.has(e.from) && pos.has(e.to))
    .map((e) => {
      if (options.langCode) {
        const w = edgeWeight(e, options.langCode);
        return { e, p: w.p, langs: [] as LangWeight[] };
      }
      const langs = edgeLangWeights(e).filter((l) => l.p >= threshold);
      const p = langs.length ? langs[0].p : 0;
      return { e, p, langs };
    })
    .filter((x) => (options.langCode ? x.p >= threshold : x.langs.length > 0))
    .sort((a, b) => a.p - b.p); // weak first so strong edges render on top

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Noto Sans SC, Helvetica, Arial, sans-serif">`,
  );
  parts.push(`<rect width="${width}" height="${height}" fill="${cfg.background}"/>`);
  // subtle dotted backdrop ring
  parts.push(
    `<circle cx="${layout.center.x}" cy="${layout.center.y}" r="${layout.radius}" fill="none" stroke="${pal.faint}" stroke-opacity="0.4" stroke-width="1.5" stroke-dasharray="2 6"/>`,
  );

  // Title chrome
  if (chrome) {
    parts.push(
      `<text x="${width / 2}" y="64" text-anchor="middle" font-size="34" font-weight="700" fill="${pal.ink}">Who Are You?</text>`,
    );
    parts.push(
      `<text x="${width / 2}" y="98" text-anchor="middle" font-size="16" fill="${pal.muted}">Cross-Vendor Identity Confusion in Frontier LLMs${options.langCode ? ` · ${esc(langName(graph, options.langCode))}` : ""}</text>`,
    );
  }

  // Edges — colored per SOURCE vendor (configurable) so overlapping curves can be
  // told apart in the tangle. Stroke WIDTH scales with probability so strong
  // confusions read as heavier. A soft white casing is drawn under each line so
  // crossings stay legible.
  for (const { e, p, langs } of drawable) {
    const a = pos.get(e.from)!;
    const b = pos.get(e.to)!;
    // A dragged edge carries a per-edge {bow, along} override; otherwise fall
    // back to the global curveBow (centered, along=0).
    const ov = options.curves?.[edgeKey(e.from, e.to)];
    const curve = ov ? sanitizeCurve(ov) : { bow: cfg.curveBow, along: 0 };
    const arrow = curvedArrow(a, b, layout.nodeRadius, curve.bow, curve.along);
    const color = cfg.colorBySource ? vendorColor(e.from) : pal.mono;
    const sw = r2(cfg.edgeBaseWidth + p * cfg.edgeWidthScale);
    // Background-colored casing first (slightly wider) for separation where lines cross.
    parts.push(`<path d="${arrow.path}" fill="none" stroke="${pal.casing}" stroke-width="${r2(sw + 3)}" stroke-opacity="0.85" stroke-linecap="round"/>`);
    parts.push(`<path d="${arrow.path}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-opacity="0.95" stroke-linecap="round"/>`);
    parts.push(`<polygon points="${arrow.head}" fill="${color}" fill-opacity="0.98"/>`);

    // Labels with a background-colored halo for legibility over the lines.
    //  - Language-filtered view: a single "NN%".
    //  - Aggregate view, labelMode:
    //      "all"  → one line per language driving the edge (every language, flat)
    //      "top"  → dominant language + rate, plus a "+N" overflow badge
    //      "none" → no label
    if (options.langCode) {
      parts.push(edgeLabel(arrow.label.x, arrow.label.y, `${Math.round(p * 100)}%`, color, 15, pal.casing));
    } else if (cfg.labelMode !== "none" && langs.length) {
      if (cfg.labelMode === "top") {
        const top = langs[0];
        const extra = langs.length - 1;
        const text = `${esc(langName(graph, top.code))} ${Math.round(top.p * 100)}%${extra > 0 ? ` +${extra}` : ""}`;
        parts.push(edgeLabel(arrow.label.x, arrow.label.y, text, color, 13, pal.casing));
      } else {
        const lineH = 17;
        const startY = arrow.label.y - ((langs.length - 1) * lineH) / 2;
        langs.forEach((l, i) => {
          const text = `${esc(langName(graph, l.code))} ${Math.round(l.p * 100)}%`;
          parts.push(edgeLabel(arrow.label.x, startY + i * lineH, text, color, 13, pal.casing));
        });
      }
    }
  }

  // Nodes
  for (const v of realVendors) {
    const p = pos.get(v.id)!;
    const nr = layout.nodeRadius;
    // The chip stays dark regardless of background: the maker logos are white/light
    // variants, so they must sit on a dark fill to be visible.
    parts.push(
      `<circle cx="${r2(p.x)}" cy="${r2(p.y)}" r="${nr}" fill="${pal.chip}" stroke="${pal.chipStroke}" stroke-width="1.5"/>`,
    );
    const uri = logoDataUri(v.id);
    if (uri) {
      const s = nr * 1.15;
      parts.push(
        `<image href="${uri}" x="${r2(p.x - s / 2)}" y="${r2(p.y - s / 2)}" width="${r2(s)}" height="${r2(s)}" preserveAspectRatio="xMidYMid meet"/>`,
      );
    } else {
      // No logo (e.g. dynamic `other:<brand>`): render the name INSIDE the dark
      // chip — always light to read on the near-black fill.
      parts.push(
        `<text x="${r2(p.x)}" y="${r2(p.y)}" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="600" fill="#f4f4f5">${esc(v.name)}</text>`,
      );
    }
    // Name below the chip — only for logo nodes (logo-less nodes show it inside,
    // so repeating it here would duplicate the label).
    if (uri) {
      parts.push(
        `<text x="${r2(p.x)}" y="${r2(p.y + nr + 20)}" text-anchor="middle" font-size="15" font-weight="600" fill="${pal.ink}">${esc(v.name)}</text>`,
      );
    }
  }

  // Footer branding
  if (chrome) {
    const fy = height - 46;
    // Pick the wordmark variant that reads on the current background:
    // ZenMux-Light.png is dark ink (for light bg); ZenMux.png is the light variant.
    const zen = logoFileDataUri(isDarkBackground(cfg.background) ? "ZenMux.png" : "ZenMux-Light.png");
    const text = BADGE_TEXT;
    if (zen) {
      // logo (wide wordmark) + text centered as a unit
      const tw = 230; // approx text width budget
      const logoW = 86;
      const logoH = 26;
      const groupW = logoW + 12 + tw;
      const startX = width / 2 - groupW / 2;
      parts.push(`<image href="${zen}" x="${r2(startX)}" y="${r2(fy - 19)}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet"/>`);
      parts.push(
        `<text x="${r2(startX + logoW + 12)}" y="${r2(fy - 1)}" font-size="16" fill="${pal.muted}">${esc(text)}</text>`,
      );
    } else {
      parts.push(`<text x="${width / 2}" y="${fy}" text-anchor="middle" font-size="16" fill="${pal.muted}">${esc(text)}</text>`);
    }
    parts.push(
      `<text x="${width / 2}" y="${height - 22}" text-anchor="middle" font-size="11" fill="${pal.faint}">Generated ${esc(graph.generatedAt)} · run ${esc(graph.runId)} · n=${graph.summary.totalAnswers} answers · ${esc(REPO_LABEL)}</text>`,
    );
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}

function langName(graph: GraphData, code: string): string {
  return graph.languages.find((l) => l.code === code)?.name ?? code;
}

/** One edge label line: colored text with a background-colored halo (paint-order stroke). */
function edgeLabel(x: number, y: number, text: string, color: string, fontSize: number, casing: string): string {
  return `<text x="${r2(x)}" y="${r2(y)}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-weight="700" fill="${color}" stroke="${casing}" stroke-width="3.5" paint-order="stroke" style="paint-order:stroke">${text}</text>`;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Re-export for convenience.
export { VENDORS };
