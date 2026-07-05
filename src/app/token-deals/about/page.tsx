// Token Deals — the ABOUT page: origin story + counting methodology + author
// card, told in the scoreboard's own language (black frame, solid color
// panels, poster type — the same PANEL palette as the board) instead of the
// token-economics paper sheet. The one deliberate paper element left is the
// author card at the bottom: the printed receipt inside the stadium.

import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { ArrowRight } from "lucide-react";
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

// The board's scoreboard palette, reused verbatim so About reads as the same
// broadcast (see DealsClient's PANEL).
const PANEL = {
  green: { bg: "#0c6b33", ink: "#41f08d" },
  amber: { bg: "#d9940a", ink: "#442c00" },
  blue: { bg: "#1747c0", ink: "#bccbff" },
  red: { bg: "#d7263d", ink: "#ffd6db" },
} as const;

/** Inline model mention → detail-page funnel link (rule 8 applies here too). */
function ModelLink({ slug, children }: { slug: string; children: React.ReactNode }) {
  return (
    <a
      href={dealHref(slug, false)!}
      target="_blank"
      rel="noopener noreferrer"
      className="font-bold text-white underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-white"
    >
      {children}
    </a>
  );
}

/** Numbered chapter header — the section strip, About edition. */
function Chapter({ no, title, color }: { no: string; title: string; color: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span
        className="font-[family-name:var(--font-deals-mono)] text-sm font-bold tabular-nums"
        style={{ color }}
      >
        {no}
      </span>
      <h2 className="font-[family-name:var(--font-deals-display)] text-2xl uppercase leading-none tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
    </div>
  );
}

