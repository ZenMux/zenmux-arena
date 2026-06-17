// Token Economics pipeline — read ZenMux's model listing API, derive per-model
// price/usage economics, and publish the artifact the viewer reads.
//
// Unlike the "Who Are You?" study this makes NO *generation* API calls (so no
// ZENMUX_API_KEY, no completeness gate) — it reads the public model-listing JSON
// API (research/token-economics/scrape.ts). Like the other study it writes a
// timestamped run dir AND publishes a copy to public/research/ for the page.
//
// Usage:
//   pnpm tokenecon                        # fetch the live API, write run + publish
//   pnpm tokenecon --json path/to.json    # parse a saved API-response snapshot (offline)
//   pnpm tokenecon --usage-json path.json # parse a saved usage snapshot (offline; with --json)
//   pnpm tokenecon --no-usage             # skip the launch-window usage fetch (prices only)
//   pnpm tokenecon --usage-concurrency 6  # in-flight management requests (rate-limit knob)
//   pnpm tokenecon --no-publish           # write the run dir only, don't publish
//
// The launch-window avg-daily metric needs the MANAGEMENT key (ZENMUX_MANAGEMENT_KEY);
// without it the usage fetch is skipped and avg-daily fields stay null.

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "../lib/args";
import {
  fetchModelsApi,
  parseModels,
  API_URL,
  type ApiModel,
} from "../token-economics/scrape";
import {
  fetchAllUsage,
  MANAGEMENT_KEY_ENV,
} from "../token-economics/usage";
import { compute } from "../token-economics/compute";
import type { ModelUsageSeries } from "../token-economics/types";

const STUDY_ID = "token-economics";

