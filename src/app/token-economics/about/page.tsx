// Token Economics — the ABOUT page. A server component (so it can render the
// 小红书 QR to inline SVG at request time) under the token-economics layout, so it
// inherits the brutalist cream-on-ink theme. Two halves:
//   1. the study's origin story, set nof1-style: centered, monospace, a top rule
//      + wordmark, generous line-height.
//   2. a "Get in Touch" card for the author (thinkthinking) — X / 小红书 (QR) /
//      WeChat (image) / email — modeled on the reference mock.
//
// The nav here is the shared TokenEconNav WITHOUT view props, so its section tabs
// fall back to <Link>s into the main page (the About page has no live surfaces).

import type { Metadata } from "next";
import Image from "next/image";
import QRCode from "qrcode";
import { TokenEconNav } from "../TokenEconNav";
import { AuthorCard } from "./AuthorCard";

export const metadata: Metadata = {
  title: "About — Token Economics — ZenMux Arena",
  description:
    "Why we measured the price–consumption relationship across every model ZenMux serves.",
};

// 小红书 profile — rendered to a QR so it scans straight from the page.
const XIAOHONGSHU_URL =
  "https://www.xiaohongshu.com/user/profile/6401506e0000000029017abc?xhsshare=CopyLink&shareRedId=ODoyMTg1Ok42NzUyOTgwNjg8OTg7RkhM&apptime=1769069725&share_id=9bca0a68c62d440a852e104a41450b9d";

/** Generate the 小红书 QR as an inline SVG string (server-side, no external
 *  service — the URL never leaves our build/runtime). High error-correction so
 *  it stays scannable even when shrunk into the card. */
async function xiaohongshuQrSvg(): Promise<string> {
  return QRCode.toString(XIAOHONGSHU_URL, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: "#141414", light: "#0000" }, // ink modules on transparent paper
  });
}

export default async function TokenEconomicsAboutPage() {
  const qrSvg = await xiaohongshuQrSvg();

  return (
    <>
      <TokenEconNav isAbout />
      <main className="flex-1">
        <article className="mx-auto max-w-2xl px-6 py-14 sm:py-20">
          {/* ── Masthead: rule · wordmark · rule (the nof1 signature) ── */}
          <header className="mb-12 flex items-center justify-center gap-5">
            <span className="h-px w-16 bg-[#141414] sm:w-24" aria-hidden />
            <Image
              src="/maker-logo/ZenMux-Light.png"
              alt="ZenMux"
              width={512}
              height={125}
              priority
              className="h-6 w-auto"
            />
            <span className="h-px w-16 bg-[#141414] sm:w-24" aria-hidden />
          </header>

          {/* ── The origin story ── */}
          <div className="space-y-6 text-[15px] leading-[1.85] text-[#141414]">
            <p>
              We kept noticing the same thing in the community: developers
              <em className="not-italic font-bold"> love </em>
              <a
                href="https://zenmux.ai/deepseek/deepseek-v4-pro"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-[#141414]/40 underline-offset-4 hover:decoration-[#141414]"
              >
                DeepSeek&nbsp;V4&nbsp;Pro
              </a>
              . It&apos;s everywhere — in side projects, in production, in the
              tools people reach for first.
            </p>
            <p>
              And looking at it, the relationship between its{" "}
              <b>price</b> and its <b>usage</b> seemed{" "}
              <em className="not-italic font-bold">interesting</em> — not the
              cheapest, not the priciest, yet consumed at a volume that didn&apos;t
              line up with cost the way you&apos;d naively expect.
            </p>
            <p>
              That made us wonder: what if we tallied{" "}
              <b>every model ZenMux serves</b> the same way — its standardized
              basket price against the real tokens it serves per day — and looked
              at the whole field at once? Where does the compute, and the money,
              actually flow?
            </p>
            <p>
              So we did. This study is that tally: every text model on the
              platform, scored on two axes — what it costs and how much it&apos;s
              truly used — so the value frontier becomes something you can see
              rather than guess.
            </p>

            <blockquote className="border-l-2 border-[#141414] pl-5 text-[#6f6a5f]">
              <p className="italic">
                &ldquo;Price is what you pay. Usage is what the market actually
                believes.&rdquo;
              </p>
            </blockquote>
          </div>

          {/* ── About the author ── */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">About the Author</h2>
            <p className="mt-1 text-sm text-[#6f6a5f]">
              The person behind this study — reach out anytime.
            </p>
            <div className="mt-5">
              <AuthorCard qrSvg={qrSvg} />
            </div>
          </section>
        </article>
      </main>
    </>
  );
}
