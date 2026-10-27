import { loadPersonalityConfig } from "./config";
import { parseArgs } from "../lib/args";

const CATALOG_URL =
  "https://zenmux.ai/api/frontend/model/listByFilter?context_length=&sort=newest&keyword=";

interface CatalogModel {
  author: string;
  name: string;
  slug: string;
  provider_slug: string;
  publish_time: string;
  suitable_api: string;
  output_modalities: string;
}

async function main() {
  const args = parseArgs();
  const configPath = args.get("config") ??
    (process.argv[2]?.startsWith("--") ? undefined : process.argv[2]) ??
    "config/personality-oejts.yaml";
  const config = loadPersonalityConfig(configPath, false);
  const url = new URL(CATALOG_URL);
  url.searchParams.set("supported_protocol", config.api.protocol);
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`catalog request failed: HTTP ${response.status}`);
  const body = (await response.json()) as { success?: boolean; data?: CatalogModel[] };
  if (!body.success || !Array.isArray(body.data)) throw new Error("catalog returned an invalid response");

  const bySlug = new Map(body.data.map((model) => [model.slug, model]));
  const failures: string[] = [];
  const review: string[] = [];

  for (const configured of config.models) {
    const current = bySlug.get(configured.baseModelId);
    if (!current) {
      failures.push(`${configured.baseModelId}: not present in current catalogue`);
      continue;
    }
    if (current.provider_slug !== configured.providerSlug) {
      failures.push(
        `${configured.baseModelId}: configured provider ${configured.providerSlug}, catalogue provider ${current.provider_slug}`,
      );
    }
    if (!current.suitable_api.split(",").includes(config.api.protocol)) {
      failures.push(`${configured.baseModelId}: ${config.api.protocol} protocol is not listed`);
    }
    if (!current.output_modalities.split(",").includes("text")) {
      failures.push(`${configured.baseModelId}: text output is not listed`);
    }

    // Compare new candidates to the newest configured model for this manufacturer,
    // rather than warning on every deliberately included older comparison model.
    const newestConfigured = config.models
      .filter((model) => model.manufacturer === configured.manufacturer)
      .map((model) => model.catalogPublishDate)
      .sort().at(-1)!;
    if (configured.catalogPublishDate !== newestConfigured) continue;
    const newer = body.data
      .filter(
        (candidate) =>
          candidate.author === configured.manufacturer &&
          candidate.publish_time > newestConfigured &&
          candidate.suitable_api.split(",").includes(config.api.protocol) &&
          candidate.output_modalities.split(",").includes("text"),
      )
      .sort((a, b) => b.publish_time.localeCompare(a.publish_time));
    if (newer.length > 0) {
      review.push(
        `${configured.manufacturer}: review newer candidate(s): ${newer
          .map((candidate) => `${candidate.slug} (${candidate.publish_time})`)
          .join(", ")}`,
      );
    }
  }

  console.log(`[personality:models:check] configured=${config.models.length} protocol=${config.api.protocol}`);
  for (const note of review) console.log(`[personality:models:check] REVIEW ${note}`);
  for (const failure of failures) console.error(`[personality:models:check] ERROR ${failure}`);
  if (failures.length > 0) process.exit(1);
  console.log("[personality:models:check] catalogue confirms all configured models, protocols and provider routes; no generation requests made");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
