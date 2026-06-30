// Canonical vendor registry: display names, logo filenames (under public/maker-logo/),
// and the aliases used to map free-text model/company names back to a canonical vendor.

import fs from "node:fs";
import type { VendorId, VendorMeta } from "./types";

export const VENDORS: Record<VendorId, VendorMeta> = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    logo: "anthropic.png",
    aliases: ["anthropic", "claude"],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    logo: "openai.png",
    aliases: ["openai", "gpt", "chatgpt", "chat gpt"],
  },
  google: {
    id: "google",
    name: "Google",
    logo: "google.png",
    aliases: ["google", "gemini", "deepmind", "bard", "palm"],
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    logo: "deepseek.png",
    aliases: ["deepseek", "深度求索"],
  },
  qwen: {
    id: "qwen",
    name: "Qwen",
    logo: "qwen.png",
    aliases: [
      "qwen",
      "qwq",
      "qvq",
      "tongyi",
      "tong yi",
      "通义",
      "千问",
      "通义千问",
      "通义万相",
      "alibaba",
      "alibaba cloud",
      "aliyun",
      "阿里",
      "阿里巴巴",
      "阿里云",
    ],
  },
  baidu: {
    id: "baidu",
    name: "ERNIE",
    logo: "baidu.png",
    aliases: [
      "ernie",
      "ernie bot",
      "baidu",
      "文心",
      "文心一言",
      "文心大模型",
      "百度",
      "wenxin",
      "yiyan",
    ],
  },
  bytedance: {
    id: "bytedance",
    name: "Doubao",
    logo: "bytedance.png",
    aliases: [
      "doubao",
      "豆包",
      "bytedance",
      "byte dance",
      "字节",
      "字节跳动",
      "云雀",
      "skylark",
      "seedance",
      "seedream",
    ],
  },
  moonshot: {
    id: "moonshot",
    name: "Moonshot",
    logo: "moonshot.png",
    aliases: ["moonshot", "moonshot ai", "kimi", "月之暗面"],
  },
  "z-ai": {
    id: "z-ai",
    name: "z-ai",
    logo: "z-ai.png",
    aliases: [
      "z-ai",
      "z.ai",
      "zhipu",
      "zhipuai",
      "glm",
      "chatglm",
      "智谱",
      "智谱清言",
      "智谱ai",
    ],
  },
  stepfun: {
    id: "stepfun",
    name: "StepFun",
    logo: "stepfun.png",
    aliases: ["stepfun", "step-", "step fun", "阶跃", "阶跃星辰", "step star"],
  },
  "x-ai": {
    id: "x-ai",
    name: "xAI",
    logo: "x-ai.png",
    aliases: ["x-ai", "x.ai", "grok"],
  },
  minimax: {
    id: "minimax",
    name: "MiniMax",
    logo: "minimax.png",
    aliases: ["minimax", "abab", "海螺", "hailuo"],
  },
  kwai: {
    id: "kwai",
    name: "Kwai",
    logo: "kwai.png",
    aliases: [
      "kwai",
      "kwaipilot",
      "kat-coder",
      "kat coder",
      "katcoder",
      "kat",
      "kuaishou",
      "kling",
      "快手",
      "可灵",
      "快影",
    ],
  },
  xiaomi: {
    id: "xiaomi",
    name: "Xiaomi",
    logo: "xiaomi.png",
    aliases: ["xiaomi", "mimo", "小米", "mi "],
  },
  tencent: {
    id: "tencent",
    name: "Tencent",
    logo: "tencent.png",
    aliases: ["tencent", "hunyuan", "混元", "腾讯", "腾讯混元","Hy", "HY"],
  },
  inclusionai: {
    id: "inclusionai",
    name: "inclusionAI",
    logo: "inclusionai.png",
    aliases: [
      "inclusionai",
      "inclusion ai",
      "inclusion",
      "百灵",
      "百灵大模型",
      "ant group",
      "antgroup",
      "ant financial",
      "蚂蚁集团",
      "蚂蚁",
      "bailing",
      "ling",
      "ring",
      "ming",
    ],
  },
  meituan: {
    id: "meituan",
    name: "LongCat",
    logo: "longcat.png",
    aliases: [
      "meituan",
      "longcat",
      "long cat",
      "美团",
    ],
  },
  meta: {
    id: "meta",
    name: "Meta",
    logo: "meta.png",
    aliases: ["meta", "llama", "facebook", "meta ai"],
  },
  mistral: {
    id: "mistral",
    name: "Mistral",
    logo: "mistral.png",
    aliases: ["mistral", "mixtral", "le chat"],
  },
  agnes: {
    id: "agnes",
    name: "Agnes",
    logo: "agnes.png",
    aliases: ["agnes"],
  },
  // Pseudo-vendors: analytical buckets, no logo.
  self: { id: "self", name: "Self (correct)", logo: "", aliases: [] },
  unknown: { id: "unknown", name: "Unknown", logo: "", aliases: [] },
  refused: { id: "refused", name: "Refused", logo: "", aliases: [] },
  // `other` is the pre-materialization bucket: a claim mapping to a non-canonical
  // brand whose name is carried in ExtractionResult.claimedVendorOther. The
  // aggregate step turns each distinct brand into its own dynamic vendor node
  // (id = `other:<slug>`) so confusion edges land on a named circle, not into
  // an opaque "unknown" sink.
  other: { id: "other", name: "Other", logo: "", aliases: [] },
};

