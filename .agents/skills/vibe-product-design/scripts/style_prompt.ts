#!/usr/bin/env -S npx --yes tsx
/**
 * 风格提示词的「预处理 + 加载」协调器（config-driven，TypeScript 版）。
 *
 * 关键：配置和缓存都存放在**用户项目**的 `.context/vibe-product-design/` 下，而不是
 * skill 自身目录——这样 skill 升级覆盖自己的文件时，不会清掉用户的风格配置与缓存。
 * 首次运行时，把 skill 自带的 config 模板复制过去（只在目标不存在时复制，不覆盖用户改动）。
 *
 *   <skill-dir>/config/                     ← 模板（跟着 skill 走，升级会被覆盖）
 *     → 首次 bootstrap 复制到 →
 *   <project-dir>/.context/vibe-product-design/config/   ← 运行时真正读写的地方
 *       prototype-style.yaml
 *       generated/<slug>.style.md
 *
 * 用户只在 prototype-style.yaml 里写一句话主题 active_theme；细致的风格提示词由大模型
 * 在预处理阶段展开成缓存文件，出图时加载。本脚本不调用大模型，只做确定性编排：
 *   plan   解析主题 → 命中缓存则输出 ready + 风格提示词；否则输出 need_generation + 任务书 brief
 *   load   只加载已缓存的风格提示词；未缓存则报错退出
 *   params 输出出图参数（model/quality/size）
 *
 * 输出统一为 JSON 对象，并附一行 `RESULT_JSON: {...}` 便于下游解析。
 *
 * 用法：
 *   tsx style_prompt.ts <plan|load|params> --project-dir <项目根>
 *        [--config <yaml路径>] [--theme <文本或key>] [--force]
 *
 * 无第三方依赖：内置极简 YAML 解析器，覆盖本配置用到的子集（缩进映射 + 标量）。
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { ensureVibeGitignoreFrom } from "./_context.ts";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE_CONFIG_DIR = path.join(SKILL_DIR, "config");
const CONTEXT_SUBDIR = path.join(".context", "vibe-product-design", "config");

// 通用质量底线：与具体审美无关，任何主题展开出的风格提示词都必须包含，
// 防止自定义主题退化成简陋线框图。预处理任务书会把它交代给大模型。
const QUALITY_BASELINE = [
  "高保真界面稿，不是灰框占位或手绘线框图",
  "使用真实文案与内容（真实标题 / 按钮文字 / 数据 / 列表项），不要占位框、假字或乱码",
  "把这个界面最关键的设计决策清楚展现出来：核心组件形态、信息层级、当前所处的交互状态",
  "同一功能的不同状态（默认 / 选中 / 空 / 加载 / 异常）各出一张图，用状态差异体现设计，不要把多个状态挤进一张图",
];

// ------------------------- 命令行解析 -------------------------

interface Args {
  command: "plan" | "load" | "params";
  projectDir: string | null;
  config: string | null;
  theme: string | null;
  force: boolean;
}

function die(msg: string): never {
  process.stderr.write(msg + "\n");
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  const positional = argv[0];
  if (!positional || !["plan", "load", "params"].includes(positional)) {
    die("用法：style_prompt.ts <plan|load|params> --project-dir <项目根> [--config <yaml>] [--theme <文本或key>] [--force]");
  }
  const args: Args = {
    command: positional as Args["command"],
    projectDir: null,
    config: null,
    theme: null,
    force: false,
  };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") args.force = true;
    else if (a === "--project-dir") args.projectDir = argv[++i] ?? null;
    else if (a === "--config") args.config = argv[++i] ?? null;
    else if (a === "--theme") args.theme = argv[++i] ?? null;
    else die(`未知参数：${a}`);
  }
  return args;
}

// ------------------------- config bootstrap 到 .context -------------------------

/** 把 skill 自带 config 模板递归复制到目标（只在目标缺失时复制，绝不覆盖用户已有文件）。 */
function copyIfMissing(srcDir: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyIfMissing(src, dest);
    } else if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
    }
  }
}

/**
 * 确定运行时 config 目录并完成 bootstrap，返回该目录路径。
 * 优先级：--config 指到某个 yaml → 用它所在目录；否则用 <project-dir>/.context/…；
 * 若给了 project-dir，则把模板 bootstrap 过去。
 */
