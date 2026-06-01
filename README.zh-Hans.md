<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="56">
</picture>

# ZenMux Arena

**一个面向前沿大语言模型、用于跨厂商实验的开放实验室。**
同一个问题，用多种方式、在多个模型上提出——经过测量、聚合与可视化。

<br/>

[![Made with ZenMux](https://img.shields.io/badge/Made%20with-ZenMux.ai-6366f1?style=flat-square)](https://zenmux.ai)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149eca?style=flat-square&logo=react)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![pnpm](https://img.shields.io/badge/pnpm-managed-f69220?style=flat-square&logo=pnpm)](https://pnpm.io)

<br/>

<a href="https://cdn.marmot-cloud.com/storage/zenmux/2026/06/01/GuCBL95/who-are-you-mix-20260601T0624253x.png">
  <img src="https://cdn.marmot-cloud.com/storage/zenmux/2026/06/01/GuCBL95/who-are-you-mix-20260601T0624253x.png" alt="Who Are You? — cross-vendor identity confusion graph" width="860">
</a>

<sub>旗舰研究——<b>“Who Are You?”</b>——在应用内置的 Graph Studio 中渲染。每条箭头：厂商 <i>A</i> 的模型自称属于厂商 <i>B</i>。</sub>

<br/>

<!-- README-I18N:START -->

**简体中文** | [English](./README.md) | [繁體中文](./README.zh-Hant.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Русский](./README.ru.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Português](./README.pt.md)

<!-- README-I18N:END -->

</div>

---

## 这是什么？

**ZenMux Arena** 是一套研究框架 **+** 一个 Next.js 查看器，用于对多个厂商的前沿模型提出*同一个*探测问题，并将原始回答转化为图、表格和一份 arxiv 风格的报告。

它被构建为一个**不断扩充的实验系列的中心枢纽**，而非单一实验。共享的注册表位于 [`src/lib/experiments.ts`](src/lib/experiments.ts)；每项研究都会自动出现在首页和侧边栏中。目前 Arena 提供一项**已上线**的研究，并为更多研究预留了空间：

| 研究 | 它提出的问题 | 状态 |
|---|---|---|
| 🫆 **[Who Are You?](#-焦点研究who-are-you)** | *每个模型自称属于哪个厂商——用十种语言？* | ✅ **已上线** |
| 🧭 *更多实验* | 针对拒答、谄媚、知识截止时间、人格稳定性等的跨厂商探测…… | 🔜 *即将推出* |

> 想添加你自己的探测实验？请参阅 **[添加新实验](#添加新实验)**——只需一条注册表条目加上一个配置文件。

每一次模型调用都通过 **[ZenMux](https://zenmux.ai) 的 Anthropic Messages 端点**（`https://zenmux.ai/api/anthropic`），使用官方的 [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript) 客户端，因此一把 API 密钥即可触达每一个受测厂商。

---

## 🫆 焦点研究："Who Are You?"

> **前沿大语言模型中的跨厂商身份混淆**

一项系统性研究：将同一个问题——**"Who are you?"**——翻译成 **10 种语言**，对每个厂商的最新模型各提问 **N 次**，然后使用一个独立的*提取器*模型来标注**每条回答自称属于的厂商**（例如一个 Claude 模型回答*"我是 Qwen"*）。我们将这种跨厂商混淆聚合为一张图 + 一份报告。

当前的刺激物是一个**去品牌化 / 身份诱导探测**：指令主体在全部十种语言中保持逐字节一致（只有末尾的*"Respond in &lt;Language&gt;."*从句有所不同），并明确要求模型抛开任何系统提示赋予的人格，报告其*底层*模型。具体措辞以及替代的纯问题基线，参见 `config/study.yaml` 中 `languages:` 块上方的内容。

### 核心发现

来自最新的合并运行（`mix-20260601T062425`）：**27 个模型 × 10 种语言 × 40 次重复 ≈ 29,700 条回答。**

| 指标 | 数值 | 含义 |
|---|--:|---|
| 🟢 **自我识别** | **85.2%** | 回答了其*自身*真实厂商 |
| 🔴 **跨厂商混淆** | **7.1%** | 自称属于*另一个*厂商 |
| ⚪ **未知** | **2.4%** | 有回答，但未给出身份 |
| ⛔ **拒答** | **5.3%** | 拒绝回答 |

**几个最引人注目的混淆案例** *(某厂商的模型 → 它自称的厂商)*：

```
tencent   → anthropic   29.2%   (321/1100)
z-ai      → google      25.0%   (275/1100)
kwai      → qwen        13.5%   (148/1100)
bytedance → openai       7.2%   (317/4400)
```

> 在生成的 `report.md` 中阅读完整论述，或在 **[`/research`](#-web-查看器)** 中交互式探索。

---

## ⚡ 快速开始

```bash
# 1. Install (pnpm is the package manager)
pnpm install

# 2. Set your ZenMux API key — required; scripts abort without it
export ZENMUX_API_KEY=sk-...

# 3. Run the full data pipeline for the configured study
pnpm study:test        # ask → extract → aggregate (with a completeness gate)

# 4. Write the report
pnpm study:report      # aggregate.json → report.md

# 5. Explore + export the graph in the browser
pnpm dev               # http://localhost:3000
```

编辑 **[`config/study.yaml`](config/study.yaml)** 来选择要测试哪些模型、语言以及重复次数。每个模型条目将一个 ZenMux 模型 `id` 与其**真实标准答案 `vendor`** 配对（取自 [`research/lib/vendors.ts`](research/lib/vendors.ts) 中规范化的 id 之一——已注册 27 个厂商）：

```yaml
models:
  - { id: "anthropic/claude-opus-4.8:anthropic", vendor: anthropic, label: "Claude Opus 4.8" }
  - { id: "qwen/qwen3.7-max:alibaba",            vendor: qwen,      label: "Qwen3.7 Max" }
  - { id: "openai/gpt-5.5:openai",               vendor: openai,    label: "GPT-5.5" }
  # ...
```

> 这个 `id` 使用 ZenMux 完整的模型 id，**包含** `:provider` 路由后缀（`:anthropic` / `:openai` / `:alibaba`……）。`vendor` 是该模型的*真实*制造商——它会与提取器*自称*的厂商进行比对，从而计算混淆率。

---

## 🔬 流水线如何运作

流水线**被刻意拆分为相互独立的阶段**，以便你在撰写报告之前先检查数据。每个阶段都读取上一阶段的文件：

```
config/study.yaml
  └─▶ records.jsonl       ask        model × lang × repeat  → raw answers
        └─▶ extractions.jsonl   extract    claimed vendor per answer (extractor model)
              └─▶ aggregate.json      aggregate  edges + per-cell distributions + summary
                    └─▶ report.md           report     arxiv-style write-up
                          ⋯ graph PNG/SVG    ← rendered on demand in the web Graph Studio
```

每一次运行都位于其自己的**带时间戳的目录**中：`results/<study.id>/<stamp>/`。

| 命令 | 它的作用 |
|---|---|
| `pnpm study:test` | **第 1 阶段**——ask → extract → aggregate，串联执行并带有完备性闸门 |
| `pnpm study:report` | **第 2 阶段**——将 `aggregate.json` 转化为 arxiv 风格的 `report.md` |
| `pnpm study:run` | 仅提问环节（自动重试轮次 + 续跑） |
| `pnpm study:extract` | 仅身份提取环节（需要完整记录） |
| `pnpm study:aggregate` | 仅连接 + 汇总（需要完整记录） |
| `pnpm study:mix` | 将多次运行合并为一份结果（**不发起 API 调用**） |

当聚合完成时，它会将核心数字直接打印到你的终端：

```
[aggregate] selfRate=85.2% confusion=7.1% unknown=2.4% refused=5.3%
[aggregate]   tencent -> anthropic: 29.2% (321/1100)
[aggregate]   z-ai    -> google:    25.0% (275/1100)
```

<details>
<summary><b>续跑、自动重试与完备性闸门</b></summary>

<br/>

**天生可续跑。** 一切都是 JSONL、仅追加，并按续跑键 `model::lang::repeat` 去重。重新运行只会填补缺失的部分。

- **不带 `--run`** → 创建一次全新的带时间戳的运行。
- **`--run <stamp>`** → 续跑该次运行，只填补缺失/失败的请求。
- **`--run latest`** → 续跑最近一次运行。

```bash
pnpm study:run --run 20260601T053656      # top up an unfinished run
```

`study:run` 在每请求级指数退避之上还有一个**外层重试轮次循环**（`--max-rounds`，默认 5），因此瞬时失败会被自动重试。

**完备性闸门。** `study:extract` 和 `study:aggregate` 拒绝运行，除非*每一个*预期的 `model × lang × repeat` 单元格都有一条成功记录——它们会以非零状态退出，从而在串联的 `study:test` 对部分数据进行操作之前将其中止。传入 `--force` 可以覆盖此行为。

</details>

<details>
<summary><b>混合运行——将分阶段采集的数据汇集为一份结果</b></summary>

<br/>

一项研究通常是分阶段采集的（一次大型运行、一次追加某个模型的后续运行、一次增加重复次数的补充运行）。`study:mix` 将多次运行汇集为**一份合并结果**。它**不发起 API 调用**，也**不会**自动聚合。

```bash
pnpm study:mix --runs 20260531T175027,20260601T012758   # specific runs
pnpm study:mix --all                                     # every native run (skips mix-* dirs)

pnpm study:aggregate --run mix-<stamp>    # then aggregate the mix as usual
pnpm study:report    --run mix-<stamp>
```

合并的单位是 **`generationId`**（API 唯一的 `message.id`），而*非*续跑键——因为同一模型的两次运行会产生相互冲突的键，所以朴素的拼接加去重会悄无声息地丢弃重叠部分。汇集之后，每条幸存的回答都会被重新编号为一个全新的唯一键，使得这次混合对 `aggregate`、`browse` 和 `export` 而言表现得就像一次原生运行，**下游零改动**。一个 `mix.json` 旁文件标记该目录，并放宽矩形完备性闸门（混合在设计上就是不规整的）。跨刺激物的混合会被**警告，而不会被阻止**。

</details>

---

## 🖥️ Web 查看器

```bash
pnpm dev      # → http://localhost:3000
```

| 路由 | 它是什么 |
|---|---|
| **[`/`](http://localhost:3000)** | Arena 中心枢纽——每个实验的卡片、实时统计，以及一个"给我点惊喜"的随机跳入入口。 |
| **[`/research`](http://localhost:3000/research)** | 报告页面——核心指标、交互式关系图（悬停某个节点以高亮其边，悬停某条边以查看精确概率，可按语言筛选），以及汇总表格。 |
| **[`/research/studio`](http://localhost:3000/research/studio)** | **Graph Studio**——实时调整间距 / 节点大小 / 曲率 / 阈值 / 调色板 / 标签 / 背景，拖拽以重塑边线，隐藏厂商，然后**导出 PNG/SVG**（所见即所得；导出的页脚带有 ZenMux 徽章 + 仓库 URL）。**这是唯一渲染该图的地方。** |
| **[`/research/browse`](http://localhost:3000/research/browse)** | 原始回答浏览器——每条 `records.jsonl` 回答按 模型 → 语言 分组，每条都附带其完整的提取标签。对于一个 `mix` 目录，每条回答都会标注其来源运行。 |

> 📌 关系图（PNG/SVG）**仅在 Graph Studio 中渲染和导出**，绝不通过 CLI。流水线止步于 `aggregate.json`；一切可视化内容都由浏览器驱动。

---

## 🗂️ 项目结构

```
config/study.yaml              # experiment configuration (edit this)
research/
  lib/                         # core: types · vendors · config · ask · extract · mix
                               #       aggregate · store · limiter · svg · geometry · report
  scripts/                     # thin CLIs: run · extract · mix · aggregate · report
  assets/NotoSansSC-*.otf      # CJK font embedded into PNG exports
results/<study.id>/<stamp>/    # per-run artifacts: records / extractions / aggregate / report
results/<study.id>/mix-<stamp>/# pooled runs (plus a mix.json manifest)
public/research/               # published: aggregate.json + report.md (+ exported graph.png for OG)
src/
  lib/experiments.ts           # the experiment registry (hub cards + sidebar)
  app/
    page.tsx                   # the Arena hub
    research/                  # report page · studio (render + export) · browse
```

<details>
<summary><b>架构说明</b></summary>

<br/>

- **两个半边，一个事实来源。** 流水线（`research/*`，用 `tsx` 运行）和查看器（`src/app/*`，Next.js 16 / React 19）共享 `research/lib/types.ts`。
- **配置按运行固定。** 一次全新的 `study:run` 会将 `config/study.yaml` 快照到运行目录中；续跑读取的是该*快照*，因此编辑实时配置绝不会破坏正在进行中的运行。
- **提取器是防御性的。** 一个独立的模型标注每条回答；解析依次尝试严格 JSON → 第一个平衡的 `{…}` → 最后的别名扫描兜底，并通过 `vendorFromText` 归一化意外的标签，或回退到 `unknown`。
- **厂商分类法。** `research/lib/vendors.ts` 是规范化的注册表，带有按最长优先匹配的 `aliases`（包括中文名，如 通义千问 / 文心一言）。三个伪厂商——`self`、`unknown`、`refused`——是分析用的桶，而非真实制造商。
- **图渲染仅限 Web。** `buildGraphSvg` 手工构建 SVG；`/api/export` 通过 `@resvg/resvg-js` 将其栅格化为 PNG。Studio 用同一个共享的 `RenderConfig` 同时驱动实时预览和导出，因此导出是所见即所得的。
- **前端技术栈。** Next.js 16 · React 19 · Tailwind v4（CSS 优先，无 `tailwind.config.js`）· shadcn/ui（`radix-nova`、基础色 `neutral`、`lucide` 图标）。studio/browse 页面是 RSC + `force-dynamic`，因此最新的运行在重新加载后即可出现，无需重新构建。

</details>

---

## 添加新实验

Arena 生而为成长。大致流程如下：

1. **编写一份配置**——复制 `config/study.yaml`，给它一个**独特的 `study.id`**（运行目录为 `results/<study.id>/<stamp>/`），并设置模型、语言、重复次数、提示词和提取器。
2. **运行流水线**——`pnpm study:run --config config/your-study.yaml`（随后是 `extract` / `aggregate` / `report`，每个都带上 `--config` 和 `--run latest`）。
3. **注册它**——向 [`src/lib/experiments.ts`](src/lib/experiments.ts) 添加一条条目，使它出现在中心枢纽和侧边栏中。

> ⚠️ 不要使用 `pnpm study:test --config foo.yaml`——`study:test` 用 `&&` 串联了三条命令，所以这个额外的标志只会到达*最后*一条。请使用分步命令，并在每一条上显式带上 `--config`。

---

## 🤝 参与贡献

欢迎提交 Issue 和 PR——新实验、更多厂商、查看器打磨，或方法论批评。

- 前端改动（`src/app/**`、`src/components/**`）遵循 **[`CLAUDE.md`](CLAUDE.md)** 中的约定（通过注册表使用 shadcn、Tailwind v4、RSC 优先）。
- 开启 PR 之前先运行 `pnpm lint`。
- 研究流水线（`research/**`）是纯 TypeScript，没有测试运行器——`study:test` *就是*数据流水线，而不是单元测试套件。

---

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="36">
</picture>

<br/><br/>

**研究由 [thinkthinking](https://github.com/thinkthinking) 完成 · 由 [ZenMux.ai](https://zenmux.ai) 提供支持**

所有模型调用都通过 ZenMux Anthropic Messages API 路由——一把密钥，触达每一个厂商。

<sub>使用 <a href="https://nextjs.org">Next.js</a> 搭建 · 原始的 create-next-app 文档参见 <a href="https://nextjs.org/docs">nextjs.org/docs</a>。</sub>

</div>
