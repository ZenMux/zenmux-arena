// High-resolution export endpoint for the studio.
//
// Renders the SAME buildGraphSvg(graph, {config}) the on-screen preview uses,
// then either returns the raw SVG (vector) or rasterizes it via resvg at an
// arbitrary scale (crisp PNG with CJK glyphs + embedded logos). Because the
// studio's RenderConfig drives both the live preview and this route, the export
// is WYSIWYG with what the user sees.
//
// This is a Route Handler (not a Server Action) because it produces a binary
// file download — see next-best-practices/route-handlers.md.

import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import {
  DEFAULT_RENDER,
  type EdgeCurves,
  type RenderConfig,
  sanitizeCurve,
} from "@research/lib/geometry";
import { buildGraphSvg } from "@research/lib/svg";
import type { GraphData, VendorId } from "@research/lib/types";

export const runtime = "nodejs";

// Keep filesystem reads statically scoped to known project subfolders so the
// server-file tracer does not treat the whole repository as export input.
const FONT_PATH = `${process.cwd()}/research/assets/NotoSansSC-Regular.otf`;
// `<study>/<stamp>` — both segments are conservative slugs (no dots/slashes).
const RUN_RE = /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/;

interface ExportBody {
  run: string; // "<study>/<stamp>"
  graph?: GraphData; // current graph payload, already loaded by the Studio page
  lang?: string; // "" / undefined = aggregate
  scale?: number; // PNG pixel multiplier (1–4)
  format?: "png" | "svg";
  config?: Partial<RenderConfig>;
  hidden?: string[]; // vendor ids unchecked in the studio
  focused?: string[]; // vendor ids "eye"-focused in the studio (spotlight, not hide)
  curves?: Record<string, { bow?: number; along?: number }>; // per-edge drag reshapes
  showEdgeLabels?: boolean; // whether to render edge labels
}

/** Keep only string ids, so a malformed `hidden`/`focused` can't crash the renderer. */
function sanitizeIds(raw: unknown): VendorId[] {
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
}

/** Clamp every per-edge curve override; drop non-object entries. */
function sanitizeCurves(raw: unknown): EdgeCurves {
  if (!raw || typeof raw !== "object") return {};
  const out: EdgeCurves = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (val && typeof val === "object") {
      out[key] = sanitizeCurve(val as { bow?: number; along?: number });
    }
  }
  return out;
}

export async function POST(request: Request) {
  let body: ExportBody;
  try {
    body = (await request.json()) as ExportBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const run = String(body.run ?? "");
  if (!RUN_RE.test(run)) {
    return Response.json({ error: `Invalid run id "${run}".` }, { status: 400 });
  }
  if (!body.graph || typeof body.graph !== "object") {
    return Response.json({ error: "Missing graph payload." }, { status: 400 });
  }

  const graph = body.graph;
  const config: RenderConfig = { ...DEFAULT_RENDER, ...body.config };
  const langCode = body.lang || undefined;
  const format = body.format === "svg" ? "svg" : "png";
  const scale = Math.min(4, Math.max(1, Number(body.scale) || 2));
  const hidden = sanitizeIds(body.hidden);
  const focused = sanitizeIds(body.focused);
  const curves = sanitizeCurves(body.curves);

  const svg = buildGraphSvg(graph, { config, langCode, hidden, focused, curves, showEdgeLabels: body.showEdgeLabels });
  const stamp = run.split("/")[1] ?? "graph";
  const base = `who-are-you-${stamp}${langCode ? `-${langCode}` : ""}`;

  if (format === "svg") {
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.svg"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Rasterize at N× the SVG's intrinsic width.
  const widthMatch = svg.match(/width="(\d+(?:\.\d+)?)"/);
  const svgWidth = widthMatch ? Number(widthMatch[1]) : 1200;
  const fontFiles = fs.existsSync(FONT_PATH) ? [FONT_PATH] : [];
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: Math.round(svgWidth * scale) },
    font: { fontFiles, loadSystemFonts: true, defaultFontFamily: "Noto Sans SC" },
    background: config.background,
  });
  const png = resvg.render().asPng();

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${base}@${scale}x.png"`,
      "Cache-Control": "no-store",
    },
  });
}
