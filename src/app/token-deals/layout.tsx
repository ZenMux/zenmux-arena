// Token Deals（让利账本）— the brutalist shell. Same terminal-ledger system as
// /token-economics (Space Mono, cream paper, ink borders, light-only) but a
// fully separate route: this experiment shares the LOOK by convention, not by
// importing the other module's layout, so the two never couple at runtime.

import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-token-deals",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Token Deals · 让利账本 — ZenMux Arena",
  description:
    "How much ZenMux is saving developers, live: every subsidized model's list price, deal price, and the running total of money left on the table — for you.",
};

export default function TokenDealsLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${spaceMono.variable} flex min-h-dvh flex-col bg-[#f4f1ea] font-[family-name:var(--font-token-deals)] text-[#141414] antialiased selection:bg-[#141414] selection:text-[#f4f1ea]`}
    >
      {children}
    </div>
  );
}
