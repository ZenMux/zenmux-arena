// Token Deals — the ABOUT page: origin story + counting methodology + author
// card. Same quiet editorial pattern as /token-economics/about (masthead of
// rule · wordmark · rule, narrow centered column), because the credibility of
// the ledger's numbers rests on this page explaining them plainly.

import type { Metadata } from "next";
import Image from "next/image";
import QRCode from "qrcode";
import { TokenDealsNav } from "../TokenDealsNav";
import { AuthorCard } from "../../token-economics/about/AuthorCard";
import { dealHref } from "../lib";

export const metadata: Metadata = {
  title: "About — Token Deals · 让利账本 — ZenMux Arena",
  description:
    "Why we built a public subsidy ledger, and exactly how the SAVED number is counted.",
};

const XIAOHONGSHU_URL =
  "https://www.xiaohongshu.com/user/profile/6401506e0000000029017abc?xhsshare=CopyLink&shareRedId=ODoyMTg1Ok42NzUyOTgwNjg8OTg7RkhM&apptime=1769069725&share_id=9bca0a68c62d440a852e104a41450b9d";

async function xiaohongshuQrSvg(): Promise<string> {
  return QRCode.toString(XIAOHONGSHU_URL, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: "#141414", light: "#0000" },
  });
}

/** Inline model mention → detail-page funnel link (rule 8 applies here too). */
function ModelLink({ slug, children }: { slug: string; children: React.ReactNode }) {
  return (
    <a
      href={dealHref(slug, false)!}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-[#141414]/40 underline-offset-4 hover:decoration-[#141414]"
    >
      {children}
    </a>
  );
}

export default async function TokenDealsAboutPage() {
  const qrSvg = await xiaohongshuQrSvg();

  return (
    <>
      <TokenDealsNav active="about" />
      <main className="flex-1">
        <article className="mx-auto max-w-2xl px-6 py-14 sm:py-20">
          {/* ── Masthead: rule · wordmark · rule ── */}
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

          {/* ── Why we built this ── */}
          <section className="space-y-6 text-[15px] leading-[1.85] text-[#141414]">
            <h2 className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-[#6f6a5f]">
              Why we built this · 为什么做让利账本
            </h2>
            <p>
              ZenMux is subsidizing a batch of flagship models right now — when
              you run <ModelLink slug="z-ai/glm-5.2">GLM&nbsp;5.2</ModelLink>
              {" "}at 3.1&nbsp;折 or{" "}
              <ModelLink slug="qwen/qwen3.7-max">Qwen3.7-Max</ModelLink>
              {" "}at 1.7&nbsp;折, the gap between the list price and what you
              pay is money ZenMux puts on the table.
            </p>
            <p>
              But that fact lived nowhere. You&apos;d see a low price on the
              model list and have no way to tell it was a{" "}
              <em className="not-italic font-bold">subsidized</em>
              {" "}price — and
              we ourselves had no single number for &ldquo;how much have we
              given away so far?&rdquo;
            </p>
            <p>
              So we made the ledger public. One page, one honest number, updated
              live from the same billing data that produces your invoices —
              plus every deal&apos;s original price, deal price, and what it has
              saved developers so far. Ended deals don&apos;t disappear: the
              story ends, the ledger doesn&apos;t.
            </p>
          </section>

          {/* ── How we count ── */}
          <section className="mt-14 space-y-6 text-[15px] leading-[1.85] text-[#141414]">
            <h2 className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-[#6f6a5f]">
              How we count · 补贴怎么算
            </h2>
            <div className="border border-[#141414] bg-[#fbf9f4] px-4 py-5 text-center">
              <div className="text-[15px] font-bold tabular-nums sm:text-base">
                SAVED = Σ 优惠期内用量 × (原价 − 折后价)
              </div>
              <div className="mt-2 text-[11px] text-[#6f6a5f]">
                按牌面价差计 · 非财务结算口径 — list-price gap, not settlement cost
              </div>
            </div>
            <p>
              Every deal period is registered with its model, discount factor,
              and UTC date window. The original price is restored from the
              public list price and the discount (原价 = 折后价 ÷
              折扣系数); usage inside the window comes from aggregating our
              billing records — input and output tokens are priced at their own
              gap, so the number is computed token by token, not approximated.
            </p>
            <p>
              What it is <em className="not-italic font-bold">not</em>: a
              financial statement. The ledger measures the discount you can see
              on the price tag, not ZenMux&apos;s upstream settlement costs.
              Only model-level aggregates ever leave the billing database —
              no per-user or per-request data is exposed.
            </p>
          </section>

          {/* ── Get in touch ── */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">Get in Touch</h2>
            <p className="mt-1 text-sm text-[#6f6a5f]">
              The person behind this ledger — reach out anytime.
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
