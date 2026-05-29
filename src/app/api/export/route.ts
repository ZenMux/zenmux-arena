// High-resolution export endpoint for the studio.
//
// Renders the SAME buildGraphSvg(graph, {config}) the on-screen preview uses,
// then either returns the raw SVG (vector) or rasterizes it via resvg at an
// arbitrary scale (crisp PNG with CJK glyphs + embedded logos). Because the
// studio's RenderConfig drives both the live preview and this route, the export
// is WYSIWYG with what the user sees.
//
// This is a Route Handler (not a Server Action) because it consumes an external
// artifact (a results/ folder) and produces a binary file download — see
// next-best-practices/route-handlers.md.

import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_RENDER, type RenderConfig } from "@research/lib/geometry";
import { buildGraphSvg } from "@research/lib/svg";
import type { GraphData } from "@research/lib/types";

export const runtime = "nodejs";

const RESULTS_DIR = path.join(process.cwd(), "results");
const FONT_PATH = path.join(process.cwd(), "research", "assets", "NotoSansSC-Regular.otf");
// `<study>/<stamp>` — both segments are conservative slugs (no dots/slashes).
const RUN_RE = /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/;

interface ExportBody {
  run: string; // "<study>/<stamp>"
  lang?: string; // "" / undefined = aggregate
  scale?: number; // PNG pixel multiplier (1–4)
  format?: "png" | "svg";
  config?: Partial<RenderConfig>;
}

/** Resolve + validate a run id to its aggregate.json path, refusing traversal. */
function resolveAggregate(run: string): string | null {
  if (!RUN_RE.test(run)) return null;
  const dir = path.resolve(RESULTS_DIR, run);
  // Must stay inside results/ (defense-in-depth on top of the regex).
  if (dir !== RESULTS_DIR && !dir.startsWith(RESULTS_DIR + path.sep)) return null;
  const file = path.join(dir, "aggregate.json");
  return fs.existsSync(file) ? file : null;
}

export async function POST(request: Request) {
  let body: ExportBody;
  try {
    body = (await request.json()) as ExportBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const run = String(body.run ?? "");
  const aggregatePath = resolveAggregate(run);
  if (!aggregatePath) {
    return Response.json({ error: `Run "${run}" not found.` }, { status: 404 });
  }

  let graph: GraphData;
  try {
    graph = JSON.parse(fs.readFileSync(aggregatePath, "utf8")) as GraphData;
  } catch {
    return Response.json({ error: "Could not read aggregate.json." }, { status: 500 });
  }

  const config: RenderConfig = { ...DEFAULT_RENDER, ...body.config };
  const langCode = body.lang || undefined;
  const format = body.format === "svg" ? "svg" : "png";
  const scale = Math.min(4, Math.max(1, Number(body.scale) || 2));

  const svg = buildGraphSvg(graph, { config, langCode });
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
