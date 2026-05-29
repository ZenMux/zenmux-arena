import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @resvg/resvg-js loads a platform-native .node binary at runtime; it must not
  // be bundled by Turbopack/webpack. Keep it external so the export route can
  // require it directly on the server. (next-best-practices/bundling.md)
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
