import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import type { NextConfig } from "next";

const require = createRequire(import.meta.url);

// ── Build metadata, computed ONCE at build/package time ──────────────────────
// These resolve when `next build` (or `next dev`) evaluates this config, then
// get baked into the client bundle as NEXT_PUBLIC_* string literals. The browser
// therefore reports the exact commit + timestamp that produced the deployed
// assets — the whole point of a version stamp is that it's frozen at package
// time, not recomputed live. Each lookup is wrapped so a missing git binary or
// a detached/shallow checkout (common in CI) degrades to a safe fallback rather
// than failing the build.
function gitShortSha(): string {
  // Allow CI to inject the SHA directly (e.g. Vercel's VERCEL_GIT_COMMIT_SHA),
  // which is more reliable than shelling out inside a shallow clone.
  const fromEnv =
    process.env.SOURCE_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

function gitDirty(): boolean {
  try {
    return (
      execSync("git status --porcelain", {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim().length > 0
    );
  } catch {
    return false;
  }
}

const pkgVersion = (() => {
  try {
    return (require("./package.json") as { version?: string }).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

const buildSha = gitShortSha();
const buildEnv = {
  NEXT_PUBLIC_APP_VERSION: pkgVersion,
  // Mark a dirty working tree so a stamp from an uncommitted local build is
  // never mistaken for the exact committed source.
  NEXT_PUBLIC_GIT_SHA: gitDirty() ? `${buildSha}-dirty` : buildSha,
  // ISO-8601 UTC instant of the build. The UI renders this in the viewer's
  // local timezone (see src/components/LocalTime.tsx).
  NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
};

const nextConfig: NextConfig = {
  output: "standalone",
  // Bake build metadata into the bundle. `env` values are inlined as string
  // literals at build time, so they're available in both server and client
  // components without a runtime lookup.
  env: buildEnv,
  // Pin the workspace root to THIS project. Without it, Turbopack walks up and
  // finds ~/pnpm-lock.yaml, mis-inferring the root and warning on every start.
  turbopack: {
    root: __dirname,
  },
  // Standalone output does not automatically carry every `public/` asset. Keep
  // the whole static asset tree in the traced bundle so deployed public URLs
  // resolve the same way they do in local dev.
  outputFileTracingIncludes: {
    "/*": ["./public/**/*", "./config/token-economics-live-models.json"],
    "/api/token-economics/live/**": ["./.cache/**"],
    "/api/token-deals/live/**": ["./.cache/**"],
  },
  // @resvg/resvg-js loads a platform-native .node binary at runtime; it must not
  // be bundled by Turbopack/webpack. Keep it external so the export route can
  // require it directly on the server. (next-best-practices/bundling.md)
  serverExternalPackages: ["@resvg/resvg-js", "mysql2"],
  // The "Who Are You?" study moved from /research to /who-are-you. Keep the old
  // paths working with internal rewrites because Morphe's function gateway
  // rejects app-level redirects on the default domain.
  async rewrites() {
    return [
      { source: "/research", destination: "/who-are-you" },
      { source: "/research/:path*", destination: "/who-are-you/:path*" },
    ];
  },
};

export default nextConfig;
