"use client";

// The author card for this study — thinkthinking (ZenMux.ai Co-founder & Product
// Lead). Avatar + name + role on the left, a row of brand contact icons on the
// right. Three reveal a floating panel on hover/focus:
//   · 小红书 (rednote) → a QR (generated server-side, passed in as an SVG string).
//   · WeChat → the QR image hosted on the CDN, shown square + complete.
//   · Email → the address itself, so the user can read/copy it (no mailto send).
// X (Twitter) is a plain outbound link. All popovers also work on keyboard focus.

import { useId, useState } from "react";
import { Mail } from "lucide-react";
import { GITHUB_MARK_PATH } from "@research/lib/branding";

const HOME_URL = "https://thinkthinking.ai";
const TWITTER_URL = "https://x.com/thinkthinking_";
const GITHUB_URL = "https://github.com/thinkthinking";
const REDNOTE_URL = "https://www.xiaohongshu.com/user/profile/6401506e0000000029017abc";
const EMAIL = "yezhenjie@zenmux.ai";
const AVATAR_IMG =
  "https://cdn.marmot-cloud.com/storage/zenmux/2026/01/22/dN1oNAn/self.png";
const WECHAT_IMG =
  "https://cdn.marmot-cloud.com/storage/zenmux/2026/01/23/fNSKOaq/wechat.png";

/** A brand icon (the colored rounded-square SVGs under /media-logo). */
function BrandIcon({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="size-5 object-contain" />
  );
}

/** Inline GitHub mark — drawn from the shared branding path (lucide has none). */
function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-5 text-[#141414]" fill="currentColor">
      <path d={GITHUB_MARK_PATH} />
    </svg>
  );
}

/** Shared trigger styling — a bordered hit-area that darkens on hover/focus. */
const TRIGGER_CLASS =
  "flex size-9 items-center justify-center border border-transparent transition-colors hover:border-[#141414] focus-visible:border-[#141414] focus-visible:outline-none";

/** A contact icon that reveals a floating panel (QR / image / text) on hover or
    keyboard focus. With `href` the trigger is a real outbound link (touch
    fallback); with `onClick` instead it's a button (e.g. copy email, no nav). */
function PopoverIcon({
  label,
  href,
  onClick,
  trigger,
  children,
  panelClass = "",
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  panelClass?: string;
}) {
  const id = useId();
  return (
    <div className="group/icon relative">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          aria-describedby={id}
          className={TRIGGER_CLASS}
        >
          {trigger}
        </a>
      ) : (
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-describedby={id}
          className={`${TRIGGER_CLASS} cursor-pointer`}
        >
          {trigger}
        </button>
      )}
      {/* Floating panel — shown on hover OR keyboard focus of the trigger. */}
      <div
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 origin-bottom scale-95 opacity-0 transition-all duration-150 group-hover/icon:pointer-events-auto group-hover/icon:scale-100 group-hover/icon:opacity-100 group-focus-within/icon:pointer-events-auto group-focus-within/icon:scale-100 group-focus-within/icon:opacity-100 motion-reduce:transition-none"
      >
        <div className="border border-[#141414] bg-[#fbf9f4] p-2 shadow-[4px_4px_0_0_#141414]">
          <div className={panelClass}>{children}</div>
          <div className="mt-1.5 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-[#6f6a5f]">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthorCard({ qrSvg }: { qrSvg: string }) {
  const [copied, setCopied] = useState(false);
  const copyEmail = () => {
    navigator.clipboard?.writeText(EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="border border-[#141414] bg-[#fbf9f4] p-5 shadow-[4px_4px_0_0_#141414]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {/* Identity */}
        <div className="flex items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={AVATAR_IMG}
            alt="thinkthinking"
            className="size-14 shrink-0 border border-[#141414] object-cover"
          />
          <div>
            <a
              href={HOME_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-bold leading-tight underline decoration-[#141414]/30 underline-offset-2 transition-colors hover:decoration-[#141414]"
            >
              thinkthinking
            </a>
            <div className="mt-0.5 text-[12px] leading-snug text-[#6f6a5f]">
              ZenMux.ai Co-founder &amp; Product Lead
            </div>
          </div>
        </div>

        {/* Contact row */}
        <div className="flex items-center gap-1.5">
          <a
            href={TWITTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter)"
            title="X (Twitter)"
            className={TRIGGER_CLASS}
          >
            <BrandIcon src="/media-logo/x-twitter.svg" alt="X" />
          </a>

          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub — thinkthinking"
            className={TRIGGER_CLASS}
          >
            <GithubMark />
          </a>

          <PopoverIcon
            label="小红书"
            href={REDNOTE_URL}
            trigger={<BrandIcon src="/media-logo/rednote.svg" alt="小红书" />}
            panelClass="size-40 [&>svg]:size-full"
          >
            {/* QR SVG generated server-side; safe (our own string, no user input). */}
            <div className="size-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </PopoverIcon>

          <PopoverIcon
            label="WeChat"
            href={WECHAT_IMG}
            trigger={<BrandIcon src="/media-logo/wechat.svg" alt="WeChat" />}
            panelClass="size-40"
          >
            {/* The QR is a square (542×541) image — show it complete, not cropped. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={WECHAT_IMG}
              alt="WeChat QR"
              className="size-full object-contain"
            />
          </PopoverIcon>

          {/* Email — clicking the icon copies the address (NO mailto / mail
              client). The panel shows the address + a copied confirmation. */}
          <PopoverIcon
            label="Email"
            onClick={copyEmail}
            trigger={<Mail className="size-5 text-[#141414]" />}
            panelClass="px-1"
          >
            <button
              type="button"
              onClick={copyEmail}
              title="Click to copy"
              className="cursor-pointer select-all font-mono text-[12px] font-bold tracking-tight text-[#141414]"
            >
              {EMAIL}
            </button>
            {copied && (
              <div className="mt-0.5 text-center text-[9px] font-bold uppercase tracking-[0.1em] text-[#1a8a4a]">
                Copied!
              </div>
            )}
          </PopoverIcon>
        </div>
      </div>

      <div className="mt-4 border-t border-[#141414]/15 pt-2.5 text-[11px] text-[#6f6a5f]">
        Ideas worth spreading
      </div>
    </div>
  );
}
