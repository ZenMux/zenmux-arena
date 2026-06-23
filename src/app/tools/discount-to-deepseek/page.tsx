import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { fetchModelsApi, parseModels, type ApiModel } from "@research/token-economics/scrape";
import { PRICE_UNIT } from "@research/token-economics/types";
import { DiscountToDeepSeekClient, type PriceAnchor, type PriceModelSeed } from "./DiscountToDeepSeekClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discount to DeepSeek - Tools - ZenMux Arena",
  description:
    "Adjust input/output basket ratios and normalize model prices to DeepSeek V4 Pro or V4 Flash.",
};

const TARGETS = [
  ["GLM 5.2", "z-ai/glm-5.2"],
  ["Kimi K2.7 Code", "moonshotai/kimi-k2.7-code"],
  ["Qwen3.7-Plus", "qwen/qwen3.7-plus"],
  ["MiniMax M3", "minimax/minimax-m3"],
  ["Step 3.7 Flash", "stepfun/step-3.7-flash"],
  ["Qwen3.7-Max", "qwen/qwen3.7-max"],
  ["Agnes-2.0-Flash", "sapiens-ai/agnes-2.0-flash"],
  ["ERNIE 5.1", "baidu/ernie-5.1"],
  ["Ring-2.6-1T", "inclusionai/ring-2.6-1t"],
  ["Ling-2.6-1T", "inclusionai/ling-2.6-1t"],
  ["Hy3 preview", "tencent/hy3-preview"],
  ["MiMo-V2.5", "xiaomi/mimo-v2.5"],
  ["MiMo-V2.5-Pro", "xiaomi/mimo-v2.5-pro"],
  ["Ling-2.6-flash", "inclusionai/ling-2.6-flash"],
  ["KAT-Coder-Pro-V2", "kuaishou/kat-coder-pro-v2"],
  ["Qwen3.6 Flash", "qwen/qwen3.6-flash"],
  ["Doubao-Seed-2.0-pro", "bytedance/doubao-seed-2.0-pro"],
  ["Doubao-Seed-2.0-mini", "bytedance/doubao-seed-2.0-mini"],
] as const;

const ANCHOR_SLUGS = {
  pro: "deepseek/deepseek-v4-pro",
  flash: "deepseek/deepseek-v4-flash",
} as const;

const FALLBACK_ANCHORS: Record<keyof typeof ANCHOR_SLUGS, PriceAnchor> = {
  pro: {
    label: "DeepSeek V4 Pro",
    slug: ANCHOR_SLUGS.pro,
    inputPrice: 0.435,
    outputPrice: 0.87,
  },
  flash: {
    label: "DeepSeek V4 Flash",
    slug: ANCHOR_SLUGS.flash,
    inputPrice: 0.14,
    outputPrice: 0.28,
  },
};

const DEFAULT_BASKET = {
  inputTokens: 100_000,
  outputTokens: 1_000,
};

type LoadResult = {
  allModels: PriceModelSeed[];
  initialRows: PriceModelSeed[];
  anchors: Record<keyof typeof ANCHOR_SLUGS, PriceAnchor>;
  sourceLabel: string;
  sourceDetail: string;
  missingTargets: string[];
  loadError: string | null;
};

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function readLatestSnapshot(): { stamp: string; rows: ApiModel[] } | null {
  const baseDir = path.join(process.cwd(), "results", "token-economics");
  if (!fs.existsSync(baseDir)) return null;

  const stamp = fs
    .readdirSync(baseDir)
    .filter((entry) => fs.statSync(path.join(baseDir, entry)).isDirectory())
    .sort()
    .at(-1);

  if (!stamp) return null;

  const snapshotPath = path.join(baseDir, stamp, "models-api.json");
  if (!fs.existsSync(snapshotPath)) return null;

  const raw = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as
    | ApiModel[]
    | { data?: ApiModel[]; models?: ApiModel[] };
  const rows = Array.isArray(raw) ? raw : raw.data ?? raw.models ?? [];
  return { stamp, rows };
}

function toSeed(row: ReturnType<typeof parseModels>[number], label = row.name): PriceModelSeed {
  return {
    label,
    slug: row.slug,
    inputPrice: num(row.inputPrice),
    outputPrice: num(row.outputPrice),
  };
}

async function loadPricingData(): Promise<LoadResult> {
  let parsedRows: ReturnType<typeof parseModels> = [];
  let sourceLabel = "No model data";
  let sourceDetail = "";
  let loadError: string | null = null;

  try {
    const snapshot = readLatestSnapshot();
    if (snapshot) {
      parsedRows = parseModels(snapshot.rows);
      sourceLabel = `Snapshot ${snapshot.stamp}`;
      sourceDetail = "results/token-economics";
    } else {
      const liveRows = await fetchModelsApi(undefined, { revalidate: 0 });
      parsedRows = parseModels(liveRows);
      sourceLabel = "Live ZenMux listing";
      sourceDetail = "zenmux.ai/models";
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }

  const bySlug = new Map(parsedRows.map((row) => [row.slug, row]));
  const allModels = parsedRows
    .map((row) => toSeed(row))
    .sort((a, b) => a.label.localeCompare(b.label));

  const initialRows: PriceModelSeed[] = [];
  const missingTargets: string[] = [];
  for (const [label, slug] of TARGETS) {
    const row = bySlug.get(slug);
    if (!row) {
      missingTargets.push(`${label} (${slug})`);
      continue;
    }
    initialRows.push(toSeed(row, label));
  }

  const anchors: Record<keyof typeof ANCHOR_SLUGS, PriceAnchor> = {
    pro: bySlug.get(ANCHOR_SLUGS.pro)
      ? toSeed(bySlug.get(ANCHOR_SLUGS.pro)!, "DeepSeek V4 Pro")
      : FALLBACK_ANCHORS.pro,
    flash: bySlug.get(ANCHOR_SLUGS.flash)
      ? toSeed(bySlug.get(ANCHOR_SLUGS.flash)!, "DeepSeek V4 Flash")
      : FALLBACK_ANCHORS.flash,
  };

  return {
    allModels,
    initialRows,
    anchors,
    sourceLabel,
    sourceDetail,
    missingTargets,
    loadError,
  };
}

export default async function DiscountToDeepSeekPage() {
  const data = await loadPricingData();

  return (
    <DiscountToDeepSeekClient
      {...data}
      defaultBasket={DEFAULT_BASKET}
      priceUnit={PRICE_UNIT}
    />
  );
}
