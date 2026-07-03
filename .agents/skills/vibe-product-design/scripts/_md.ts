/**
 * 共享的 Markdown 规范化工具（对应原来 Python 侧的 mdformat）。
 *
 * 用现成的 prettier（GFM + 表格）做格式化，通过 `npx --yes prettier` 按需调用，
 * 不把 prettier 作为硬依赖装进 skill。未装 / 无 npx 时优雅降级：原样返回并标记
 * 未生效，合并/格式化本身照常完成——与原 mdformat「可选」的行为一致。
 *
 * `--prose-wrap preserve` 对应 mdformat 的 wrap=keep：不重排中文段落的换行，
 * 只修结构性格式（标题空行、列表缩进、表格对齐、去行尾空白、末尾单换行等）。
 */
import { spawnSync } from "node:child_process";

export interface FormatResult {
  text: string;
  ok: boolean; // prettier 是否真正跑成功
}

let cachedAvailable: boolean | null = null;

/** 探测本机能否调用 prettier（结果缓存，避免每个文件都探一次）。 */
function prettierAvailable(): boolean {
  if (cachedAvailable !== null) return cachedAvailable;
  const probe = spawnSync(
    "npx",
    ["--yes", "prettier", "--version"],
    { encoding: "utf-8", timeout: 60_000 },
  );
  cachedAvailable = probe.status === 0;
  return cachedAvailable;
}

/**
 * 用 prettier 规范化一段 Markdown。返回 { text, ok }。
 * ok=false 表示 prettier 不可用或调用失败，此时 text 原样返回。
 */
export function formatMarkdown(input: string): FormatResult {
  if (!prettierAvailable()) return { text: input, ok: false };
  const res = spawnSync(
    "npx",
    [
      "--yes",
      "prettier",
      "--stdin-filepath",
      "doc.md", // 让 prettier 按 markdown 解析
      "--prose-wrap",
      "preserve",
    ],
    { input, encoding: "utf-8", timeout: 120_000 },
  );
  if (res.status !== 0 || typeof res.stdout !== "string" || res.stdout === "") {
    return { text: input, ok: false };
  }
  return { text: res.stdout, ok: true };
}
