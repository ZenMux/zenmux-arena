import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "zenmux-arena",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-23",
    compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
    observability: { enabled: true },
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
      // Required runtime secrets. Declaring them makes a deploy fail closed
      // if the dashboard values are missing, instead of publishing a worker
      // that cannot read Supabase or the billing database.
      SUPABASE_URL: bindings.secret(),
      SUPABASE_SECRET_KEY: bindings.secret(),
      TOKEN_ECON_LIVE_DB_HOST: bindings.secret(),
      TOKEN_ECON_LIVE_DB_PORT: bindings.secret(),
      TOKEN_ECON_LIVE_DB_USER: bindings.secret(),
      TOKEN_ECON_LIVE_DB_PASSWORD: bindings.secret(),
      TOKEN_ECON_LIVE_DB_DATABASE: bindings.secret(),
    },
  }),
});
