// Build the circular "who-points-to-whom" relationship graph as an SVG string.
// Embeds base64 logos (Node/fs side). Pure geometry lives in geometry.ts and is
// shared with the Next.js client component.

import {
  AUTHOR_URL,
  BADGE_TEXT,
  GITHUB_MARK_PATH,
  REPO_LABEL,
  REPO_URL,
  ZENMUX_URL,
} from "./branding";
import {
  badgeLayout,
  curvedArrow,
  DEFAULT_RENDER,
  type EdgeCurves,
  edgeKey,
  edgeLangWeights,
  edgeWeight,
  edgeWeightColor,
  FOCUS_DIM,
  type GraphLayout,
  isDarkBackground,
  isEdgeActive,
  isNodeActive,
  isNonNode,
  type LangWeight,
  legendLayout,
  makeLayout,
  nodePositions,
  optimizeNodeOrder,
  paletteFor,
  type RenderConfig,
  sanitizeCurve,
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
  /**
   * Vendor ids the user FOCUSED via the studio's "eye" toggle. Unlike `hidden`,
   * focused vendors stay on the ring — they (and the nodes they share edges with)
   * render at full strength while everything else is dimmed, exactly like the
   * on-screen hover spotlight. Empty/omitted ⇒ no spotlight (all bright).
   */
  focused?: VendorId[];
  /** Per-edge curve reshapes from dragging in the studio, keyed by edgeKey. */
  curves?: EdgeCurves;
  /** When false (default), edge labels are hidden for a cleaner graph. */
  showEdgeLabels?: boolean;
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

  // Nodes drawn on the ring: canonical vendors, the analytical buckets
  // (unknown/refused), and dynamic `other:<slug>` brands. Only the structural
  // non-nodes (self, the bare `other` parent) are excluded. The studio's `hidden`
  // set drops more — and since unknown/refused/other:<brand> default to hidden in
  // the picker, the export reflows around exactly the vendors left on screen.
  const hidden = new Set(options.hidden ?? []);
  const ringVendors = graph.vendors.filter(
    (v) => !isNonNode(v.id) && !hidden.has(v.id),
  );
  // The "eye" spotlight, restricted to vendors actually on the ring — so a stale
  // focus on a since-hidden vendor can't dim the whole graph. Empty ⇒ no spotlight
  // (everything renders at full strength, the default look). Matches the live
  // preview's focusSet so a focused export is WYSIWYG.
  const ringIds = new Set(ringVendors.map((v) => v.id));
  const focus = new Set((options.focused ?? []).filter((id) => ringIds.has(id)));
  // When `optimizeOrder` is on, reorder the ring so strongly-connected pairs
  // sit far apart — thin direction edges stay readable.
  const orderedVendors = cfg.optimizeOrder
    ? optimizeNodeOrder(ringVendors, graph.edges)
    : ringVendors;
  // Layout auto-scales to the vendor count (and the config's spacing) so the ring never crowds.
  const layout = options.layout ?? makeLayout(ringVendors.length, { ...cfg, chrome });
  const { width, height } = layout;
  const pos = nodePositions(orderedVendors, layout);

  // Confusion edges: from != to, to is a real vendor.
  //  - Language-filtered (langCode set): single rate for that language, p >= threshold.
  //  - Aggregate (no langCode): draw the edge if ANY language confuses A→B at
  //    p >= threshold, and label it with the per-language rates. `p` (used for
  //    stroke width + draw order) is the strongest single-language rate.
  const drawable = graph.edges
    .filter((e) => e.from !== e.to && !isNonNode(e.to))
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
    // Attribution badge below the subtitle: "by thinkthinking |" + ZenMux
    // wordmark, then the repo line. Shares badgeLayout() with the on-screen
    // preview (RelationshipGraph.tsx) so the export is WYSIWYG. The brand shows
    // ONCE (as the logo → zenmux.ai); the text links to the author. <a href>
    // links survive in the downloaded SVG (live when opened in a browser); resvg
    // ignores them when flattening to PNG. The wordmark is inlined as a base64
    // data URI — pick the variant that reads on the current background
    // (ZenMux-Light.png is the DARK ink for light bg, ZenMux.png the light one).
    const b = badgeLayout(width / 2);
    const wordmark = logoFileDataUri(isDarkBackground(cfg.background) ? "ZenMux.png" : "ZenMux-Light.png");
    if (wordmark) {
      parts.push(
        `<a href="${AUTHOR_URL}" target="_blank" rel="noopener noreferrer"><text x="${r2(b.attr.x)}" y="${r2(b.attr.y)}" font-size="${b.attr.fontSize}" fill="${pal.muted}">${esc(BADGE_TEXT)}</text></a>`,
      );
      parts.push(
        `<a href="${ZENMUX_URL}" target="_blank" rel="noopener noreferrer"><image href="${wordmark}" x="${r2(b.logo.x)}" y="${r2(b.logo.y)}" width="${b.logo.w}" height="${b.logo.h}" preserveAspectRatio="xMidYMid meet"/></a>`,
      );
    } else {
      // No wordmark asset: center the text alone so the line still reads.
      parts.push(
        `<a href="${AUTHOR_URL}" target="_blank" rel="noopener noreferrer"><text x="${width / 2}" y="${r2(b.attr.y)}" text-anchor="middle" font-size="${b.attr.fontSize}" fill="${pal.muted}">${esc(BADGE_TEXT)}</text></a>`,
      );
    }
    // Repo line: GitHub mark (path, scaled from its 16px viewBox) + label → repo.
    parts.push(
      `<a href="${REPO_URL}" target="_blank" rel="noopener noreferrer"><g transform="translate(${r2(b.repo.mark.x)}, ${r2(b.repo.mark.y)}) scale(${r2(b.repo.mark.size / 16)})"><path d="${GITHUB_MARK_PATH}" fill="${pal.faint}"/></g><text x="${r2(b.repo.text.x)}" y="${r2(b.repo.text.y)}" font-size="${b.repo.text.fontSize}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="${pal.faint}">${esc(REPO_LABEL)}</text></a>`,
    );
  }

  // Edges — colored by CONFUSION STRENGTH (blue < 10% < amber < 20% ≤ red) so the
  // severity reads at a glance; stroke WIDTH also scales with probability so strong
  // confusions read as heavier. A soft background-colored casing is drawn under
  // each line so crossings stay legible.
  for (const { e, p, langs } of drawable) {
    const a = pos.get(e.from)!;
    const b = pos.get(e.to)!;
    // A dragged edge carries a per-edge {bow, along} override; otherwise fall
    // back to the global curveBow (centered, along=0).
    const ov = options.curves?.[edgeKey(e.from, e.to)];
    const curve = ov ? sanitizeCurve(ov) : { bow: cfg.curveBow, along: 0 };
    const arrow = curvedArrow(a, b, layout.nodeRadius, curve.bow, curve.along);
    const color = edgeWeightColor(p);
    const sw = r2(cfg.edgeBaseWidth + p * cfg.edgeWidthScale);
    // Under the eye spotlight, edges not touching a focused vendor recede — same
    // dimming the on-screen hover applies, so the export matches the screen.
    const active = isEdgeActive(e.from, e.to, focus);
    const casingOp = active ? 0.85 : FOCUS_DIM.casing;
    const lineOp = active ? 0.95 : 0.95 * FOCUS_DIM.edge;
    const headOp = active ? 0.98 : 0.98 * FOCUS_DIM.edge;
    // Background-colored casing first (slightly wider) for separation where lines cross.
    parts.push(`<path d="${arrow.path}" fill="none" stroke="${pal.casing}" stroke-width="${r2(sw + 3)}" stroke-opacity="${r2(casingOp)}" stroke-linecap="round"/>`);
    parts.push(`<path d="${arrow.path}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-opacity="${r2(lineOp)}" stroke-linecap="round"/>`);
    parts.push(`<polygon points="${arrow.head}" fill="${color}" fill-opacity="${r2(headOp)}"/>`);

    // Labels with a background-colored halo for legibility over the lines.
    //  - Language-filtered view: a single "NN%".
    //  - Aggregate view, labelMode:
    //      "all"  → one line per language driving the edge (every language, flat)
    //      "top"  → dominant language + rate, plus a "+N" overflow badge
    //      "none" → no label
    if (options.showEdgeLabels) {
    const labelOp = active ? 1 : FOCUS_DIM.label;
    if (options.langCode) {
      parts.push(edgeLabel(arrow.label.x, arrow.label.y, `${pctLabel(p)}%`, color, 15, pal.casing, labelOp));
    } else if (cfg.labelMode !== "none" && langs.length) {
      if (cfg.labelMode === "top") {
        const top = langs[0];
        const extra = langs.length - 1;
        const text = `${esc(langName(graph, top.code))} ${pctLabel(top.p)}%${extra > 0 ? ` +${extra}` : ""}`;
        parts.push(edgeLabel(arrow.label.x, arrow.label.y, text, color, 13, pal.casing, labelOp));
      } else {
        const lineH = 17;
        const startY = arrow.label.y - ((langs.length - 1) * lineH) / 2;
        langs.forEach((l, i) => {
          const text = `${esc(langName(graph, l.code))} ${pctLabel(l.p)}%`;
          parts.push(edgeLabel(arrow.label.x, startY + i * lineH, text, color, 13, pal.casing, labelOp));
        });
      }
    }
    }
  }

  // Nodes — under the eye spotlight, a node that is neither focused nor adjacent
  // to a focused vendor dims as a whole group (chip + logo + name), matching the
  // live preview. Neighbour detection uses the actually-drawn edges so it agrees
  // with what's on the canvas.
  const drawnEnds = drawable.map(({ e }) => ({ from: e.from, to: e.to }));
  for (const v of ringVendors) {
    const p = pos.get(v.id)!;
    const nr = layout.nodeRadius;
    const active = isNodeActive(v.id, focus, drawnEnds);
    const groupOpen = active ? `<g>` : `<g opacity="${FOCUS_DIM.node}">`;
    parts.push(groupOpen);
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
    parts.push(`</g>`);
  }

  // Reading-key legend + provenance footer (bottom chrome). The legend explains
  // the arrow semantics ("A → B = a model by A claims to be B") with a mini
  // sample edge; the footer carries run metadata. The wordmark + attribution
  // badge live in the TOP chrome (below the title), so the footer avoids
  // duplicating the branding.
  if (chrome) {
    const lg = legendLayout(width / 2, height - 62);
    // Mini sample edge: blue line + small arrowhead between two labelled dots.
    const sampleColor = edgeWeightColor(0); // blue — the base weight tier
    parts.push(
      `<line x1="${r2(lg.sample.x1)}" y1="${r2(lg.sample.y1)}" x2="${r2(lg.sample.x2)}" y2="${r2(lg.sample.y2)}" stroke="${sampleColor}" stroke-width="2.4" stroke-linecap="round"/>`,
    );
    parts.push(`<polygon points="${lg.sample.head}" fill="${sampleColor}"/>`);
    parts.push(
      `<circle cx="${r2(lg.dotA.x)}" cy="${r2(lg.dotA.y)}" r="${lg.dotA.r}" fill="${pal.ink}"/>`,
    );
    parts.push(
      `<circle cx="${r2(lg.dotB.x)}" cy="${r2(lg.dotB.y)}" r="${lg.dotB.r}" fill="${pal.ink}"/>`,
    );
    parts.push(
      `<text x="${r2(lg.aLabel.x)}" y="${r2(lg.aLabel.y)}" text-anchor="middle" font-size="${lg.aLabel.fontSize}" font-weight="700" fill="${pal.muted}">A</text>`,
    );
    parts.push(
      `<text x="${r2(lg.bLabel.x)}" y="${r2(lg.bLabel.y)}" text-anchor="middle" font-size="${lg.bLabel.fontSize}" font-weight="700" fill="${pal.muted}">B</text>`,
    );
    parts.push(
      `<text x="${r2(lg.text.x)}" y="${r2(lg.text.y)}" font-size="${lg.text.fontSize}" fill="${pal.muted}"><tspan font-weight="700" fill="${pal.ink}">A → B</tspan> = a model made by A identifies itself as B</text>`,
    );
    parts.push(
      `<text x="${width / 2}" y="${height - 28}" text-anchor="middle" font-size="11" fill="${pal.faint}">Generated ${esc(graph.generatedAt)} · run ${esc(graph.runId)} · n=${graph.summary.totalAnswers} answers · ${esc(REPO_LABEL)}</text>`,
    );
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}

function langName(graph: GraphData, code: string): string {
  return graph.languages.find((l) => l.code === code)?.name ?? code;
}

/** One edge label line: colored text with a background-colored halo (paint-order stroke). */
function edgeLabel(x: number, y: number, text: string, color: string, fontSize: number, casing: string, opacity = 1): string {
  const op = opacity < 1 ? ` opacity="${r2(opacity)}"` : "";
  return `<text x="${r2(x)}" y="${r2(y)}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-weight="700" fill="${color}" stroke="${casing}" stroke-width="3.5" paint-order="stroke" style="paint-order:stroke"${op}>${text}</text>`;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Edge-label percentage, two decimals (e.g. 0.0723 → "7.23"). */
function pctLabel(p: number): string {
  return (p * 100).toFixed(2);
}

// Re-export for convenience.
export { VENDORS };
