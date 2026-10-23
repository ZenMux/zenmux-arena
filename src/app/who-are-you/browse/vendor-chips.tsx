"use client";

// Icon availability lives in a client module. Keep its helper calls inside
// this boundary instead of invoking a client-reference proxy during RSC render.
import { VendorIcon, hasVendorIcon } from "@/components/ZenMuxIcons";
import type { VendorDisplay } from "./data";

/** The extracted claim, shown with the vendor's logo/color chip. */
export function ClaimBadge({ display, bucket }: { display: VendorDisplay; bucket: boolean }) {
  const isSelf = display.id === "self";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
        isSelf
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : bucket
            ? "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            : "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black"
      }`}
    >
      {!isSelf && hasVendorIcon(display.id) && (
        <>
          <VendorIcon vendor={display.id} surface="dark" size={14} className="size-3.5 shrink-0 dark:hidden" />
          <VendorIcon vendor={display.id} surface="light" size={14} className="hidden size-3.5 shrink-0 dark:inline-block" />
        </>
      )}
      {!isSelf && !bucket && !hasVendorIcon(display.id) && (
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ backgroundColor: display.color }}
        />
      )}
      {display.name}
    </span>
  );
}

/* ── Shared bits ─────────────────────────────────────────────────────────── */

/** Vendor logo on a dark chip (the maker logos are light variants) + color fallback. */
export function VendorChip({ vendor, size }: { vendor: VendorDisplay; size: number }) {
  const hasIcon = hasVendorIcon(vendor.id) || Boolean(vendor.logo);
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg"
      style={{
        width: size,
        height: size,
        backgroundColor: hasIcon ? "#111113" : vendor.color,
      }}
    >
      {hasIcon ? (
        <VendorIcon
          vendor={vendor.id}
          alt={vendor.name}
          surface="dark"
          style={{ width: size * 0.72, height: size * 0.72 }}
        />
      ) : (
        <span className="font-bold text-white" style={{ fontSize: size * 0.4 }}>
          {vendor.name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}
