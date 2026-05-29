// Canonical vendor registry: display names, logo filenames (under public/maker-logo/),
// and the aliases used to map free-text model/company names back to a canonical vendor.
//
// NOTE on logo filenames: several contain spaces exactly as shipped in the repo
// ("google-brand 2.png", "minimax-text 1.png", "xiaomi-1 1.png"). Keep them verbatim.

import fs from "node:fs";
import path from "node:path";
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
    logo: "google-brand 2.png",
    aliases: ["google", "gemini", "deepmind", "bard", "palm"],
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    logo: "DeepSeek.png",
    aliases: ["deepseek", "深度求索"],
  },
  qwen: {
    id: "qwen",
    name: "Qwen",
    logo: "Qwen.png",
    aliases: ["qwen", "tongyi", "tong yi", "通义", "千问", "通义千问", "alibaba", "阿里", "阿里巴巴"],
  },
  "baidu-ernie": {
    id: "baidu-ernie",
    name: "ERNIE",
    logo: "ernie.png",
    aliases: ["ernie", "baidu", "文心", "文心一言", "百度", "wenxin", "yiyan"],
  },
  doubao: {
    id: "doubao",
    name: "Doubao",
    logo: "doubao.png",
    aliases: ["doubao", "豆包", "bytedance", "字节", "字节跳动", "云雀", "skylark"],
  },
  moonshot: {
    id: "moonshot",
    name: "Moonshot",
    logo: "moonshot.png",
    aliases: ["moonshot", "kimi", "月之暗面"],
  },
  zhipu: {
    id: "zhipu",
    name: "Zhipu",
    logo: "zhipu.png",
    aliases: ["zhipu", "glm", "智谱", "chatglm", "z.ai", "智谱清言"],
  },
  stepfun: {
    id: "stepfun",
    name: "StepFun",
    logo: "stepfun.png",
    aliases: ["stepfun", "step-", "阶跃", "阶跃星辰", "step star"],
  },
  xai: {
    id: "xai",
    name: "xAI",
    logo: "xAI.png",
    aliases: ["xai", "x.ai", "grok"],
  },
  minimax: {
    id: "minimax",
    name: "MiniMax",
    logo: "minimax-text 1.png",
    aliases: ["minimax", "abab", "海螺", "hailuo"],
  },
  kwai: {
    id: "kwai",
    name: "Kwai",
    logo: "kwai.png",
    aliases: ["kwai", "kuaishou", "kling", "快手", "可灵"],
  },
  xiaomi: {
    id: "xiaomi",
    name: "Xiaomi",
    logo: "xiaomi-1 1.png",
    aliases: ["xiaomi", "mimo", "小米", "mi "],
  },
  tencent: {
    id: "tencent",
    name: "Tencent",
    logo: "tbox-logo.png",
    aliases: ["tencent", "hunyuan", "混元", "腾讯"],
  },
  inclusion: {
    id: "inclusion",
    name: "inclusionAI",
    logo: "inclusion.png",
    aliases: ["inclusion", "inclusionai", "ant", "蚂蚁", "bailing", "百灵", "ling"],
  },
  zenmux: {
    id: "zenmux",
    name: "ZenMux",
    logo: "ZenMux.png",
    aliases: ["zenmux"],
  },
  // Pseudo-vendors: analytical buckets, no logo.
  self: { id: "self", name: "Self (correct)", logo: "", aliases: [] },
  unknown: { id: "unknown", name: "Unknown", logo: "", aliases: [] },
  refused: { id: "refused", name: "Refused", logo: "", aliases: [] },
};

/** Real vendor ids (everything except the three analytical buckets). */
export const REAL_VENDOR_IDS: VendorId[] = (Object.keys(VENDORS) as VendorId[]).filter(
  (id) => id !== "self" && id !== "unknown" && id !== "refused",
);

/**
 * Map an arbitrary free-text string to a canonical vendor by case-insensitive
 * alias substring match. Returns null if nothing matches.
 *
 * Aliases are checked longest-first so that more specific strings ("通义千问")
 * win over short generic ones, and to avoid e.g. "mi " matching inside unrelated words.
 */
export function vendorFromText(text: string | null | undefined): VendorId | null {
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

const LOGO_DIR = path.join(process.cwd(), "public", "maker-logo");
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
    const buf = fs.readFileSync(path.join(LOGO_DIR, filename));
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
