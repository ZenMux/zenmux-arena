import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Jost,
  Fraunces,
  Archivo_Black,
} from "next/font/google";
import "./globals.css";
import { BuildStamp } from "@/components/BuildStamp";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Homepage "field guide" type system (see src/app/page.tsx):
//  · Jost — geometric sans in the Futura tradition; the hero's light title
//    and the small-caps metadata lines.
//  · Fraunces italic — the specimen captions ("American Robin"-style labels).
//  · Archivo Black — the giant outlined experiment index.
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["italic"],
  weight: ["400", "500"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "ZenMux Arena",
  description:
    "Reproducible, cross-vendor studies of how today's frontier LLMs actually behave — by ZenMux.ai.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${jost.variable} ${fraunces.variable} ${archivoBlack.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Global, fixed-corner build fingerprint — version · sha · local build
            time. Baked in at package time, shown on every page. */}
        <BuildStamp />
      </body>
    </html>
  );
}
