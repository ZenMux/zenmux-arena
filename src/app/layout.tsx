import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

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
        {/* Vercel Web Analytics — automatically records a pageview per route
            (so /who-are-you/* and /token-economics/* each get their own line,
            plus the rolled-up totals) in the Vercel dashboard. Backend-only:
            nothing renders on the page. Active only once deployed on Vercel. */}
        <Analytics />
      </body>
    </html>
  );
}
