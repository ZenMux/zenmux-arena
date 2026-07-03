// Token Deals — THE DISCOUNT BOARD shell. A deliberate break from the
// token-economics terminal-ledger look: this experiment is a stadium
// scoreboard (worldcupnext.com energy) — pitch-black frame, full-bleed
// vendor-color bands, gigantic poster type. Fonts: Archivo Black for the
// shouting, Archivo for labels, IBM Plex Mono for the ledger numerals.

import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Archivo, Archivo_Black, IBM_Plex_Mono } from "next/font/google";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-deals-body",
  display: "swap",
});

const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-deals-display",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-deals-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Token Deals — ZenMux Arena",
  description:
    "The live discount board: every model ZenMux is subsidizing right now — list price, deal price, and the running total saved for developers.",
};

export default function TokenDealsLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${archivo.variable} ${archivoBlack.variable} ${plexMono.variable} flex min-h-dvh flex-col bg-[#0a0a0b] font-[family-name:var(--font-deals-body)] text-white antialiased selection:bg-[#3dff8e] selection:text-[#0a0a0b]`}
    >
      {children}
    </div>
  );
}
