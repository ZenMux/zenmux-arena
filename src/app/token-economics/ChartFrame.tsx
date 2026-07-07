"use client";

// A reusable wrapper that makes any chart EXPORTABLE as a PNG. It renders:
//   · a thin toolbar (NOT captured — it sits outside the capture node) with an
//     "Export PNG" button, and
//   · the capture frame: the chart itself (which already carries its own title,
//     description, and legend) followed by a permanent attribution footer
//     (author + site URL). Keeping the footer in the DOM makes the export WYSIWYG
//     and flash-free, and reads as intentional on the page.
//
// Capture uses html-to-image (client DOM → PNG). The one wrinkle is horizontal
// scroll: several charts wrap content in `overflow-x-auto`, which would clip the
// PNG at the viewport edge. Before capturing we expand every scrollable
// descendant to `overflow: visible` and shoot at the frame's full scrollWidth,
// then restore — so the exported image contains the whole chart.

import { useCallback, useRef, useState, type ReactNode } from "react";
import { toPng } from "html-to-image";
import { Download, Loader2 } from "lucide-react";

/** Canonical public URL stamped into every exported image. */
const SITE_URL = "arena.zenmux.ai/token-economics";
const AUTHOR_URL = "https://thinkthinking.ai";

/** The author's contact QR, baked into every exported image's footer. Served
 *  with `access-control-allow-origin: *`, so it embeds cleanly in the canvas
 *  capture (no taint) — we still set crossOrigin on the <img> to be safe. */
const AUTHOR_QR =
  "https://cdn.marmot-cloud.com/storage/zenmux/2026/01/23/fNSKOaq/wechat.png";

export function ChartFrame({
  filename,
  children,
}: {
  /** Base filename for the download, e.g. "leaderboard" → "token-economics-leaderboard.png". */
  filename: string;
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [exportedAt, setExportedAt] = useState<string | null>(null);

  const onExport = useCallback(async () => {
    const node = frameRef.current;
    if (!node || busy) return;
    setBusy(true);
    setExportedAt(new Date().toISOString());

    // Expand horizontally-scrollable descendants so nothing clips in the capture.
    const scrollers = Array.from(node.querySelectorAll<HTMLElement>("*")).filter(
      (el) => {
        const o = getComputedStyle(el).overflowX;
        return o === "auto" || o === "scroll";
      },
    );
    const saved = scrollers.map((el) => ({ el, overflowX: el.style.overflowX }));
    scrollers.forEach((el) => {
      el.style.overflowX = "visible";
    });

    try {
      // Let layout settle after expanding the scrollers.
      await nextFrame();
      await nextFrame();
      await waitForImages(node);
      const width = node.scrollWidth;
      const height = node.scrollHeight;
      const dataUrl = await toPng(node, {
        pixelRatio: 2, // crisp on retina + good print resolution
        backgroundColor: "#f4f1ea", // the route's cream paper
        width,
        height,
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `token-economics-${filename}.png`;
      a.click();
    } catch (err) {
      console.error("Chart export failed:", err);
    } finally {
      saved.forEach(({ el, overflowX }) => {
        el.style.overflowX = overflowX;
      });
      setBusy(false);
    }
  }, [busy, filename]);

  return (
    <div>
      {/* Toolbar — outside the capture frame (so it's never in the PNG). Its
          horizontal padding matches the frame's, so the button's right edge
          lines up with the chart content edge below it. */}
      <div className="mb-2 flex justify-end px-6">
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          className="inline-flex items-center gap-1.5 border border-[#141414] bg-[#fbf9f4] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors hover:bg-[#141414] hover:text-[#f4f1ea] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Download className="size-3" />
          )}
          {busy ? "Exporting…" : "Export PNG"}
        </button>
      </div>

      {/* Capture frame — chart + attribution footer. Padded so the exported PNG
          has a clean margin around the content. */}
      <div ref={frameRef} className="bg-[#f4f1ea] p-6">
        {children}

        {/* Attribution footer — author QR + site + canonical chart URL, baked into
            the export. */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#141414] pt-2.5">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={AUTHOR_QR}
              alt="thinkthinking contact QR"
              crossOrigin="anonymous"
              className="size-11 shrink-0 border border-[#141414] bg-white object-contain p-0.5"
            />
            <div className="leading-tight">
              <a
                href={AUTHOR_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold lowercase text-[#141414] underline decoration-[#141414]/30 underline-offset-2 transition-colors hover:decoration-[#141414]"
              >
                thinkthinking.ai
              </a>
              <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#6f6a5f]">
                ZenMux Arena · Token Economics
              </div>
            </div>
          </div>
          <div className="text-right font-mono text-[10px] tabular-nums text-[#6f6a5f]">
            <div>{SITE_URL}</div>
            <div className="mt-0.5 uppercase tracking-[0.08em]">
              {exportedAt ? `Exported ${formatLocal(exportedAt)}` : "Export time"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

// The exported image stamps the moment of export in the viewer's LOCAL
// timezone. Export only happens on a user click in the browser, so there's no
// SSR of this string to mismatch on. A short zone label (e.g. "GMT+8") is
// appended so the absolute instant stays unambiguous in the saved PNG.
function formatLocal(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const zone = get("timeZoneName");
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}${zone ? ` ${zone}` : ""}`;
}

async function waitForImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    images.map(async (img) => {
      if (img.complete && img.naturalWidth > 0) return;
      try {
        await img.decode();
      } catch {
        // html-to-image will still capture the rest of the frame if an optional
        // remote image fails to decode.
      }
    }),
  );
}
