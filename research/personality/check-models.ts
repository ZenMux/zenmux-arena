import { loadPersonalityConfig } from "./config";

const CATALOG_URL =
  "https://zenmux.ai/api/frontend/model/listByFilter?context_length=&sort=newest&keyword=&supported_protocol=chat.completions";

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
  const configPath = process.argv[2] ?? "config/personality-oejts.yaml";
  const config = loadPersonalityConfig(configPath, false);
  const response = await fetch(CATALOG_URL);
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
    if (!current.suitable_api.split(",").includes("messages")) {
      failures.push(`${configured.baseModelId}: Messages protocol is not listed`);
    }
    if (!current.output_modalities.split(",").includes("text")) {
      failures.push(`${configured.baseModelId}: text output is not listed`);
    }

    const newer = body.data
      .filter(
        (candidate) =>
          candidate.author === configured.manufacturer &&
          candidate.publish_time > configured.catalogPublishDate &&
          candidate.suitable_api.split(",").includes("messages") &&
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

  console.log(`[personality:models:check] configured=${config.models.length}`);
  for (const note of review) console.log(`[personality:models:check] REVIEW ${note}`);
  for (const failure of failures) console.error(`[personality:models:check] ERROR ${failure}`);
  if (failures.length > 0) process.exit(1);
  console.log("[personality:models:check] all configured models and provider routes are currently available");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
