// Shared branding strings for the study's attribution badge — used by BOTH the
// Node-side static SVG export (research/lib/svg.ts) and the browser-side React
// badge (src/app/research/StudyBadge.tsx), so the on-screen footer and the
// exported image stay in lockstep. Pure constants only (no imports) so it is
// safe to import from either runtime.

/** Public source repository for the study harness + viewer. */
export const REPO_URL = "https://github.com/ZenMux/zenmux-arena";

/** Bare host/path form, for compact contexts (e.g. the exported image footer). */
export const REPO_LABEL = "github.com/ZenMux/zenmux-arena";

/** The attribution line shown beside the ZenMux wordmark. */
export const BADGE_TEXT = "以上研究由 thinkthinking | ZenMux.ai 测试";
