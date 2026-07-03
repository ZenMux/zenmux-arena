"use client";

// Exportable chart wrapper for Token Deals — the same capture mechanics as the
// token-economics ChartFrame (html-to-image, scroller expansion, attribution
// footer) but stamped with THIS experiment's canonical URL and filename prefix.
// Kept as a local copy rather than parameterizing the original: the PRD forbids
// touching token-economics code, and the footer text is per-experiment anyway.

import { useCallback, useRef, useState, type ReactNode } from "react";
import { toPng } from "html-to-image";
import { Download, Loader2 } from "lucide-react";

const SITE_URL = "arena.zenmux.ai/token-deals";
const AUTHOR_QR =
  "https://cdn.marmot-cloud.com/storage/zenmux/2026/01/23/fNSKOaq/wechat.png";

export function ChartFrame({
  filename,
  children,
}: {
  /** Base filename: "subsidy-over-time" → "token-deals-subsidy-over-time.png". */
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
    const scrollers = Array.from(node.querySelectorAll<HTMLElement>("*")).filter((el) => {
      const o = getComputedStyle(el).overflowX;
      return o === "auto" || o === "scroll";
    });
    const saved = scrollers.map((el) => ({ el, overflowX: el.style.overflowX }));
    scrollers.forEach((el) => {
      el.style.overflowX = "visible";
    });

    try {
      await nextFrame();
      await nextFrame();
      await waitForImages(node);
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#f4f1ea",
        width: node.scrollWidth,
        height: node.scrollHeight,
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `token-deals-${filename}.png`;
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
      <div className="mb-2 flex justify-end px-6">
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          className="inline-flex items-center gap-1.5 border border-[#141414] bg-[#fbf9f4] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors hover:bg-[#141414] hover:text-[#f4f1ea] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
          {busy ? "Exporting…" : "Export PNG"}
        </button>
      </div>

      <div ref={frameRef} className="bg-[#f4f1ea] p-6">
        {children}

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
              <div className="text-[11px] font-bold lowercase text-[#141414]">thinkthinking</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#6f6a5f]">
                ZenMux Arena · Token Deals
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
        // Best-effort: capture proceeds without a failed optional image.
      }
    }),
  );
}
