// Attribution badge shown on the research pages — the on-screen twin of the
// footer baked into the exported graph image (research/lib/svg.ts). Keeps the
// ZenMux wordmark, the "以上研究由 thinkthinking | ZenMux.ai 测试" line, and a
// clickable link to the public source repo. Pure presentational markup (no
// hooks) so it works as a server component on both /research and /research/browse.

import Image from "next/image";
import { BADGE_TEXT, REPO_LABEL, REPO_URL } from "@research/lib/branding";

/** Inline GitHub mark — lucide-react 1.16 ships no `Github` icon, so we draw it. */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/**
 * @param meta  Optional faint sub-line (e.g. "Generated … · run … · n=…").
 * @param align Centered (report header/footer) or left (data browser header).
 */
export default function StudyBadge({
  meta,
  align = "center",
  className,
}: {
  meta?: string;
  align?: "center" | "left";
  className?: string;
}) {
  const centered = align === "center";
  return (
    <div
      className={`flex flex-col gap-2 ${centered ? "items-center text-center" : "items-start text-left"} ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        {/* Theme-aware wordmark — same convention as the home page: ZenMux-Light.png
            is the DARK wordmark (light bg), ZenMux.png is the WHITE one (dark bg). */}
        <Image
          src="/maker-logo/ZenMux-Light.png"
          alt="ZenMux"
          width={512}
          height={125}
          className="h-5 w-auto dark:hidden"
        />
        <Image
          src="/maker-logo/ZenMux.png"
          alt="ZenMux"
          width={2000}
          height={512}
          className="hidden h-5 w-auto dark:block"
        />
        <span className="text-sm text-neutral-600 dark:text-neutral-300">
          以上研究由 <strong>thinkthinking</strong> |{" "}
          <a
            href="https://zenmux.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-4 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            ZenMux.ai
          </a>{" "}
          测试
        </span>
      </div>

      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        title={BADGE_TEXT}
        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 transition-colors hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
      >
        <GithubMark className="size-3.5" />
        <span className="font-mono">{REPO_LABEL}</span>
      </a>

      {meta && <p className="text-xs text-neutral-400 dark:text-neutral-500">{meta}</p>}
    </div>
  );
}