function resolveConfigDir(args: Args): string {
  if (args.config) {
    const cfg = path.resolve(expandHome(args.config));
    return path.dirname(cfg);
  }
  if (!args.projectDir) {
    die("需要 --project-dir <项目根>（用于定位 .context/vibe-product-design/config），或用 --config 直接指定配置文件。");
  }
  const projectDir = path.resolve(expandHome(args.projectDir));
  const runtimeDir = path.join(projectDir, CONTEXT_SUBDIR);
  // 首次使用：把 skill 模板复制到 .context（不覆盖用户改动）。
  if (fs.existsSync(TEMPLATE_CONFIG_DIR)) {
    copyIfMissing(TEMPLATE_CONFIG_DIR, runtimeDir);
  }
  // 首次写入时在产出根（.context/vibe-product-design）落一份 .gitignore，
  // 忽略高保真原型图等大文件、保留 PRD Markdown 可提交（缺失才写）。
  ensureVibeGitignoreFrom(runtimeDir);
  return runtimeDir;
}

function expandHome(p: string): string {
  if (p === "~") return process.env.HOME ?? p;
  if (p.startsWith("~/")) return path.join(process.env.HOME ?? "", p.slice(2));
  return p;
}

// ------------------------- 零依赖 YAML 读取 -------------------------

function parseScalar(value: string): string {
  let v = value.trim();
  if (v && (v[0] === "'" || v[0] === '"')) {
    const quote = v[0];
    const end = v.indexOf(quote, 1);
    return end !== -1 ? v.slice(1, end) : v.slice(1);
  }
  const hashPos = v.indexOf(" #");
  if (hashPos !== -1) v = v.slice(0, hashPos);
  return v.trim();
}

type YamlNode = { [k: string]: YamlNode | string };

/** 极简 YAML：缩进映射 + 标量值，覆盖本配置用到的子集（无列表/锚点/多行标量）。 */
function minimalYamlLoad(text: string): YamlNode {
  const root: YamlNode = {};
  const stack: Array<[number, YamlNode]> = [[-1, root]];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trimStart().startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    const idx = raw.indexOf(":");
    if (idx === -1) continue;
    const key = raw.slice(0, idx).trim();
    const rest = raw.slice(idx + 1);
    while (stack.length && indent <= stack[stack.length - 1][0]) stack.pop();
    const parent = stack[stack.length - 1][1];
    if (rest.trim() === "") {
      const child: YamlNode = {};
      parent[key] = child;
      stack.push([indent, child]);
    } else {
      parent[key] = parseScalar(rest);
    }
  }
  return root;
}

interface Config {
  platform?: string;
  platforms?: Record<string, { label?: string; size?: string }>;
  active_theme?: string;
  themes?: Record<string, string>;
  rendering?: Record<string, unknown>;
}

