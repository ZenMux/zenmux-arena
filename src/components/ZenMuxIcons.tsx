"use client";

import type { ComponentType, SVGProps } from "react";
import {
  Agnes,
  Alibaba,
  AlibabaCloud,
  Amazon,
  AmazonBedrock,
  AntLing,
  Anthropic,
  Atria,
  Axonhub,
  Azure,
  Baidu,
  Bigmodel,
  BlackForestLabs,
  Bytedance,
  Claude,
  ClaudeCode,
  Cloudsway,
  Codex,
  Cursor,
  Deepseek,
  Dify,
  DotsStudio,
  Doubao,
  Ernie,
  Gemini,
  GeminiCli,
  Goodput,
  Google,
  Grok,
  GrokBuild,
  Hermes,
  HpcAi,
  Hunyuan,
  Inclusionai,
  Joyland,
  Kilo,
  Kimi,
  KingsoftCloud,
  Kling,
  Kwaikat,
  Langchain,
  Llamaindex,
  Longcat,
  Mastra,
  Meta,
  Metagpt,
  MicrosoftCopilot,
  Mindlab,
  Minimax,
  Mistral,
  MoonshotAi,
  N8n,
  NewApi,
  Novita,
  Nvidia,
  Obsidian,
  OhMyPi,
  Ollama,
  Openai,
  Openclaw,
  Opencode,
  Openhands,
  OpenWebui,
  Pi,
  Pixverse,
  Pydanticai,
  Qwen,
  Rikkahub,
  Sakana,
  Sambanova,
  Sider,
  Siliconflow,
  Skyreels,
  Spacexai,
  Stepfun,
  Tbox,
  Trae,
  Typesafe,
  Volcengine,
  WorkBuddy,
  Xai,
  Xiaomi,
  XiaomiMimo,
  Zai,
  Zcode,
  Zenmux,
} from "@zenmux/icons";
import { cn } from "@/lib/utils";
import { resolveVendorIconKey, type VendorIconKey } from "@/lib/vendor-icons";

type SvgIconComponent = ComponentType<
  SVGProps<SVGSVGElement> & { size?: number | string }
>;

interface IconEntry {
  /** Component for light surfaces (paper/white cards). */
  light: SvgIconComponent;
  /** Component for dark surfaces (near-black chips, dark-mode cards). */
  dark: SvgIconComponent;
  /** Public SVG path under /model-logo/ for light surfaces. */
  lightPath: string;
  /** Public SVG path under /model-logo/ for dark surfaces. */
  darkPath: string;
}

function colorEntry(
  id: string,
  lightComp: SvgIconComponent,
  darkComp: SvgIconComponent = lightComp,
  lightFile = `${id}_color.svg`,
  darkFile = lightFile,
): IconEntry {
  return {
    light: lightComp,
    dark: darkComp,
    lightPath: `/model-logo/${lightFile}`,
    darkPath: `/model-logo/${darkFile}`,
  };
}

function monoEntry(
  id: string,
  darkInkComp: SvgIconComponent,
  lightInkComp: SvgIconComponent,
): IconEntry {
  return {
    light: darkInkComp,
    dark: lightInkComp,
    lightPath: `/model-logo/${id}_dark.svg`,
    darkPath: `/model-logo/${id}_light.svg`,
  };
}

