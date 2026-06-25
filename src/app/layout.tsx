import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