/** Real vendor ids (everything except the analytical / pseudo buckets). */
export const REAL_VENDOR_IDS: VendorId[] = (
  Object.keys(VENDORS) as VendorId[]
).filter(
  (id) =>
    id !== "self" && id !== "unknown" && id !== "refused" && id !== "other",
);

const PSEUDO_IDS = new Set<VendorId>(["self", "unknown", "refused", "other"]);

/** True for `self`/`unknown`/`refused`/`other` (the dynamic-brand parent bucket). */
export function isPseudoVendor(id: VendorId): boolean {
  return PSEUDO_IDS.has(id);
}

/** Stable slug from a free-text brand name. ASCII letters/digits, lowercased. */
function slugifyBrand(name: string): string {
  const ascii = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (ascii) return ascii;
  // Non-Latin (e.g. CJK) brand — keep a deterministic hash so it round-trips.
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `b${h.toString(36)}`;
}

/** `other:<slug>` is the runtime VendorId for an extractor-discovered brand. */
export function otherVendorId(name: string): VendorId {
  return `other:${slugifyBrand(name)}` as VendorId;
}

/** True for the dynamic per-brand vendor ids minted from `claimedVendorOther`. */
export function isOtherBrand(id: VendorId): boolean {
  return typeof id === "string" && id.startsWith("other:");
}

/**
 * VendorMeta for a dynamic brand. Title-cases the user-supplied name and
 * leaves logo blank — RelationshipGraph / svg.ts already fall back to a
 * text label when no logo exists.
 */
export function makeOtherVendorMeta(rawName: string): VendorMeta {
  const trimmed = rawName.trim();
  return {
    id: otherVendorId(trimmed),
    name: trimmed,
    logo: "",
    aliases: [],
  };
}

/**
 * Map an arbitrary free-text string to a canonical vendor by case-insensitive
 * alias substring match. Returns null if nothing matches.
 *
 * Aliases are checked longest-first so that more specific strings ("通义千问")
 * win over short generic ones, and to avoid e.g. "mi " matching inside unrelated words.
 */
export function vendorFromText(
  text: string | null | undefined,
): VendorId | null {
  if (!text) return null;
  const haystack = text.toLowerCase();
  let best: { id: VendorId; len: number } | null = null;
  for (const id of REAL_VENDOR_IDS) {
    for (const alias of VENDORS[id].aliases) {
      if (haystack.includes(alias.toLowerCase())) {
        if (!best || alias.length > best.len) best = { id, len: alias.length };
      }
    }
  }
  return best?.id ?? null;
}

// ---------------------------------------------------------------------------
// Logo data URIs (for embedding into the static SVG)
// ---------------------------------------------------------------------------

const LOGO_DIR = `${process.cwd()}/public/maker-logo`;
const dataUriCache = new Map<string, string>();

/** Read a logo PNG and return a `data:image/png;base64,...` URI. Cached per process. */
export function logoDataUri(vendorId: VendorId): string | null {
  const meta = VENDORS[vendorId];
  if (!meta || !meta.logo) return null;
  return logoFileDataUri(meta.logo);
}

/** Read any file under public/maker-logo as a base64 PNG data URI. Cached. */
export function logoFileDataUri(filename: string): string | null {
  const cached = dataUriCache.get(filename);
  if (cached) return cached;
  try {
    const buf = fs.readFileSync(`${LOGO_DIR}/${filename}`);
    const uri = `data:image/png;base64,${buf.toString("base64")}`;
    dataUriCache.set(filename, uri);
    return uri;
  } catch {
    return null;
  }
}

/** Public web path for a vendor logo (URL-encoded for spaces), for the Next.js page. */
export function logoWebPath(vendorId: VendorId): string | null {
  const meta = VENDORS[vendorId];
  if (!meta || !meta.logo) return null;
  return `/maker-logo/${encodeURIComponent(meta.logo)}`;
}