export default async function TokenDealsAboutPage() {
  const qrSvg = await xiaohongshuQrSvg();

  return (
    <>
      <div className="border-b-[3px] border-[#0a0a0b]" style={{ backgroundColor: PANEL.blue.bg }}>
        <div className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-8 sm:py-10">
          <h1
            className="font-[family-name:var(--font-deals-display)] text-[clamp(2rem,5.4vw,4.8rem)] uppercase leading-[0.95] tracking-tight"
            style={{ color: PANEL.blue.ink }}
          >
            Why this board exists
          </h1>
          <p className="mt-3 max-w-3xl font-[family-name:var(--font-deals-mono)] text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 sm:text-xs">
            The story behind the ledger, and exactly how SAVED is counted
          </p>
        </div>
      </div>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-8 sm:py-16">
          {/* ── 01 · The story ── */}
          <section>
            <Chapter no="01" title="The receipt nobody printed" color={PANEL.green.ink} />
            <div className="mt-6 space-y-5 text-[15px] leading-[1.85] text-white/80">
              <p>
                ZenMux is subsidizing a batch of flagship models right now — when you run{" "}
                <ModelLink slug="z-ai/glm-5.2">GLM&nbsp;5.2</ModelLink> at 69% off or{" "}
                <ModelLink slug="qwen/qwen3.7-max">Qwen3.7-Max</ModelLink> at 83% off, the gap
                between the list price and what you pay is money ZenMux puts on the table.
              </p>
              <p>
                But that fact lived nowhere. You&apos;d see a low price on the model list and
                have no way to tell it was a{" "}
                <em className="not-italic font-bold text-white">subsidized</em> price — and we
                ourselves had no single number for &ldquo;how much have we given away so
                far?&rdquo;
              </p>
              <p>
                So we made the ledger public. One board, one honest number, updated live from
                the same billing data that produces your invoices — plus every deal&apos;s
                original price, deal price, and what it has saved developers so far. Ended
                deals don&apos;t disappear:{" "}
                <span className="font-bold text-white">
                  the story ends, the ledger doesn&apos;t.
                </span>
              </p>
            </div>
          </section>

          {/* ── 02 · The formula ── */}
          <section className="mt-16">
            <Chapter no="02" title="How SAVED is counted" color={PANEL.amber.bg} />

            {/* The formula gets the hero treatment — a solid green panel, the
                same surface the board's headline number sits on. */}
            <div
              className="mt-6 border-[3px] border-[#0a0a0b] px-4 py-6 sm:px-8 sm:py-8"
              style={{ backgroundColor: PANEL.green.bg }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-[0.24em]"
                style={{ color: PANEL.green.ink }}
              >
                The one formula
              </div>
              <div
                className="mt-3 font-[family-name:var(--font-deals-mono)] text-[14px] font-bold leading-relaxed tabular-nums sm:text-lg"
                style={{ color: PANEL.green.ink }}
              >
                SAVED = Σ billed discount amounts{" "}
                <span className="text-white/60">(pay-as-you-go)</span>
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ Σ list price × (1 − discount){" "}
                <span className="text-white/60">(subscription)</span>
              </div>
              <p className="mt-4 max-w-2xl font-[family-name:var(--font-deals-mono)] text-[11px] font-semibold uppercase leading-relaxed tracking-[0.06em] text-white/70">
                Pay-as-you-go traffic carries its exact discount amount on every billing
                record; subscription traffic is valued at list price and split by the discount
                factor in effect for that model and provider at the time.
              </p>
            </div>

            {/* Three method cards — where each ingredient comes from. */}
            <div className="mt-[3px] grid gap-[3px] sm:grid-cols-3">
              {[
                {
                  label: "Deal windows",
                  body: "Discovered from the same configuration that drives billing: which models, which providers, what factor, and exactly when each discount started or rolled back.",
                },
                {
                  label: "Money & usage",
                  body: "Aggregated from our billing records request by request — the ledger and your invoice can never disagree. The two billing families are reported separately.",
                },
                {
                  label: "Free models",
                  body: "The -free variants are 100% off: every request still records its list price, discounted in full, so their subsidy is real dollars on the board.",
                },
              ].map((card) => (
                <div key={card.label} className="bg-[#141416] px-4 py-5 sm:px-5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                    {card.label}
                  </div>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-white/75">{card.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── 03 · What it is not ── */}
          <section className="mt-16">
            <Chapter no="03" title="What it is not" color={PANEL.red.bg} />
            <div
              className="mt-6 border-l-[6px] bg-[#141416] px-4 py-5 sm:px-6"
              style={{ borderColor: PANEL.red.bg }}
            >
              <p className="text-[15px] leading-[1.85] text-white/80">
                <span className="font-bold text-white">Not a financial statement.</span> The
                ledger measures the discount you can see on the price tag, not ZenMux&apos;s
                upstream settlement costs. Only model-level aggregates ever leave the billing
                database — no per-user or per-request data is exposed.
              </p>
            </div>
          </section>

          {/* ── See it live — the funnel back to the two data surfaces. ── */}
          <section className="mt-16 grid gap-[3px] sm:grid-cols-2">
            <Link
              href="/token-deals"
              className="group border-[3px] border-[#0a0a0b] px-4 py-6 transition-[filter] hover:brightness-110 sm:px-6"
              style={{ backgroundColor: PANEL.green.bg }}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: PANEL.green.ink }}>
                See it live
              </div>
              <div
                className="mt-2 flex items-center gap-2 font-[family-name:var(--font-deals-display)] text-2xl uppercase tracking-tight sm:text-3xl"
                style={{ color: PANEL.green.ink }}
              >
                The board
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </div>
              <p className="mt-2 font-[family-name:var(--font-deals-mono)] text-[10px] font-semibold uppercase tracking-[0.1em] text-white/65">
                Every live deal · the running total
              </p>
            </Link>
            <Link
              href="/token-deals/ladder"
              className="group border-[3px] border-[#0a0a0b] px-4 py-6 transition-[filter] hover:brightness-110 sm:px-6"
              style={{ backgroundColor: PANEL.amber.bg }}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: PANEL.amber.ink }}>
                Rank it
              </div>
              <div
                className="mt-2 flex items-center gap-2 font-[family-name:var(--font-deals-display)] text-2xl uppercase tracking-tight sm:text-3xl"
                style={{ color: PANEL.amber.ink }}
              >
                The ladder
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </div>
              <p
                className="mt-2 font-[family-name:var(--font-deals-mono)] text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: PANEL.amber.ink, opacity: 0.75 }}
              >
                Deals ranked · trend curves per deal
              </p>
            </Link>
          </section>

          {/* ── 04 · The person — the printed receipt inside the stadium. ── */}
          <section className="mt-16">
            <Chapter no="04" title="Get in touch" color={PANEL.blue.ink} />
            <p className="mt-3 font-[family-name:var(--font-deals-mono)] text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
              The person behind this ledger — reach out anytime
            </p>
            <div className="mt-5 bg-[#f4f1ea] p-4 text-[#141414] sm:p-5">
              <AuthorCard qrSvg={qrSvg} />
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
