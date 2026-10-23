// Build metadata, frozen at package time.
//
// The values come from `next.config.ts`, which computes them once when the
// bundle is built and inlines them as NEXT_PUBLIC_* string literals (see the
// `env` block there). Reading them through this single module — rather than
// touching `process.env.NEXT_PUBLIC_*` ad hoc — keeps the fallbacks in one place
// and gives the rest of the app a typed surface.
//
// Why NEXT_PUBLIC_: only the `NEXT_PUBLIC_`-prefixed env vars are exposed to
// client components. These are not secrets — they're a deploy fingerprint we
// WANT visible in the browser so a version can be read off any page.

export interface BuildInfo {
  /** Semantic version from package.json (e.g. "0.1.0"). */
  version: string;
  /** Short git SHA of the built commit; "-dirty" suffix if the tree had uncommitted changes. "unknown" if git was unavailable. */
  sha: string;
  /** ISO-8601 UTC instant the bundle was built. Render via <LocalTime> to show it in the viewer's timezone. */
  buildTime: string;
}

export const BUILD_INFO: BuildInfo = {
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
  sha: process.env.NEXT_PUBLIC_GIT_SHA ?? "unknown",
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? "",
};

/** Compact one-line label, e.g. "v0.1.0 · d78060f". The build time is shown
 *  separately (and localized) so it can be rendered hydration-safely. */
export function buildLabel(): string {
  return `v${BUILD_INFO.version} · ${BUILD_INFO.sha}`;
}
