// Vendor mapping + row normalization for the token-economics study.
//
// The scraper (scrape.ts) emits raw rows keyed by ZenMux slug. This module maps
// each slug's NAMESPACE (the part before "/") onto a canonical vendor id from the
// shared registry in research/lib/vendors.ts, so the new study reuses the exact
// same logos + display names as the "Who Are You?" study — no parallel taxonomy.
//
// The namespace map handles the cases where the ZenMux serving-org prefix differs
// from our canonical vendor id (volcengine→bytedance, moonshotai→moonshot,
// kuaishou→kwai, alibaba→qwen, …). Anything unmapped falls through to
// vendorFromText() (alias substring match) and finally to "unknown".

import {
  VENDORS,
  vendorFromText,
  isPseudoVendor,
} from "@research/lib/vendors";
import type { VendorId } from "@research/lib/types";
import { blendedCost, type ModelEconomics } from "./types";

/** What the scraper produces per model before vendor mapping / metric derivation. */
export interface ScrapedModel {
  slug: string;
  name: string;
  inputPrice: number | null;
  outputPrice: number | null;
  usageRaw: string | null;
  usageTokens: number | null;
  tokenWeek: number | null;
  contextWindow: number | null;
  maxOutput: number | null;
  providers: number | null;
  publishTime: string | null;
  isFree: boolean;
}

/**
 * ZenMux serving-namespace → canonical vendor id, for the cases where the slug
 * prefix isn't already a vendor id or a known alias. Keep in step with the slug
 * prefixes observed on the listing (see the scrape memory note).
 */
const NAMESPACE_TO_VENDOR: Record<string, VendorId> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
  deepseek: "deepseek",
  "x-ai": "x-ai",
  "z-ai": "z-ai",
  qwen: "qwen",
  alibaba: "qwen",
  baidu: "baidu",
  minimax: "minimax",
  xiaomi: "xiaomi",
  stepfun: "stepfun",
  inclusionai: "inclusionai",
  moonshotai: "moonshot",
  moonshot: "moonshot",
  volcengine: "bytedance",
  bytedance: "bytedance",
  kuaishou: "kwai",
  kwai: "kwai",
  tencent: "tencent",
  meta: "meta",
  mistralai: "mistral",
  mistral: "mistral",
  "sapiens-ai": "agnes",
  meituan: "meituan",
  skyreels: "kwai",
};

/** Resolve a slug's namespace to a canonical vendor id (best-effort, never throws). */
export function vendorForSlug(slug: string): VendorId {
  const ns = slug.split("/")[0]?.toLowerCase() ?? "";
  if (NAMESPACE_TO_VENDOR[ns]) return NAMESPACE_TO_VENDOR[ns];
  // Fall back to alias matching on the whole slug (catches e.g. "grok", "kimi").
  return vendorFromText(slug) ?? "unknown";
}

/** "OpenAI: GPT-4.1" | "openai/gpt-4.1" → "GPT-4.1" (drop the vendor prefix). */
export function shortName(name: string, slug: string): string {
  // Prefer the display name after a "Vendor: " prefix.
  const afterColon = name.includes(":") ? name.slice(name.indexOf(":") + 1) : name;
  const trimmed = afterColon.trim();
  if (trimmed && trimmed !== name) return trimmed;
  // Otherwise derive from the slug's model part.
  const part = slug.includes("/") ? slug.slice(slug.indexOf("/") + 1) : slug;
  return part || name;
}

/**
 * Normalize one scraped row into a full ModelEconomics, or null if it carries no
 * price at all (both fields null — a parse failure, not a free model). Genuinely
 * free models arrive with price 0 and are KEPT (they rank at $0).
 */
export function normalizeModel(raw: ScrapedModel): ModelEconomics | null {
  if (raw.inputPrice == null && raw.outputPrice == null) return null;
  const inputPrice = raw.inputPrice ?? 0;
  const outputPrice = raw.outputPrice ?? 0;

  const vendor = vendorForSlug(raw.slug);
  const meta = VENDORS[vendor];
  const cost = blendedCost(inputPrice, outputPrice);

  return {
    slug: raw.slug,
    name: raw.name,
    shortName: shortName(raw.name, raw.slug),
    vendor,
    vendorName: meta?.name ?? vendor,
    logo: meta && !isPseudoVendor(vendor) ? meta.logo : "",
    inputPrice,
    outputPrice,
    blendedCost: cost,
    outputInputRatio: inputPrice > 0 ? outputPrice / inputPrice : null,
    usageTokens: raw.usageTokens,
    usageRaw: raw.usageRaw,
    tokenWeek: raw.tokenWeek,
    tokensPerDollar:
      raw.usageTokens != null && cost > 0 ? raw.usageTokens / cost : null,
    // Launch-window metrics start null; compute() fills them from the
    // model_usage series once it's fetched (normalize stays pure on the row).
    avgDailyTokens: null,
    avgDailyWindow: null,
    avgDailyPerDollar: null,
    contextWindow: raw.contextWindow,
    maxOutput: raw.maxOutput,
    providers: raw.providers,
    publishTime: raw.publishTime,
    isFree: raw.isFree,
  };
}
