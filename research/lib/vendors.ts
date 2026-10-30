// Canonical vendor registry: display names, @zenmux/icons logo filenames,
// and the aliases used to map free-text model/company names back to a canonical vendor.

import fs from "node:fs";
import type { VendorId, VendorMeta } from "./types";

export const VENDORS: Record<VendorId, VendorMeta> = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    logo: "claude_color.svg",
    aliases: ["anthropic", "claude"],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    logo: "openai_light.svg",
    aliases: ["openai", "gpt", "chatgpt", "chat gpt"],
  },
  google: {
    id: "google",
    name: "Google",
    logo: "gemini_color.svg",
    aliases: ["google", "gemini", "deepmind", "bard", "palm"],
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    logo: "deepseek_color.svg",
    aliases: ["deepseek", "深度求索"],
  },
  qwen: {
    id: "qwen",
    name: "Qwen",
    logo: "qwen_color.svg",
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
    logo: "ernie_color.svg",
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
    logo: "doubao_color.svg",
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
    logo: "kimi_color-light.svg",
    aliases: ["moonshot", "moonshot ai", "kimi", "月之暗面"],
  },
  "z-ai": {
    id: "z-ai",
    name: "z-ai",
    logo: "zai_light.svg",
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
    logo: "stepfun_color.svg",
    aliases: ["stepfun", "step-", "step fun", "阶跃", "阶跃星辰", "step star"],
  },
  "x-ai": {
    id: "x-ai",
    name: "xAI",
    logo: "grok_light.svg",
    aliases: ["x-ai", "x.ai", "grok"],
  },
  minimax: {
    id: "minimax",
    name: "MiniMax",
    logo: "minimax_color.svg",
    aliases: ["minimax", "abab", "海螺", "hailuo"],
  },
  kwai: {
    id: "kwai",
    name: "Kwai",
    logo: "kwaikat_color.svg",
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
    logo: "xiaomi_color.svg",
    aliases: ["xiaomi", "mimo", "小米", "mi "],
  },
  tencent: {
    id: "tencent",
    name: "Tencent",
    logo: "hunyuan_color.svg",
    aliases: ["tencent", "hunyuan", "混元", "腾讯", "腾讯混元","Hy", "HY"],
  },
  inclusionai: {
    id: "inclusionai",
    name: "inclusionAI",
    logo: "inclusionai_color-light.svg",
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
    logo: "longcat_color.svg",
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
    logo: "meta_color.svg",
    aliases: ["meta", "llama", "facebook", "meta ai", "muse"],
  },
  mistral: {
    id: "mistral",
    name: "Mistral",
    logo: "mistral_color.svg",
    aliases: ["mistral", "mixtral", "le chat"],
  },
  agnes: {
    id: "agnes",
    name: "Agnes",
    logo: "agnes_light.svg",
    aliases: ["agnes"],
  },
  sakana: {
    id: "sakana",
    name: "Sakana AI",
    logo: "sakana_color.svg",
    aliases: ["sakana", "sakana ai", "sakanaai", "fugu"],
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
// Logo resolution + data URIs (for embedding into the static SVG)
// ---------------------------------------------------------------------------

const LOGO_DIR = `${process.cwd()}/public/model-logo`;
const dataUriCache = new Map<string, string>();

const DARK_CHIP_LOGO: Record<string, string> = {
  anthropic: "claude_color.svg",
  openai: "openai_light.svg",
  google: "gemini_color.svg",
  deepseek: "deepseek_color.svg",
  qwen: "qwen_color.svg",
  baidu: "ernie_color.svg",
  bytedance: "doubao_color.svg",
  moonshot: "kimi_color-light.svg",
  "z-ai": "zai_light.svg",
  stepfun: "stepfun_color.svg",
  "x-ai": "grok_light.svg",
  minimax: "minimax_color.svg",
  kwai: "kwaikat_color.svg",
  xiaomi: "xiaomi_color.svg",
  tencent: "hunyuan_color.svg",
  inclusionai: "inclusionai_color-light.svg",
  meituan: "longcat_color.svg",
  meta: "meta_color.svg",
  mistral: "mistral_color.svg",
  agnes: "agnes_light.svg",
  sakana: "sakana_color.svg",
  "other:microsoft": "microsoft-copilot_color.svg",
  "other:nvidia": "nvidia_color.svg",
  "other:alibaba": "alibaba_color.svg",
  "other:alibaba-cloud": "alibaba-cloud_color.svg",
  "other:aliyun": "alibaba-cloud_color.svg",
};

const LIGHT_SURFACE_LOGO: Record<string, string> = {
  anthropic: "claude_color.svg",
  openai: "openai_dark.svg",
  google: "gemini_color.svg",
  deepseek: "deepseek_color.svg",
  qwen: "qwen_color.svg",
  baidu: "ernie_color.svg",
  bytedance: "doubao_color.svg",
  moonshot: "kimi_color.svg",
  "z-ai": "zai_dark.svg",
  stepfun: "stepfun_color.svg",
  "x-ai": "grok_dark.svg",
  minimax: "minimax_color.svg",
  kwai: "kwaikat_color.svg",
  xiaomi: "xiaomi_color.svg",
  tencent: "hunyuan_color.svg",
  inclusionai: "inclusionai_color.svg",
  meituan: "longcat_color.svg",
  meta: "meta_color.svg",
  mistral: "mistral_color.svg",
  agnes: "agnes_dark.svg",
  sakana: "sakana_color.svg",
  "other:microsoft": "microsoft-copilot_color.svg",
  "other:nvidia": "nvidia_color.svg",
  "other:alibaba": "alibaba_color.svg",
  "other:alibaba-cloud": "alibaba-cloud_color.svg",
  "other:aliyun": "alibaba-cloud_color.svg",
};

const LEGACY_FILE_ALIAS: Record<string, string> = {
  "ZenMux.png": "zenmux-combine-light.svg",
  "ZenMux-Light.png": "zenmux-combine-dark.svg",
  "zenmux-single-black-bg.png": "zenmux-light.svg",
  "zenmux-single-light-bg.png": "zenmux-dark.svg",
  "anthropic.png": "claude_color.svg",
  "openai.png": "openai_light.svg",
  "google.png": "gemini_color.svg",
  "deepseek.png": "deepseek_color.svg",
  "qwen.png": "qwen_color.svg",
  "baidu.png": "ernie_color.svg",
  "bytedance.png": "doubao_color.svg",
  "moonshot.png": "kimi_color-light.svg",
  "z-ai.png": "zai_light.svg",
  "stepfun.png": "stepfun_color.svg",
  "x-ai.png": "grok_light.svg",
  "minimax.png": "minimax_color.svg",
  "kwai.png": "kwaikat_color.svg",
  "kling.png": "kling_color.svg",
  "xiaomi.png": "xiaomi_color.svg",
  "tencent.png": "hunyuan_color.svg",
  "inclusionai.png": "inclusionai_color-light.svg",
  "longcat.png": "longcat_color.svg",
  "meta.png": "meta_color.svg",
  "mistral.png": "mistral_color.svg",
  "agnes.png": "agnes_light.svg",
};

/** Read a vendor logo SVG and return a `data:image/svg+xml;base64,...` URI. Cached per process. */
export function logoDataUri(vendorId: VendorId): string | null {
  const file = DARK_CHIP_LOGO[vendorId] ?? VENDORS[vendorId]?.logo;
  if (!file) return null;
  return logoFileDataUri(file);
}

/** Read any logo file under public/model-logo as a base64 data URI. Cached. */
export function logoFileDataUri(filename: string): string | null {
  const resolved = LEGACY_FILE_ALIAS[filename] ?? filename;
  const cached = dataUriCache.get(resolved);
  if (cached) return cached;
  try {
    if (resolved.endsWith(".svg")) {
      const clean = fs
        .readFileSync(`${LOGO_DIR}/${resolved}`, "utf8")
        .replace(/(?:fill|stroke|stop-color):color\(display-p3[^;"]*\);?/g, "");
      const uri = `data:image/svg+xml;base64,${Buffer.from(clean, "utf8").toString("base64")}`;
      dataUriCache.set(resolved, uri);
      return uri;
    }
    const buf = fs.readFileSync(`${LOGO_DIR}/${resolved}`);
    const uri = `data:image/png;base64,${buf.toString("base64")}`;
    dataUriCache.set(resolved, uri);
    return uri;
  } catch {
    return null;
  }
}

/** Public web path for a vendor logo (defaults to the dark-chip variant used on circular badges). */
export function logoWebPath(
  vendorId: VendorId,
  surface: "dark" | "light" = "dark",
): string | null {
  const map = surface === "light" ? LIGHT_SURFACE_LOGO : DARK_CHIP_LOGO;
  const file = map[vendorId] ?? VENDORS[vendorId]?.logo;
  if (!file) return null;
  const resolved = LEGACY_FILE_ALIAS[file] ?? file;
  return `/model-logo/${encodeURIComponent(resolved)}`;
}
