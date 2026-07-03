/**
 * 共享的 .context 产出根定位 + 运行时 .gitignore 维护。
 *
 * 本 skill 的所有运行时产物统一放在用户项目的
 *   <project-dir>/.context/vibe-product-design/
 * 之下：根里只有 config/ 与 .gitignore，其余每个子文件夹对应一次需求
 *   （模式 A 的产品 <slug>/、模式 B 的功能 <slug>/），两种模式互为平级。
 *
 * PRD 及各类 Markdown（PRD.md / 分章 / _changelog / 风格提示词）本身应当随仓库提交，
 * 但模式 B 生成的高保真原型图等大型二进制不适合进 Git。为此，脚本首次写入时会在这个
 * 根目录下自动落一份 .gitignore，忽略图片/媒体等大文件、保留 Markdown 可提交——
 * 与 changelog 系列 skill 的做法一致，源仓库不应签入任何 .context/ 目录。
 */
import * as fs from "node:fs";
import * as path from "node:path";

/** `.context` 下本 skill 的固定子目录名。 */
export const VIBE_DIR_NAME = "vibe-product-design";

/**
 * 从任意一个「位于产出树内」的路径（文件或目录）向上回溯，找到
 * `<…>/.context/vibe-product-design` 这个产出根。找不到返回 null。
 *
 * 三个脚本的入参各不相同，但都落在这棵树里，因此可以共用同一套定位逻辑：
 *   - merge_prd.ts        传入某需求文件夹 <slug>/，向上一级即根
 *   - format_feature_prd  传入 <slug>/PRD.md，向上两级即根
 *   - style_prompt.ts     传入 config 目录，向上一级即根
 */
export function findVibeRoot(startPath: string): string | null {
  let cur = path.resolve(startPath);
  // startPath 可能是文件；逐级向上直到命中 .context/vibe-product-design。
  while (true) {
    if (
      path.basename(cur) === VIBE_DIR_NAME &&
      path.basename(path.dirname(cur)) === ".context"
    ) {
      return cur;
    }
    const parent = path.dirname(cur);
    if (parent === cur) return null; // 到达文件系统根仍未命中
    cur = parent;
  }
}

/**
 * 确保产出根下有一份 .gitignore（缺失才写，绝不覆盖用户已有改动）。
 * 忽略高保真原型图等大型二进制，保留 PRD Markdown 可提交。
 * vibeRoot 传 null（未能定位产出根）时静默跳过。
 */
export function ensureVibeGitignore(vibeRoot: string | null): void {
  if (!vibeRoot) return;
  fs.mkdirSync(vibeRoot, { recursive: true });
  const gitignore = path.join(vibeRoot, ".gitignore");
  if (fs.existsSync(gitignore)) return;
  fs.writeFileSync(
    gitignore,
    [
      "# vibe-product-design 运行时产物 —— 首次写入时自动生成。",
      "# PRD.md / 分章 / _changelog / 风格提示词等 Markdown 会随仓库提交；",
      "# 这里只忽略高保真原型图等大型二进制，避免把它们塞进 GitHub。",
      "",
      "# 各需求文件夹下的 AI 原型图与设计定稿切图目录（模式 B）",
      "*/assets/",
      "*/design/",
      "",
      "# 图片 / 媒体等大型二进制（无论落在哪一层）",
      "*.png",
      "*.jpg",
      "*.jpeg",
      "*.webp",
      "*.gif",
      "*.mp4",
      "*.mov",
      "",
      ".DS_Store",
      "",
    ].join("\n"),
    "utf-8",
  );
}

/** 便捷组合：从产出树内某路径定位根并确保 .gitignore 就位，返回定位到的根。 */
export function ensureVibeGitignoreFrom(startPath: string): string | null {
  const root = findVibeRoot(startPath);
  ensureVibeGitignore(root);
  return root;
}
