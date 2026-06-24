import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