const ICON_ENTRIES: Record<VendorIconKey, IconEntry> = {
  // Canonical vendor IDs (mapped to their primary model/maker mark in Arena)
  anthropic: colorEntry("claude", Claude.Color),
  openai: monoEntry("openai", Openai.Dark, Openai.Light),
  google: colorEntry("gemini", Gemini.Color),
  deepseek: colorEntry("deepseek", Deepseek.Color),
  qwen: colorEntry("qwen", Qwen.Color),
  baidu: colorEntry("ernie", Ernie.Color),
  bytedance: colorEntry("doubao", Doubao.Color),
  moonshot: colorEntry(
    "kimi",
    Kimi.Color,
    Kimi.ColorLight,
    "kimi_color.svg",
    "kimi_color-light.svg",
  ),
  "z-ai": monoEntry("zai", Zai.Dark, Zai.Light),
  stepfun: colorEntry("stepfun", Stepfun.Color),
  "x-ai": monoEntry("grok", Grok.Dark, Grok.Light),
  minimax: colorEntry("minimax", Minimax.Color),
  kwai: colorEntry("kwaikat", Kwaikat.Color),
  xiaomi: colorEntry("xiaomi", Xiaomi.Color),
  tencent: colorEntry("hunyuan", Hunyuan.Color),
  inclusionai: colorEntry(
    "inclusionai",
    Inclusionai.ColorDark,
    Inclusionai.Color,
    "inclusionai_color.svg",
    "inclusionai_color-light.svg",
  ),
  meituan: colorEntry("longcat", Longcat.Color),
  meta: colorEntry("meta", Meta.Color),
  mistral: colorEntry("mistral", Mistral.Color),
  agnes: monoEntry("agnes", Agnes.Dark, Agnes.Light),

  // Direct @zenmux/icons catalog IDs & legacy/specimen aliases
  claude: colorEntry("claude", Claude.Color),
  "anthropic-company": colorEntry("anthropic", Anthropic.Color),
  chatgpt: monoEntry("openai", Openai.Dark, Openai.Light),
  gemini: colorEntry("gemini", Gemini.Color),
  "google-company": colorEntry("google", Google.Color),
  deepeek: colorEntry("deepseek", Deepseek.Color),
  alibaba: colorEntry("alibaba", Alibaba.Color),
  "alibaba-cloud": colorEntry("alibaba-cloud", AlibabaCloud.Color),
  alibabacloud: colorEntry("alibaba-cloud", AlibabaCloud.Color),
  ernie: colorEntry("ernie", Ernie.Color),
  wenxin: colorEntry("ernie", Ernie.Color),
  "baidu-company": colorEntry("baidu", Baidu.Color),
  doubao: colorEntry("doubao", Doubao.Color),
  "bytedance-company": colorEntry("bytedance", Bytedance.Color),
  kimi: colorEntry(
    "kimi",
    Kimi.Color,
    Kimi.ColorLight,
    "kimi_color.svg",
    "kimi_color-light.svg",
  ),
  "moonshot-ai": monoEntry("moonshot-ai", MoonshotAi.Dark, MoonshotAi.Light),
  moonshotai: colorEntry(
    "kimi",
    Kimi.Color,
    Kimi.ColorLight,
    "kimi_color.svg",
    "kimi_color-light.svg",
  ),
  zai: monoEntry("zai", Zai.Dark, Zai.Light),
  bigmodel: colorEntry("bigmodel", Bigmodel.Color),
  "big-model": colorEntry("bigmodel", Bigmodel.Color),
  grok: monoEntry("grok", Grok.Dark, Grok.Light),
  xai: monoEntry("xai", Xai.Dark, Xai.Light),
  kwaikat: colorEntry("kwaikat", Kwaikat.Color),
  kling: colorEntry("kling", Kling.Color),
  "xiaomi-mimo": monoEntry("xiaomi-mimo", XiaomiMimo.Dark, XiaomiMimo.Light),
  hunyuan: colorEntry("hunyuan", Hunyuan.Color),
  "ant-ling": colorEntry("ant-ling", AntLing.Color),
  ling: colorEntry("ant-ling", AntLing.Color),
  longcat: colorEntry("longcat", Longcat.Color),
  mistralai: colorEntry("mistral", Mistral.Color),
  "sapiens-al": monoEntry("agnes", Agnes.Dark, Agnes.Light),
  zenmux: monoEntry("zenmux", Zenmux.Dark, Zenmux.Light),

  // Additional @zenmux/icons catalog entries (providers, agents, other:<slug>)
  amazon: colorEntry("amazon", Amazon.Color),
  "amazon-bedrock": colorEntry("amazon-bedrock", AmazonBedrock.Color),
  atria: monoEntry("atria", Atria.Dark, Atria.Light),
  axonhub: colorEntry(
    "axonhub",
    Axonhub.Color,
    Axonhub.ColorLight,
    "axonhub_color.svg",
    "axonhub_color-light.svg",
  ),
  azure: colorEntry("azure", Azure.Color),
  "black-forest-labs": colorEntry("black-forest-labs", BlackForestLabs.Color),
  "claude-code": colorEntry("claude-code", ClaudeCode.Color),
  cloudsway: colorEntry("cloudsway", Cloudsway.Color),
  codex: colorEntry("codex", Codex.Color),
  cursor: monoEntry("cursor", Cursor.Dark, Cursor.Light),
  dify: colorEntry("dify", Dify.Color),
  "dots-studio": colorEntry("dots-studio", DotsStudio.Color),
  "gemini-cli": colorEntry("gemini-cli", GeminiCli.Color),
  goodput: colorEntry("goodput", Goodput.Color),
  "grok-build": monoEntry("grok-build", GrokBuild.Dark, GrokBuild.Light),
  hermes: colorEntry("hermes", Hermes.Color),
  "hpc-ai": colorEntry("hpc-ai", HpcAi.Color),
  joyland: colorEntry("joyland", Joyland.Color),
  kilo: monoEntry("kilo", Kilo.Dark, Kilo.Light),
  "kingsoft-cloud": colorEntry("kingsoft-cloud", KingsoftCloud.Color),
  langchain: monoEntry("langchain", Langchain.Dark, Langchain.Light),
  llamaindex: colorEntry("llamaindex", Llamaindex.Color),
  mastra: monoEntry("mastra", Mastra.Dark, Mastra.Light),
  metagpt: monoEntry("metagpt", Metagpt.Dark, Metagpt.Light),
  "microsoft-copilot": colorEntry("microsoft-copilot", MicrosoftCopilot.Color),
  copilot: colorEntry("microsoft-copilot", MicrosoftCopilot.Color),
  microsoft: colorEntry("microsoft-copilot", MicrosoftCopilot.Color),
  mindlab: monoEntry("mindlab", Mindlab.Dark, Mindlab.Light),
  n8n: colorEntry("n8n", N8n.Color),
  "new-api": colorEntry("new-api", NewApi.Color),
  novita: colorEntry("novita", Novita.Color),
  nvidia: colorEntry("nvidia", Nvidia.Color),
  obsidian: colorEntry("obsidian", Obsidian.Color),
  "oh-my-pi": colorEntry("oh-my-pi", OhMyPi.Color),
  ollama: monoEntry("ollama", Ollama.Dark, Ollama.Light),
  "open-webui": monoEntry("open-webui", OpenWebui.Dark, OpenWebui.Light),
  openclaw: colorEntry("openclaw", Openclaw.Color),
  opencode: monoEntry("opencode", Opencode.Dark, Opencode.Light),
  openhands: colorEntry("openhands", Openhands.Color),
  pi: monoEntry("pi", Pi.Dark, Pi.Light),
  pixverse: colorEntry("pixverse", Pixverse.Color),
  pydanticai: colorEntry("pydanticai", Pydanticai.Color),
  rikkahub: colorEntry("rikkahub", Rikkahub.Color),
  sakana: colorEntry("sakana", Sakana.Color),
  sambanova: colorEntry("sambanova", Sambanova.Color),
  sider: colorEntry("sider", Sider.Color),
  siliconflow: colorEntry("siliconflow", Siliconflow.Color),
  skyreels: monoEntry("skyreels", Skyreels.Dark, Skyreels.Light),
  spacexai: monoEntry("spacexai", Spacexai.Dark, Spacexai.Light),
  tbox: colorEntry("tbox", Tbox.Color),
  trae: colorEntry("trae", Trae.Color),
  typesafe: colorEntry("typesafe", Typesafe.Color),
  volcengine: colorEntry("volcengine", Volcengine.Color),
  "work-buddy": colorEntry("work-buddy", WorkBuddy.Color),
  zcode: colorEntry("zcode", Zcode.Color),
};