/** results/<study>/<stamp> using the same compact stamp shape as the other study. */
function stamp(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(n < 0.01 ? 5 : 4)}`;
}

function fmtTokens(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return String(n);
}

async function main() {
  const args = parseArgs();
  const now = new Date();

  // 1) Acquire the API response — live fetch or a saved snapshot for offline/repro.
  let apiModels: ApiModel[];
  let rawJson: string;
  const jsonPath = args.get("json");
  if (jsonPath) {
    console.log(`[tokenecon] reading saved API JSON: ${jsonPath}`);
    rawJson = fs.readFileSync(jsonPath, "utf8");
    const parsed = JSON.parse(rawJson) as { data?: ApiModel[] } | ApiModel[];
    apiModels = Array.isArray(parsed) ? parsed : (parsed.data ?? []);
  } else {
    console.log(`[tokenecon] fetching ${API_URL}`);
    apiModels = await fetchModelsApi();
    rawJson = JSON.stringify({ success: true, data: apiModels });
    console.log(`[tokenecon] fetched ${apiModels.length} model(s) from the API`);
  }

  // 2) Parse the listing rows.
  const rows = parseModels(apiModels);
  console.log(`[tokenecon] kept ${rows.length} text model row(s)`);

  // 2b) Acquire the per-model launch-window usage series — live (authenticated)
  //     or from a saved snapshot. Skipped with --no-usage or when no mgmt key.
  let usage = new Map<string, ModelUsageSeries>();
  const usageJsonPath = args.get("usage-json");
  if (args.has("no-usage")) {
    console.log(`[tokenecon] --no-usage: skipping launch-window usage fetch`);
  } else if (usageJsonPath) {
    console.log(`[tokenecon] reading saved usage JSON: ${usageJsonPath}`);
    const arr = JSON.parse(fs.readFileSync(usageJsonPath, "utf8")) as ModelUsageSeries[];
    usage = new Map(arr.map((u) => [u.slug, u]));
    console.log(`[tokenecon] loaded usage series for ${usage.size} model(s)`);
  } else {
    const key = process.env[MANAGEMENT_KEY_ENV];
    if (!key) {
      console.warn(
        `[tokenecon] ⚠ ${MANAGEMENT_KEY_ENV} unset — skipping launch-window usage ` +
          `(avg-daily fields will be null). Set it to populate them.`,
      );
    } else {
      console.log(`[tokenecon] fetching launch-window usage for ${rows.length} model(s)…`);
      usage = await fetchAllUsage(
        rows.map((r) => ({ slug: r.slug, publishTime: r.publishTime })),
        key,
        {
          concurrency: args.num("usage-concurrency", 6),
          now,
          onProgress: (done, total) => {
            if (done === total || done % 20 === 0) {
              console.log(`[tokenecon]   usage ${done}/${total}`);
            }
          },
        },
      );
      console.log(`[tokenecon] fetched usage series for ${usage.size} model(s)`);
    }
  }

  // 2c) Compute the artifact (avg-daily derived from the usage series, if any).
  const { data, dropped } = compute(rows, now.toISOString(), usage);

  if (data.models.length === 0) {
    console.error(
      `[tokenecon] ✗ ABORT: 0 priced models from the API — the API shape likely changed. ` +
        `Inspect the response and update research/token-economics/scrape.ts.`,
    );
    process.exit(2);
  }
  if (dropped.length) {
    console.log(`[tokenecon] dropped ${dropped.length} unpriced row(s): ${dropped.join(", ")}`);
  }

  // 3) Write the timestamped run dir (records the raw API response + artifact for audit).
  const runDir = path.join(process.cwd(), "results", STUDY_ID, stamp(now));
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, "models-api.json"), rawJson);
  if (usage.size > 0) {
    // Save the raw usage series for audit + offline re-runs (--usage-json).
    fs.writeFileSync(
      path.join(runDir, "model-usage.json"),
      JSON.stringify([...usage.values()], null, 2),
    );
  }
  fs.writeFileSync(
    path.join(runDir, "token-economics.json"),
    JSON.stringify(data, null, 2),
  );
  console.log(`[tokenecon] wrote ${runDir}/token-economics.json`);

  // 4) Publish to public/research/ for the web page (unless suppressed).
  if (!args.has("no-publish")) {
    const pub = path.join(process.cwd(), "public", "research");
    fs.mkdirSync(pub, { recursive: true });
    fs.writeFileSync(
      path.join(pub, "token-economics.json"),
      JSON.stringify(data, null, 2),
    );
    console.log(`[tokenecon] published public/research/token-economics.json`);
  }

  // 5) Console summary — a quick sanity read of the headline numbers.
  const s = data.summary;
  console.log(`[tokenecon] ── summary ──`);
  console.log(`[tokenecon]   models=${s.modelCount}  vendors=${s.vendorCount}  withUsage=${s.withUsage}  withAvgDaily=${s.withAvgDaily}`);
  console.log(`[tokenecon]   basket=${data.basket.inputTokens / 1000}K in + ${data.basket.outputTokens / 1000}K out`);
  console.log(`[tokenecon]   median basket cost=${fmtUsd(s.medianBlendedCost)}  mean=${fmtUsd(s.meanBlendedCost)}`);
  if (s.priciest) console.log(`[tokenecon]   priciest: ${s.priciest.name} ${fmtUsd(s.priciest.blendedCost)}`);
  if (s.cheapest) console.log(`[tokenecon]   cheapest: ${s.cheapest.name} ${fmtUsd(s.cheapest.blendedCost)}`);
  if (s.mostUsed) console.log(`[tokenecon]   most used (all-time): ${s.mostUsed.name} ${fmtTokens(s.mostUsed.usageTokens)} tokens`);
  if (s.busiestDaily) console.log(`[tokenecon]   busiest daily: ${s.busiestDaily.name} ${fmtTokens(s.busiestDaily.avgDailyTokens)} tokens/day`);
  if (s.bestValue) console.log(`[tokenecon]   best value: ${s.bestValue.name} ${fmtTokens(s.bestValue.avgDailyPerDollar)} daily-tokens/$`);

  console.log(`[tokenecon] ── top 10 priciest (per ${data.basket.inputTokens / 1000}K in + ${data.basket.outputTokens}-out basket) ──`);
  for (const m of [...data.models].sort((a, b) => b.blendedCost - a.blendedCost).slice(0, 10)) {
    console.log(`[tokenecon]   ${fmtUsd(m.blendedCost).padStart(9)}  in=$${m.inputPrice}/M out=$${m.outputPrice}/M  ${m.slug}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
