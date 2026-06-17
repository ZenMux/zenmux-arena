"use client";

// Small shared brutalist primitives for the Token Economics surfaces: the model
// logo pill, the stat box, the ticker cell, and a tiny vendor logo. Kept apart
// from the surfaces so the leaderboard / consumption / value-map files stay
// focused on their own layout + data shaping.

import type { ModelEconomics } from "@research/token-economics/types";
import type { VendorId } from "@research/lib/types";
import { logoPath } from "./lib";

/** A model's vendor logo as a small brand-colored glyph. Keyed off the canonical
    vendor id; the SVGs under /model-logo are already in color, so no invert. */
export function VendorGlyph({
  vendor,
  alt,
  className = "size-4",
}: {
  vendor: VendorId;
  alt: string;
  className?: string;
}) {
  const src = logoPath(vendor);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`${className} shrink-0 object-contain`}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

/** The boxed model chip used under bars + in scatter callouts: glyph + short
    name, hard black border, square corners — the nof1 model tile. */
export function ModelPill({
  model,
  className = "",
}: {
  model: ModelEconomics;
  className?: string;
}) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 border border-[#141414] bg-[#fbf9f4] px-1.5 py-1 text-[10px] font-bold leading-none " +
        className
      }
      title={`${model.vendorName}: ${model.name}`}
    >
      <VendorGlyph vendor={model.vendor} alt={model.vendorName} className="size-3" />
      <span className="max-w-[8ch] truncate sm:max-w-[12ch]">{model.shortName}</span>
    </span>
  );
}

/** A headline stat: big mono value over an uppercase label, optional accent. */
export function StatBox({
  label,
  value,
  sub,
  accent,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={"border border-[#141414] bg-[#fbf9f4] px-3 py-2.5 " + className}>
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#6f6a5f]">
        {label}
      </div>
      <div
        className="mt-1 truncate text-lg font-bold tabular-nums sm:text-xl"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 truncate text-[10px] font-bold text-[#6f6a5f]">{sub}</div>
      )}
    </div>
  );
}