export function resolveIconEntry(vendorOrKey: string | null | undefined): IconEntry | null {
  const key = resolveVendorIconKey(vendorOrKey);
  return key ? ICON_ENTRIES[key] : null;
}

export function vendorIconPath(
  vendorOrKey: string | null | undefined,
  surface: "light" | "dark" = "light",
): string | null {
  const entry = resolveIconEntry(vendorOrKey);
  if (!entry) return null;
  return surface === "dark" ? entry.darkPath : entry.lightPath;
}

/**
 * Renders a brand/model/vendor icon from `@zenmux/icons`.
 *
 * - `surface="light"` (default): dark/color variant for light paper/card backgrounds.
 * - `surface="dark"`: light/color variant for dark chips or dark headers.
 * - `surface="auto"`: automatically switches between light and dark mode via Tailwind `dark:`.
 */
export function VendorIcon({
  vendor,
  alt = "",
  surface = "light",
  size = "1em",
  className,
  ...svgProps
}: {
  vendor: string | null | undefined;
  alt?: string;
  surface?: "light" | "dark" | "auto";
  size?: number | string;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "ref">) {
  const entry = resolveIconEntry(vendor);
  if (!entry) return null;

  const a11yProps = alt
    ? { role: "img" as const, "aria-hidden": false as const, "aria-label": alt }
    : { "aria-hidden": true as const };

  if (surface === "dark") {
    const Comp = entry.dark;
    return (
      <Comp
        size={size}
        className={cn("shrink-0", className)}
        {...a11yProps}
        {...svgProps}
      />
    );
  }

  if (surface === "light" || entry.light === entry.dark) {
    const Comp = entry.light;
    return (
      <Comp
        size={size}
        className={cn("shrink-0", className)}
        {...a11yProps}
        {...svgProps}
      />
    );
  }

  const LightComp = entry.light;
  const DarkComp = entry.dark;
  return (
    <>
      <LightComp
        size={size}
        className={cn("shrink-0 dark:hidden", className)}
        {...a11yProps}
        {...svgProps}
      />
      <DarkComp
        size={size}
        className={cn("hidden shrink-0 dark:inline-block", className)}
        {...a11yProps}
        {...svgProps}
      />
    </>
  );
}

/**
 * ZenMux combined symbol + wordmark from `@zenmux/icons` (`Zenmux.CombineDark` / `Zenmux.CombineLight`).
 *
 * - `surface="light"`: dark ink wordmark (`Zenmux.CombineDark`) for light backgrounds.
 * - `surface="dark"`: white ink wordmark (`Zenmux.CombineLight`) for dark backgrounds.
 * - `surface="auto"`: switches between `CombineDark` and `CombineLight` via Tailwind `dark:`.
 */
export function ZenMuxWordmark({
  surface = "light",
  size = 24,
  alt = "ZenMux",
  className,
  ...svgProps
}: {
  surface?: "light" | "dark" | "auto";
  size?: number | string;
  alt?: string;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "ref">) {
  const a11yProps = alt
    ? { role: "img" as const, "aria-hidden": false as const, "aria-label": alt }
    : { "aria-hidden": true as const };

  if (surface === "dark") {
    return (
      <Zenmux.CombineLight
        size={size}
        className={cn("shrink-0", className)}
        {...a11yProps}
        {...svgProps}
      />
    );
  }

  if (surface === "light") {
    return (
      <Zenmux.CombineDark
        size={size}
        className={cn("shrink-0", className)}
        {...a11yProps}
        {...svgProps}
      />
    );
  }

  return (
    <>
      <Zenmux.CombineDark
        size={size}
        className={cn("shrink-0 dark:hidden", className)}
        {...a11yProps}
        {...svgProps}
      />
      <Zenmux.CombineLight
        size={size}
        className={cn("hidden shrink-0 dark:inline-block", className)}
        {...a11yProps}
        {...svgProps}
      />
    </>
  );
}

/**
 * ZenMux standalone symbol mark from `@zenmux/icons` (`Zenmux.Dark` / `Zenmux.Light`).
 */
export function ZenMuxMark({
  surface = "light",
  size = 24,
  alt = "ZenMux",
  className,
  ...svgProps
}: {
  surface?: "light" | "dark" | "auto";
  size?: number | string;
  alt?: string;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "ref">) {
  const a11yProps = alt
    ? { role: "img" as const, "aria-hidden": false as const, "aria-label": alt }
    : { "aria-hidden": true as const };

  if (surface === "dark") {
    return (
      <Zenmux.Light
        size={size}
        className={cn("shrink-0", className)}
        {...a11yProps}
        {...svgProps}
      />
    );
  }

  if (surface === "light") {
    return (
      <Zenmux.Dark
        size={size}
        className={cn("shrink-0", className)}
        {...a11yProps}
        {...svgProps}
      />
    );
  }

  return (
    <>
      <Zenmux.Dark
        size={size}
        className={cn("shrink-0 dark:hidden", className)}
        {...a11yProps}
        {...svgProps}
      />
      <Zenmux.Light
        size={size}
        className={cn("hidden shrink-0 dark:inline-block", className)}
        {...a11yProps}
        {...svgProps}
      />
    </>
  );
}
