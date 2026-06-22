import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the workspace root to THIS project. Without it, Turbopack walks up and
  // finds ~/pnpm-lock.yaml, mis-inferring the root and warning on every start.
  turbopack: {
    root: path.join(__dirname),
  },
  // @resvg/resvg-js loads a platform-native .node binary at runtime; it must not
  // be bundled by Turbopack/webpack. Keep it external so the export route can
  // require it directly on the server. (next-best-practices/bundling.md)
  serverExternalPackages: ["@resvg/resvg-js", "mysql2"],
  // The "Who Are You?" study moved from /research to /who-are-you. Permanently
  // redirect the old paths so existing external links (the OG image, shared
  // arena.zenmux.ai/research URLs, search-engine results) keep landing on the
  // right surface instead of 404ing. `:path*` carries any sub-path + query.
  async redirects() {
    return [
      { source: "/research", destination: "/who-are-you", permanent: true },
      { source: "/research/:path*", destination: "/who-are-you/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
