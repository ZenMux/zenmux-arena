import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to THIS project. Without it, Turbopack walks up and
  // finds ~/pnpm-lock.yaml, mis-inferring the root and warning on every start.
  turbopack: {
    root: path.join(__dirname),
  },
  // @resvg/resvg-js loads a platform-native .node binary at runtime; it must not
  // be bundled by Turbopack/webpack. Keep it external so the export route can
  // require it directly on the server. (next-best-practices/bundling.md)
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
