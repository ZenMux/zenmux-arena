// Self-contained brutalist shell for the Token Economics module.
//
// This route intentionally does NOT inherit the site-wide shadcn `radix-nova`
// look. It loads its own monospace face (Space Mono — the "Brutalist Raw"
// pairing) and paints the whole surface cream-on-ink to replicate the
// "Alpha Arena by nof1" terminal aesthetic. The font is scoped via a CSS
// variable on this subtree's wrapper, so it never leaks into /research.

import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import { TokenEconNav } from "./TokenEconNav";

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-token-econ",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Token Economics — ZenMux Arena",
  description:
    "Every frontier model ZenMux serves, ranked by price and by real token consumption. Where does the compute — and the money — actually flow?",
};

export default function TokenEconomicsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={`${spaceMono.variable} flex min-h-dvh flex-col bg-[#f4f1ea] font-[family-name:var(--font-token-econ)] text-[#141414] antialiased selection:bg-[#141414] selection:text-[#f4f1ea]`}
    >
      <TokenEconNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
