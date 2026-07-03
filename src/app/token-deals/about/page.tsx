// Token Deals — the ABOUT page: origin story + counting methodology + author
// card. The scoreboard frame stays (black, ticker nav); the story itself sits
// on a paper sheet — the printed receipt inside the stadium — because the
// credibility of the board's numbers rests on this page explaining them
// plainly.

import type { Metadata } from "next";
import QRCode from "qrcode";
import { TokenDealsNav } from "../TokenDealsNav";
import { AuthorCard } from "../../token-economics/about/AuthorCard";
import { dealHref } from "../lib";

export const metadata: Metadata = {
  title: "About — Token Deals · ZenMux Arena",
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
      <div className="border-b-[3px] border-[#0a0a0b] bg-[#1747c0]">
        <div className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-8 sm:py-10">
          <h1 className="font-[family-name:var(--font-deals-display)] text-[clamp(2rem,5.4vw,4.8rem)] uppercase leading-[0.95] tracking-tight text-[#bccbff]">
            Why this board exists
          </h1>
          <p className="mt-3 max-w-3xl font-[family-name:var(--font-deals-mono)] text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 sm:text-xs">
            The story behind the ledger, and exactly how SAVED is counted
          </p>
        </div>
      </div>

      <main className="flex-1 bg-[#f4f1ea] text-[#141414]">
        <article className="mx-auto max-w-2xl px-6 py-14 sm:py-20">
          {/* ── Why we built this ── */}
          <section className="space-y-6 text-[15px] leading-[1.85]">
            <h2 className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-[#6f6a5f]">
              Why we built this
            </h2>
            <p>
              ZenMux is subsidizing a batch of flagship models right now — when you run{" "}
              <ModelLink slug="z-ai/glm-5.2">GLM&nbsp;5.2</ModelLink> at 69% off or{" "}
              <ModelLink slug="qwen/qwen3.7-max">Qwen3.7-Max</ModelLink> at 83% off, the gap
              between the list price and what you pay is money ZenMux puts on the table.
            </p>
            <p>
              But that fact lived nowhere. You&apos;d see a low price on the model list and have
              no way to tell it was a{" "}
              <em className="not-italic font-bold">subsidized</em> price — and we ourselves had
              no single number for &ldquo;how much have we given away so far?&rdquo;
            </p>
            <p>
              So we made the ledger public. One board, one honest number, updated live from the
              same billing data that produces your invoices — plus every deal&apos;s original
              price, deal price, and what it has saved developers so far. Ended deals don&apos;t
              disappear: the story ends, the ledger doesn&apos;t.
            </p>
          </section>

          {/* ── How we count ── */}
          <section className="mt-14 space-y-6 text-[15px] leading-[1.85]">
            <h2 className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-[#6f6a5f]">
              How we count
            </h2>
            <div className="border border-[#141414] bg-[#fbf9f4] px-4 py-5 text-center">
              <div className="font-[family-name:var(--font-deals-mono)] text-[14px] font-bold tabular-nums sm:text-[15px]">
                SAVED = Σ billed discount amounts (pay-as-you-go)
                <br />+ Σ list price × (1 − discount) (subscription)
              </div>
              <div className="mt-2 text-[11px] text-[#6f6a5f]">
                Pay-as-you-go traffic carries its exact discount amount on every billing record;
                subscription traffic is valued at list price and split by the discount factor in
                effect for that model and provider at the time.
              </div>
            </div>
            <p>
              Deal periods are discovered from the same configuration that drives billing: which
              models are discounted, on which providers, at what factor, and exactly when each
              discount started or was rolled back. Usage and money inside each window come from
              aggregating our billing records request by request, so the ledger and your invoice
              can never disagree — and the two billing families are reported separately. Free
              models (the <span className="font-bold">-free</span> variants, 100% off) are on
              the board too: every request still records its list price, discounted in full, so
              their subsidy is real dollars.
            </p>
            <p>
              What it is <em className="not-italic font-bold">not</em>: a financial statement.
              The ledger measures the discount you can see on the price tag, not ZenMux&apos;s
              upstream settlement costs. Only model-level aggregates ever leave the billing
              database — no per-user or per-request data is exposed.
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