function loadConfig(configPath: string): Config {
  if (!fs.existsSync(configPath) || !fs.statSync(configPath).isFile()) {
    die(`配置文件不存在：${configPath}`);
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  return minimalYamlLoad(raw) as unknown as Config;
}

// ------------------------- 主题解析与缓存路径 -------------------------

function slugify(text: string): string {
  let s = text.trim().toLowerCase().replace(/\s+/g, "-");
  // 允许中英文与连字符
  s = s.replace(/[^0-9a-z一-鿿-]/g, "");
  s = s.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return s.slice(0, 40) || "theme";
}

/** 返回 [themeSlug, themeText]。命中 themes: key 用 key 作 slug、其值作文本；否则视为自由文本。 */
function resolveTheme(config: Config, override: string | null): [string, string] {
  const themes = config.themes ?? {};
  const raw = (override ?? config.active_theme ?? "").trim();
  if (!raw) die("配置里没有 active_theme，命令行也没给 --theme。");
  if (raw in themes && themes[raw]) {
    return [slugify(raw), String(themes[raw]).trim()];
  }
  const digest = crypto.createHash("sha1").update(raw, "utf-8").digest("hex").slice(0, 6);
  return [`${slugify(raw)}-${digest}`, raw];
}

function styleFilePath(configDir: string, themeSlug: string): string {
  return path.join(configDir, "generated", `${themeSlug}.style.md`);
}

/**
 * 解析目标平台（强约束）：所有页面级原型图的尺寸与界面形态都按它出。
 * platform 必须命中 platforms: 里的一个 key；解析结果并入 rendering 返回。
 */
function resolvePlatform(config: Config): { key: string; label: string; size: string } {
  const platforms = config.platforms ?? {};
  const key = (config.platform ?? "").trim();
  if (!key) die("配置里没有 platform（目标平台）。请在 prototype-style.yaml 里选一个 platforms: 下的 key（如 web / mobile / tablet）。");
  const entry = platforms[key];
  if (!entry || typeof entry === "string" || !entry.size) {
    const known = Object.keys(platforms).join(" / ") || "（空）";
    die(`platform: ${key} 未在 platforms: 里定义（或缺少 size）。可选值：${known}`);
  }
  return { key, label: String(entry.label ?? key), size: String(entry.size) };
}

function getRendering(config: Config): Record<string, unknown> {
  const platform = resolvePlatform(config);
  return {
    ...(config.rendering ?? {}),
    // 尺寸由 platform 决定（强约束）：页面级原型图一律用它，不要按图自选尺寸。
    size: platform.size,
    platform: platform.key,
    platform_label: platform.label,
    size_note:
      "页面级原型图一律用此 size / 界面形态（强约束，由配置 platform 决定）；仅组件/局部特写可临时用其它尺寸（如 1024x1024）。",
  };
}

// ------------------------- 预处理任务书 -------------------------

function buildBrief(themeText: string, outPath: string): string {
  const baseline = QUALITY_BASELINE.map((b, i) => `  ${i + 1}. ${b}`).join("\n");
  return `把下面这个「风格主题」展开成一份可复用的**风格提示词**，用于给
zenmux-image-generation 生成高保真产品原型图。这是一次性预处理，产物会被缓存复用。

风格主题（用户所填，一句话）：
    ${themeText}

请据此写出一段自然语言风格提示词（中文，150–300 字为宜），把这个主题**具象化**为
可直接指导出图的视觉规格，至少覆盖：
  - 整体设计语言 / 参照的设计师或品牌气质
  - 配色（背景 / 正文 / 强调色，含要规避的颜色；给出大致色号更好）
  - 字体（字族气质、字重、字号层级）
  - 布局与留白（网格、信息密度、如何强调重点）
  - 组件与质感（描边 / 阴影 / 圆角 / 图标 / 有无拟物）
  - 整体氛围关键词
  - 明确要规避的元素

无论主题是什么，这段风格提示词都**必须内化以下通用质量底线**（把它们自然融进文字，
不要另起编号清单）：
${baseline}

把最终风格提示词写入这个文件（只写风格提示词正文，开头可加一行 \`# 风格：<主题>\` 作标题）：
    ${outPath}

写完后即完成预处理；出图时会自动加载这段风格提示词，拼在每张图的具体画面描述之前。`;
}

// ------------------------- 输出 -------------------------

function emit(payload: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
  process.stdout.write("RESULT_JSON: " + JSON.stringify(payload) + "\n");
}

function readTrimmed(p: string): string | null {
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return null;
  const t = fs.readFileSync(p, "utf-8").trim();
  return t || null;
}

// ------------------------- 命令 -------------------------

function cmdPlan(config: Config, configDir: string, args: Args): void {
  const [themeSlug, themeText] = resolveTheme(config, args.theme);
  const outPath = styleFilePath(configDir, themeSlug);
  const cached = readTrimmed(outPath);

  if (cached && !args.force) {
    emit({
      status: "ready",
      theme_slug: themeSlug,
      theme_text: themeText,
      style_file: outPath,
      prompt_prefix: cached,
      rendering: getRendering(config),
      note: "已有缓存的风格提示词，可直接用于出图（如需重新展开加 --force）。",
    });
    return;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  emit({
    status: "need_generation",
    theme_slug: themeSlug,
    theme_text: themeText,
    style_file: outPath,
    brief: buildBrief(themeText, outPath),
    quality_baseline: QUALITY_BASELINE,
    rendering: getRendering(config),
    note: "尚无缓存。请按 brief 生成风格提示词并写入 style_file，即完成预处理。",
  });
}

function cmdLoad(config: Config, configDir: string, args: Args): void {
  const [themeSlug, themeText] = resolveTheme(config, args.theme);
  const outPath = styleFilePath(configDir, themeSlug);
  const cached = readTrimmed(outPath);
  if (!cached) {
    die(
      `风格提示词尚未生成：${outPath}\n` +
        `请先运行：style_prompt.ts plan --project-dir <项目根>  然后按 brief 生成该文件。`,
    );
  }
  emit({
    status: "ready",
    theme_slug: themeSlug,
    theme_text: themeText,
    style_file: outPath,
    prompt_prefix: cached,
    rendering: getRendering(config),
  });
}

function cmdParams(config: Config): void {
  emit({ status: "ok", rendering: getRendering(config) });
}

// ------------------------- main -------------------------

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const configDir = resolveConfigDir(args);
  const configPath = args.config
    ? path.resolve(expandHome(args.config))
    : path.join(configDir, "prototype-style.yaml");
  const config = loadConfig(configPath);

  if (args.command === "plan") cmdPlan(config, configDir, args);
  else if (args.command === "load") cmdLoad(config, configDir, args);
  else cmdParams(config);
}

main();
