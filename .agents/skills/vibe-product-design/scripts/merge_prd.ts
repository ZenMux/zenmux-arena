#!/usr/bin/env -S npx --yes tsx
/**
 * 把分章文档合并成一份完整、干净的 PRD.md（TypeScript 版，对应原 merge_prd.py）。
 *
 * 用法：
 *   tsx merge_prd.ts <分章文档所在目录> [--title "产品名"] [--out PRD.md] [--no-lint]
 *
 * 它会：
 *   1. 用 prettier（GFM）就地规范化每个分章文件与 _changelog.md（--no-lint 可关）；
 *   2. 按章节序号(00→05)、再按续写段序号(主文件→.part2→.part3…)排序所有分章文件；
 *   3. 去掉每个续写段开头的 `<!-- 续写自 ... -->` 标记行；
 *   4. 若存在 `_changelog.md`，把它作为「变更记录」表嵌入 PRD 开头（标题之后、目录之前）；
 *   5. 拼成一份带「文档信息 + 变更记录 + 自动生成目录」的 PRD.md，再整体过一遍 prettier。
 *
 * Markdown 规范化用 prettier（通过 _md.ts 的 formatMarkdown 按需调用 npx prettier）。
 * 未装 / 无 npx 时自动跳过规范化并提示，不影响合并本身。
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { formatMarkdown } from "./_md.ts";
import { ensureVibeGitignoreFrom } from "./_context.ts";

// 章节序号 -> 展示名（仅用于目录/缺失提示；正文标题以文件内容为准）
const CHAPTER_NAMES: Record<string, string> = {
  "00": "产品概述",
  "01": "需求分析",
  "02": "商业画布",
  "03": "用户旅程",
  "04": "业务流程",
  "05": "功能设计",
};

const CONTINUE_MARK = /^\s*<!--\s*续写自.*?-->\s*$/;
// 匹配形如 03-用户旅程.md 或 03-用户旅程.part2.md
const FILE_RE = /^(\d{2})-(.+?)(?:\.part(\d+))?\.md$/;

function die(msg: string): never {
  process.stderr.write(msg + "\n");
  process.exit(1);
}

function expandHome(p: string): string {
  if (p === "~") return process.env.HOME ?? p;
  if (p.startsWith("~/")) return path.join(process.env.HOME ?? "", p.slice(2));
  return p;
}

function todayISO(): string {
  // 本地日期 YYYY-MM-DD
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface CliArgs {
  src: string;
  title: string | null;
  out: string;
  noLint: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { src: "", title: null, out: "PRD.md", noLint: false };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-lint") args.noLint = true;
    else if (a === "--title") args.title = argv[++i] ?? null;
    else if (a === "--out") args.out = argv[++i] ?? "PRD.md";
    else positional.push(a);
  }
  if (!positional[0]) die("用法：merge_prd.ts <分章文档所在目录> [--title 产品名] [--out PRD.md] [--no-lint]");
  args.src = positional[0];
  return args;
}

interface Chapter {
  num: string;
  part: number;
  file: string;
}

/** 返回按 (章节号, part号) 排序的文件列表。 */
function collect(src: string): Chapter[] {
  const files: Chapter[] = [];
  for (const name of fs.readdirSync(src)) {
    if (!name.endsWith(".md") || name === "PRD.md") continue;
    const m = FILE_RE.exec(name);
    if (!m) continue;
    files.push({ num: m[1], part: m[3] ? parseInt(m[3], 10) : 1, file: path.join(src, name) });
  }
  files.sort((a, b) => (a.num < b.num ? -1 : a.num > b.num ? 1 : a.part - b.part));
  return files;
}

/** 读取文件正文，去掉续写标记行，去掉首尾多余空行。 */
function readBody(file: string): string {
  const lines = fs.readFileSync(file, "utf-8").split(/\r?\n/);
  return lines.filter((ln) => !CONTINUE_MARK.test(ln)).join("\n").replace(/^\n+|\n+$/g, "");
}

function readChangelog(src: string): string {
  const p = path.join(src, "_changelog.md");
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return "";
  return fs.readFileSync(p, "utf-8").replace(/^\n+|\n+$/g, "");
}

