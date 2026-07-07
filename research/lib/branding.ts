// Shared branding strings for the study's attribution badge — used by BOTH the
// Node-side static SVG export (research/lib/svg.ts) and the browser-side React
// badge (src/app/research/StudyBadge.tsx), so the on-screen footer and the
// exported image stay in lockstep. Pure constants only (no imports) so it is
// safe to import from either runtime.

/** Public source repository for the study harness + viewer. */
export const REPO_URL = "https://github.com/ZenMux/zenmux-arena";

/** Bare host/path form, for compact contexts (e.g. the exported image footer). */
export const REPO_LABEL = "github.com/ZenMux/zenmux-arena";

/** ZenMux home — where the badge's ZenMux wordmark links to. */
export const ZENMUX_URL = "https://zenmux.ai";

/** The study author — where the "thinkthinking" attribution links to. */
export const AUTHOR_URL = "https://thinkthinking.ai";

/**
 * Attribution text shown before the ZenMux wordmark on the badge's first line:
 * `by thinkthinking | [ZenMux logo]`. The brand appears ONCE — as the clickable
 * logo that follows this text — so we deliberately don't spell out "ZenMux.ai"
 * here (that would duplicate it).
 */
export const BADGE_TEXT = "by thinkthinking @";

/**
 * GitHub mark, as an SVG path on a 16×16 viewBox — lucide-react ships no `Github`
 * icon, so both the React badge (StudyBadge.tsx) and the in-graph badge chrome
 * (RelationshipGraph.tsx + svg.ts) draw it from this single source. Keeping it
 * here (with the other branding constants) means the repo line renders
 * identically on screen and in the exported image.
 */
export const GITHUB_MARK_PATH =
  "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z";
