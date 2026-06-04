// Attribution badge shown on the research pages — the HTML twin of the badge
// baked into the exported graph image (research/lib/svg.ts) and drawn in the
// studio's in-graph chrome (RelationshipGraph.tsx). First line reads
// "by thinkthinking @ [ZenMux logo]" — the brand shows ONCE, as the clickable
// logo (→ zenmux.ai); "thinkthinking" links to the author. Below it sits the
// repo line. Pure presentational markup (no hooks) so it works as a server
// component on both /research and /research/browse.

import Image from "next/image";
import {
  AUTHOR_URL,
  REPO_LABEL,
  REPO_URL,
  ZENMUX_URL,
} from "@research/lib/branding";

/** Inline GitHub mark — lucide-react 1.16 ships no `Github` icon, so we draw it. */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/**
 * Attribution badge shown on the research pages — the HTML twin of the in-graph
 * badge (research/lib/svg.ts + RelationshipGraph.tsx). First line reads
 * "by thinkthinking @ [ZenMux logo]"; below it, the repo link. Pure
 * presentational markup (no hooks) so it works as a server component.
 */
export default function StudyBadge({
  align = "center",
  className,
}: {
  align?: "center" | "left";
  className?: string;
}) {
  const centered = align === "center";
  return (
    <div
      className={`flex flex-col gap-2 ${centered ? "items-center text-center" : "items-start text-left"} ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-sm text-neutral-600 dark:text-neutral-300">
          by{" "}
          <a
            href={AUTHOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-4 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <strong>thinkthinking</strong>
          </a>{" "}
          @
        </span>
        {/* ZenMux wordmark — the brand shown ONCE, linking to zenmux.ai. Theme-aware,
            same convention as the home page: ZenMux-Light.png is the DARK wordmark
            (light bg), ZenMux.png is the WHITE one (dark bg). */}
        <a
          href={ZENMUX_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="ZenMux"
          className="inline-flex items-center transition-opacity hover:opacity-80"
        >
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
        </a>
      </div>

      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        title={REPO_LABEL}
        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 transition-colors hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
      >
        <GithubMark className="size-3.5" />
        <span className="font-mono">{REPO_LABEL}</span>
      </a>
    </div>
  );
}