/** 取正文里第一个 # 标题作为目录条目，没有就用 fallback。 */
function firstHeading(body: string, fallback: string): string {
  for (const ln of body.split(/\r?\n/)) {
    const s = ln.trim();
    if (s.startsWith("#")) return s.replace(/^#+/, "").trim();
  }
  return fallback;
}

/** 就地规范化目录下的分章文件与 _changelog.md。返回 prettier 是否可用。 */
function lintSources(src: string): boolean {
  const targets = fs
    .readdirSync(src)
    .filter((n) => n.endsWith(".md") && n !== "PRD.md")
    .map((n) => path.join(src, n));
  const cl = path.join(src, "_changelog.md");
  if (fs.existsSync(cl) && !targets.includes(cl)) targets.push(cl);
  let available = true;
  let changed = 0;
  for (const p of targets.sort()) {
    const original = fs.readFileSync(p, "utf-8");
    const { text, ok } = formatMarkdown(original);
    if (!ok) {
      available = false;
      break; // 没装 prettier，不必继续逐个尝试
    }
    if (text !== original) {
      fs.writeFileSync(p, text, "utf-8");
      changed++;
    }
  }
  if (available && changed) process.stdout.write(`🧹 prettier 已规范化 ${changed} 个分章文件\n`);
  return available;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const src = path.resolve(expandHome(args.src));
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) die(`目录不存在：${src}`);

  // 若 src 位于 .context/vibe-product-design 产出树内，确保根下有 .gitignore（缺失才写）。
  ensureVibeGitignoreFrom(src);

  const lintOn = !args.noLint;
  let lintAvailable = true;
  if (lintOn) lintAvailable = lintSources(src);

  const files = collect(src);
  if (files.length === 0) {
    die(`在 ${src} 没找到符合命名规范的分章文件（如 00-产品概述.md）。`);
  }

  // 按章节聚合（同一章节的多个 part 顺序拼接；files 已排序）
  const seenNums: string[] = [];
  const byNum: Record<string, string[]> = {};
  for (const { num, file } of files) {
    const body = readBody(file);
    (byNum[num] ??= []).push(body);
    if (!seenNums.includes(num)) seenNums.push(num);
  }

  const today = todayISO();
  const title = args.title ?? path.basename(src);
  const changelog = readChangelog(src);
  const missing = Object.keys(CHAPTER_NAMES).filter((n) => !seenNums.includes(n));

  const tocLines: string[] = [];
  const mergedBodies: string[] = [];
  for (const num of seenNums) {
    const body = byNum[num].join("\n\n").replace(/^\n+|\n+$/g, "");
    const heading = firstHeading(body, `${num} · ${CHAPTER_NAMES[num] ?? ""}`);
    tocLines.push(`- ${heading}`);
    mergedBodies.push(body);
  }

  const parts: string[] = [];
  parts.push(`# ${title} · 产品需求文档（PRD）\n`);
  parts.push(`_生成日期：${today} · 由 vibe-product-design 流水线自动合并_\n`);
  if (missing.length) {
    const missStr = missing.map((n) => `${n} ${CHAPTER_NAMES[n]}`).join("、");
    parts.push(`> ⚠️ 注意：以下章节尚未产出，PRD 暂不完整：${missStr}\n`);
  }
  if (changelog) parts.push(changelog + "\n");
  parts.push("## 目录\n");
  parts.push(tocLines.join("\n") + "\n");
  parts.push(mergedBodies.join("\n\n") + "\n");

  let prdText = parts.join("\n");
  if (lintOn && lintAvailable) {
    const { text, ok } = formatMarkdown(prdText);
    prdText = text;
    lintAvailable = ok;
  }

  const outPath = path.join(src, args.out);
  fs.writeFileSync(outPath, prdText, "utf-8");

  process.stdout.write(`✅ PRD 已生成：${outPath}\n`);
  process.stdout.write(`   合并章节：${seenNums.join("、")}\n`);
  if (missing.length) process.stdout.write(`   ⚠️ 缺失章节：${missing.join("、")}\n`);
  if (lintOn && !lintAvailable) {
    process.stdout.write(
      "   ⚠️ 未能调用 prettier，已跳过 Markdown 规范化。需本机有 Node/npx（会用 npx prettier）。\n",
    );
  } else if (!lintOn) {
    process.stdout.write("   ℹ️ 已按 --no-lint 跳过 Markdown 规范化。\n");
  }
}

main();
