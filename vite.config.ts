import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";
import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";
import { createHash } from "node:crypto";
import { patchCssModules } from "vite-css-modules";
import path from "node:path";
import { arenaWorkerInputs } from "./worker/vite-plugin.ts";

process.env.ARENA_WORKERS_BUILD = "1";

export default defineConfig({
  publicDir: ".vinext/public",
  resolve: {
    alias: [
      { find: "@/lib/compressed-json", replacement: path.resolve(import.meta.dirname, "worker/compressed-json.ts") },
      { find: path.resolve(import.meta.dirname, "src/lib/compressed-json.ts"), replacement: path.resolve(import.meta.dirname, "worker/compressed-json.ts") },
      { find: "@research/lib/rasterize", replacement: path.resolve(import.meta.dirname, "worker/rasterize.ts") },
      { find: path.resolve(import.meta.dirname, "research/lib/rasterize.ts"), replacement: path.resolve(import.meta.dirname, "worker/rasterize.ts") },
      { find: path.resolve(import.meta.dirname, "src/app/who-are-you/browse/data.ts"), replacement: path.resolve(import.meta.dirname, "worker/browse-data.ts") },
    ],
  },
  optimizeDeps: { exclude: ["@resvg/resvg-js"] },
  plugins: [
    arenaWorkerInputs(),
    patchCssModules({ exportMode: "default" }),
    vinext({
      // Launch-window fetches retain their 24h revalidation contract across
      // Worker instances. This does not replace the Supabase billing snapshots.
      cache: { data: kvDataAdapter() },
      images: { optimizer: imagesOptimizer() },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  css: {
    modules: {
      generateScopedName(name: string, filename: string) {
        const relativePath = path.relative(import.meta.dirname, filename.replace(/\?.*$/, "")).replaceAll("\\", "/");
        return `_${name}_${createHash("sha256").update(relativePath).digest("hex").slice(0, 7)}`;
      },
    },
  },
});
