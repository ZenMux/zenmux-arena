<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="56">
</picture>

# ZenMux Arena

**一部前沿模型的田野图鉴。**
跨厂商实验、实时定价数据、公开的补贴账本——经过测量、聚合与可视化。

<br/>

[![Live](https://img.shields.io/badge/Live-arena.zenmux.ai-16a34a?style=flat-square)](https://arena.zenmux.ai)
[![Made with ZenMux](https://img.shields.io/badge/Made%20with-ZenMux.ai-6366f1?style=flat-square)](https://zenmux.ai)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149eca?style=flat-square&logo=react)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![pnpm](https://img.shields.io/badge/pnpm-managed-f69220?style=flat-square&logo=pnpm)](https://pnpm.io)

<br/>

<a href="https://arena.zenmux.ai">
  <img src=".github/assets/hub-home.jpg" alt="ZenMux Arena 首页——以田野图鉴的标本索引方式呈现每一个前沿模型" width="860">
</a>

<sub>Arena 首页，即 <a href="https://arena.zenmux.ai"><b>arena.zenmux.ai</b></a>——每个模型都是一件标本，每项研究只需一次点击。</sub>

<br/>

<!-- README-I18N:START -->

[English](./README.md) | **简体中文**

<!-- README-I18N:END -->

</div>

---

## 这是什么？

**ZenMux Arena** 是一套研究框架 **+** 一个 Next.js 查看器，既用于对各厂商前沿模型开展跨厂商实验，也用于把 **ZenMux 自身的真实线上流量**转化为公开、可核验的数据。目前它上线了**三项常驻研究**——全部由通过 [ZenMux](https://zenmux.ai) 的真实 API 流量驱动——外加一个计算器工具：

| 研究 | 它提出的问题 | 状态 |
|---|---|---|
| 🫆 **[Who Are You?](#-who-are-you)** | *每个模型自称属于哪个厂商——用十种语言？* | ✅ 已上线 |
| 🧮 **[Token Economics](#-token-economics)**（代币经济学） | *在 ZenMux 提供的每一个模型中，价格与需求的价值前沿到底落在哪里？* | ✅ 已上线 |
| 🧾 **[Token Deals](#-token-deals)**（让利账本） | *ZenMux 实时为你的 token 账单补贴了多少，具体到每个模型？* | ✅ 已上线 |

共享注册表位于 [`src/lib/experiments.ts`](src/lib/experiments.ts)；每项研究都会自动出现在[首页](https://arena.zenmux.ai)与各自的侧边栏中。想添加自己的探测实验？参见 **[添加新实验](#添加新实验)**。

<p align="center">
  <a href="https://arena.zenmux.ai">
    <img src=".github/assets/hub-experiments.jpg" alt="Arena 的实验索引——Who Are You?、Token Economics、Token Deals" width="820">
  </a>
</p>

---

## 🫆 Who Are You?

> **前沿大语言模型的跨厂商身份混淆研究** — [`/who-are-you/studio`](https://arena.zenmux.ai/who-are-you/studio)

一项系统性研究：把同一个问题——**“你是谁？”**——翻译成**10 种语言**，向每个厂商最新的模型各提问 **N 次**，再用一个独立的*抽取*模型标注**每个回答自称属于哪个厂商**（例如某个 Claude 模型回答“我是 Qwen”）。我们将这些跨厂商混淆聚合成一张可交互的关系图。

这是一个**去品牌化 / 身份诱导**探测：指令主体在十种语言中逐字节保持一致（只有结尾的“请用某语言回答”这一句不同），并明确要求模型抛开任何系统提示中设定的人格，报告其*底层*模型身份。具体措辞见 `config/study.yaml`。

### 核心发现

来自最新一次合并运行：**27 个模型 × 10 种语言 × 40 次重复 ≈ 29,700 条回答。**

| 指标 | 数值 | 含义 |
|---|--:|---|
| 🟢 **自我认同** | **85.2%** | 回答了自己*真实*所属的厂商 |
| 🔴 **跨厂商混淆** | **7.1%** | 声称属于*另一个*厂商 |
| ⚪ **未知** | **2.4%** | 有回答，但未给出明确身份 |
| ⛔ **拒答** | **5.3%** | 拒绝回答 |

**一些最典型的混淆案例**（模型所属厂商 → 它声称的厂商）：

```
tencent   → anthropic   29.2%   (321/1100)
z-ai      → google      25.0%   (275/1100)
kwai      → qwen        13.5%   (148/1100)
bytedance → openai       7.2%   (317/4400)
```

<p align="center">
  <a href="https://arena.zenmux.ai/who-are-you/studio">
    <img src=".github/assets/who-are-you-studio.jpg" alt="Graph Studio——跨厂商身份混淆关系图的可交互工作台" width="820">
  </a>
</p>

**Graph Studio**（[`/who-are-you/studio`](https://arena.zenmux.ai/who-are-you/studio)）是关系图真正的家：悬停节点可高亮其所有边，可按语言或厂商筛选，可拖拽边来重新塑形，最终导出所见即所得的 PNG/SVG。**[`/who-are-you/data`](https://arena.zenmux.ai/who-are-you/data)** 是表格式数据浏览器（各厂商比率、按模型 × 语言的明细），**[`/who-are-you/browse`](https://arena.zenmux.ai/who-are-you/browse)** 则可以逐条阅读每一条原始回答及其抽取标签。

<details>
<summary><b>自己跑一遍这套流程</b></summary>

<br/>

```bash
export ZENMUX_API_KEY=sk-...   # 必需——脚本没有它会直接中止

pnpm study:test        # ask → extract → aggregate（链式执行，带完整性校验）
pnpm study:report       # aggregate.json → report.md
pnpm dev                # 在 /who-are-you/studio 中探索并导出关系图
```

编辑 **[`config/study.yaml`](config/study.yaml)** 来选择要测试的模型、语言与重复次数。每个模型条目都把一个 ZenMux 模型 `id` 与它的**真实厂商 `vendor`**配对（取值来自 [`research/lib/vendors.ts`](research/lib/vendors.ts) 中的规范 id——已注册 67 个厂商）：

```yaml
models:
  - { id: "anthropic/claude-opus-4.8:anthropic", vendor: anthropic, label: "Claude Opus 4.8" }
  - { id: "qwen/qwen3.7-max:alibaba",            vendor: qwen,      label: "Qwen3.7 Max" }
  - { id: "openai/gpt-5.5:openai",               vendor: openai,    label: "GPT-5.5" }
  # ...
```

**流程被有意拆分为几个独立阶段**，每个阶段都读取上一阶段产出的文件：

```
config/study.yaml
  └─▶ records.jsonl       ask        model × lang × repeat  → 原始回答
        └─▶ extractions.jsonl   extract    每条回答的抽取厂商标签（抽取模型）
              └─▶ aggregate.json      aggregate  边 + 每格分布 + 汇总
                    └─▶ report.md           report     arxiv 风格报告
                          ⋯ graph PNG/SVG    ← 按需在 Graph Studio 中渲染
```

每次运行都独占一个带时间戳的目录：`results/<study.id>/<stamp>/`。

| 命令 | 作用 |
|---|---|
| `pnpm study:run` | 仅执行提问阶段（自动重试轮次 + 断点续跑） |
| `pnpm study:extract` | 仅执行身份抽取阶段（需要记录完整） |
| `pnpm study:aggregate` | 仅执行合并与汇总（需要记录完整） |
| `pnpm study:mix` | 把多次运行合并为一份结果（**不发起任何 API 调用**） |

**天生可续跑。** 一切都是 JSONL、只追加写入、按续跑键 `model::lang::repeat` 去重。不带 `--run` 会创建一个全新的带时间戳的运行；`--run <stamp>`（或 `--run latest`）则续跑，只补齐缺失部分。`study:extract`/`study:aggregate` 在数据不完整时会拒绝执行（可用 `--force` 跳过）。

**合并分批采集的运行。** 一项研究通常是分批采集的——一次大批量运行、一次补充某个模型的追加运行、一次补齐重复次数的运行。`pnpm study:mix --runs <a,b>`（或 `--all`）会按 `generationId`（API 返回的全局唯一消息 id，而非续跑键——因为同一模型的两次运行会在续跑键上撞车）把它们合并成一份结果，再重新编号，让合并结果在下游各环节表现得如同一次原生运行。

</details>

---

## 🧮 Token Economics（代币经济学）

> **每一个模型，都被称重、定价。** — [`/token-economics`](https://arena.zenmux.ai/token-economics)

**ZenMux** 提供的每一个文本模型，都被实时抓取并在两个维度上打分：**它值多少钱**与**它实际被用了多少**。价格直接来自实时模型列表；用量则是观测到的真实 token 消耗，而不是营销宣称的数字。这项研究提出的问题是：计算量——以及金钱——究竟流向了哪里？

核心定价指标是一个**标准化的请求篮子**：**10 万输入 token + 1000 输出 token**（近似一次长上下文、短回答的调用——检索增强生成、摘要、分类等场景）。它把每个模型的双轴定价（输入 $/百万、输出 $/百万）压缩成一个可比较的 `blendedCost`，用于统一排名。

<p align="center">
  <a href="https://arena.zenmux.ai/token-economics">
    <img src=".github/assets/token-economics-live.jpg" alt="Token Economics——以 DeepSeek 为锚点重新定价的东方旗舰模型实时用量曲线" width="820">
  </a>
</p>

**Live 视图**追踪的是更尖锐的问题——**“DeepSeek 归零线”挑战**：如果把每一个东方旗舰模型的定价重设为 DeepSeek V4 Pro/Flash 的篮子价，再对照这个锚点追踪它的实时 token 用量，会发生什么？每个模型都会生成一条**价格重设账目（Price Reset Ledger）**记录：它当前的真实标价，与它若要对齐 DeepSeek 篮子价所需的价格并列展示，并附一个直达 ZenMux 实际体验入口的链接。

<p align="center">
  <a href="https://arena.zenmux.ai/token-economics?view=value">
    <img src=".github/assets/token-economics-value-map.jpg" alt="价值地图——价格与日需求的散点图，每个模型一个点，按中位数分为四个象限" width="820">
  </a>
</p>

**价值地图（Value Map）**把每个模型画成一个点：**X 轴 = 篮子成本（对数）**，**Y 轴 = 上线后日均 token 中位数（对数）**，点的大小 = 每美元可换 token 数，颜色 = 厂商。虚线的中位数十字把整片散点分成四个象限——*性价比之选*（便宜且被用）、*高端刚需*（贵但被用），以及另外两个被忽视的角落。其他视图：

| 路由/标签 | 内容 |
|---|---|
| **Leaderboard**（排行榜） | 按上线后日均每美元 token 数排名（而非全生命周期用量——后者天然偏向上线更早的模型） |
| **Value Ladder**（价值阶梯） | 按每美元性价比从低到高的条形排名 |
| **Consumption**（消费量） | 原始 token 用量，可在“日均”与“全时段”之间切换 |
| **[`/tools/discount-to-deepseek`](https://arena.zenmux.ai/tools/discount-to-deepseek)** | “归零线”背后的计算器：自定义输入/输出篮子比例，把任意模型的价格换算成对齐 DeepSeek V4 Pro 或 Flash 后的价格 |

<details>
<summary><b>自己跑一遍 / 架构说明</b></summary>

<br/>

线上页面是实时拉取数据的：模型列表（含全时段 `all_tokens`）是一次廉价、无需鉴权的请求，每次页面加载都会重新拉取；14 个工作日的上线窗口用量序列来自约 130 次带鉴权、限流的 `model_usage` 调用，缓存 24 小时，由每日一次的 Vercel Cron 预热。

```bash
pnpm tokenecon              # 本地运行 + 审计快照（写入 results/，已不是线上数据源）
pnpm tokenecon:precompute   # 在本地预计算 live 缓存
```

**日均上线指标**的定义：对每个模型，累加 `publishTime` 之后（含当天）前 14 个工作日（周一至周五）的每日 token 序列，除以已经过的工作日数（用量为零的一天也计入分母——低需求本身就是有效信号）。`LAUNCH_WINDOW_WORKING_DAYS = 14` 定义在 `research/token-economics/types.ts`；用量拉取逻辑在 `research/token-economics/usage.ts`。

</details>

---

## 🧾 Token Deals（让利账本）

> **让利账本——实时的补贴收据。** — [`/token-deals`](https://arena.zenmux.ai/token-deals)

ZenMux 正在为一批旗舰模型的 token 账单支付部分费用——这是它的公开账本。每笔优惠都展示**原价 → 折后价**，看板实时累计**为开发者省下的钱**，数字直接来自生成真实账单的同一套计费数据。

<p align="center">
  <a href="https://arena.zenmux.ai/token-deals">
    <img src=".github/assets/token-deals-board.jpg" alt="Token Deals——实时看板：为开发者省下的总额、平均折扣、优惠期内的 token 量" width="820">
  </a>
</p>

**看板（Board）**（[`/token-deals`](https://arena.zenmux.ai/token-deals)）是记分牌：为开发者省下的总额（付费优惠 + 免费层优惠，回溯至 ZenMux 2025-09-29 上线当天）、平均折扣深度、优惠期内提供的 token 量，以及优惠窗口内的开发者实际支出——并带有 全部 / 30 天 / 7 天 / 自定义区间 的日期筛选器，在客户端即时重新切片，不产生任何新请求。

<p align="center">
  <a href="https://arena.zenmux.ai/token-deals/ladder">
    <img src=".github/assets/token-deals-ladder.jpg" alt="折扣阶梯——按节省金额排名的所有优惠，附带累计趋势迷你曲线" width="820">
  </a>
</p>

**阶梯（Ladder）**（[`/token-deals/ladder`](https://arena.zenmux.ai/token-deals/ladder)）把所有优惠——无论是付费折扣还是免费层发布——按节省金额、流转 token 量或折扣深度排名，条形图便于一眼比较，累计节省的迷你曲线便于看趋势。点击任意一行即可跳转到该模型在 ZenMux 上的页面（带 UTM 归因标记）。

<details>
<summary><b>账本如何构建 / 架构说明</b></summary>

<br/>

**配置文件驱动。** [`config/token-deals.json`](config/token-deals.json)（由 `research/token-deals/deals-config.ts` 读写）是所有优惠事实的唯一来源——线上页面在运行时**零**数据库查询，只读取这份配置和公开的定价 API。`pnpm tokendeals:sync` 会把从计费数据库中新发现的信息增量合并进配置（打印 diff 供人工确认），且绝不覆盖任何被手动编辑过的字段。

**合并保护规则。** 一条优惠的键是 `slug@startDate`。一旦它的 `endDate` 已经过去，整条记录就被冻结；一条进行中的记录只会*填补*空缺的 `endDate`（或在优惠实际提前结束时把日期往前拉）——绝不会往后推。任何记录都不会被删除。

**全量历史回填。** `pnpm tokendeals:backfill` 以自适应的时间分块，逐日回溯账本直到 2025-09-29（ZenMux 上线日），若中断可从断点继续。

```bash
pnpm tokendeals:sync        # 把计费数据库中的新优惠事实合并进 config/token-deals.json
pnpm tokendeals:backfill     # （重新）构建完整的逐日账本
pnpm tokendeals:precompute   # 在本地预计算 live 缓存
```

**无服务器环境下的安全读取。** 线上接口会立即返回一份可能过期的基线数据（首字节响应在毫秒级），同时在后台竞速发起一次单飞的数据库刷新——冷启动路径永远不会退化成一次全量历史查询。

</details>

---

## 🛠️ 工具

与三项研究并列的一些独立小计算器，注册在 [`src/lib/tools.ts`](src/lib/tools.ts)：

| 工具 | 作用 |
|---|---|
| **[Discount to DeepSeek](https://arena.zenmux.ai/tools/discount-to-deepseek)** | 自定义输入/输出篮子比例，把任意模型的价格与 DeepSeek V4 Pro 或 Flash 对齐换算，并导出折算后的输入/输出价格 |

---

## ⚡ 快速开始（本地跑流程）

```bash
# 1. 安装依赖（包管理器为 pnpm）
pnpm install

# 2. 配置所需的密钥——完整列表见 .env.example
cp .env.example .env.local
export ZENMUX_API_KEY=sk-...        # Who Are You? 流程必需

# 3. 运行完整的 "Who Are You?" 流程
pnpm study:test        # ask → extract → aggregate（带完整性校验）
pnpm study:report      # aggregate.json → report.md

# 4. 在浏览器中查看一切
pnpm dev               # http://localhost:3000
```

Token Economics 与 Token Deals 在生产环境中于请求时读取**实时**数据（见上文各自小节）——本地开发时，`pnpm tokenecon` / `pnpm tokendeals:sync` + `pnpm tokendeals:backfill` 会填充这些页面读取的缓存。完整的凭据列表（计费数据库、管理密钥）见 `.env.example`。

---

## 🗂️ 项目结构

```
config/
  study.yaml                   # Who Are You? 实验配置
  token-deals.json              # Token Deals 账本——优惠事实的唯一来源
research/
  lib/                         # Who Are You? 核心：types · vendors · config · ask · extract · mix
                               #   · aggregate · store · limiter · svg · geometry · report
  token-economics/             # scrape · compute · usage · live-query
  token-deals/                 # deals-config · discovery · sync · db · query
  scripts/                     # 覆盖在 research/lib · research/token-economics · research/token-deals 之上的轻量 CLI
  assets/NotoSansSC-*.otf       # 内嵌进 PNG 导出结果的中文字体
results/<study.id>/<stamp>/    # Who Are You? 每次运行的产物
public/research/               # 发布的 aggregate.json + report.md（Who Are You?）
src/
  lib/experiments.ts           # 实验注册表（首页卡片 + 侧边栏）
  lib/tools.ts                 # 工具注册表
  app/
    page.tsx                   # Arena 首页
    who-are-you/               # studio（渲染 + 导出）· 数据浏览器 · 原始回答浏览
    token-economics/           # live · 排行榜 · 价值地图 · 阶梯 · 消费量
    token-deals/               # 看板 · 阶梯 · 关于
    tools/                     # discount-to-deepseek
```

<details>
<summary><b>架构说明</b></summary>

<br/>

- **两个半区，共享一套事实来源。** 流水线部分（`research/*`，用 `tsx` 运行）与查看器部分（`src/app/*`，Next.js 16 / React 19）共享类型化契约——Who Are You? 用 `research/lib/types.ts`，另外两项研究分别用 `research/token-economics/types.ts` 与 `research/token-deals/types.ts`。
- **配置按运行冻结**（仅 Who Are You?）。一次全新的 `study:run` 会把 `config/study.yaml` 快照进运行目录；续跑读取的是*快照*，因此编辑线上配置永远不会污染一次正在进行的运行。
- **抽取模型的解析是防御性的。** 一个独立的模型为每条身份回答打标签；解析顺序是严格 JSON → 第一个配对的 `{…}` → 兜底的别名扫描，未识别的标签会通过 `vendorFromText` 归一化，否则退化为 `unknown`。
- **厂商分类体系。** `research/lib/vendors.ts` 是规范注册表——67 个厂商，别名（含中文名如通义千问 / 文心一言）按最长匹配优先。`self`、`unknown`、`refused` 是分析用的伪厂商，并非真实厂商。
- **关系图只在网页端渲染。** `buildGraphSvg` 手写构建 Who Are You? 的 SVG；`/api/export` 通过 `@resvg/resvg-js` 把它栅格化为 PNG。Graph Studio 用同一份 `RenderConfig` 同时驱动实时预览和导出，因此导出结果所见即所得。
- **实时数据，实时风险。** Token Economics 与 Token Deals 在请求时读取生产计费数据库——两者都采用“陈旧数据先返回、后台单飞刷新”的缓存策略，确保无服务器冷启动永远不会卡在一次全量历史查询上。
- **前端技术栈。** Next.js 16 · React 19 · Tailwind v4（CSS-first，没有 `tailwind.config.js`）· shadcn/ui（风格 `radix-nova`，基础色 `neutral`，图标用 `lucide`）。多数页面是 RSC + `force-dynamic`，因此新数据刷新页面即可看到，无需重新构建。

</details>

---

## 添加新实验

Arena 就是为持续扩充而设计的。大致步骤：

1. **准备数据源**——为 Who-Are-You 式的探测实验写一个 `config/*.yaml`，或为实时数据类研究新建一个 `research/<your-study>/` 模块。
2. **搭建路由**——在 `src/app/<your-study>/` 下建一个页面。
3. **注册它**——在 [`src/lib/experiments.ts`](src/lib/experiments.ts) 中添加一条条目，它就会自动出现在首页上。

> ⚠️ 对于探测式研究：不要用 `pnpm study:test --config foo.yaml`——`study:test` 用 `&&` 链式串联了三个命令，多出的这个参数只会传给*最后一个*命令。请分步执行，在每一步都显式带上 `--config`。

---

## 🤝 参与贡献

欢迎提交 Issue 与 PR——新的实验、更多厂商、查看器的打磨，或是对研究方法的批评意见。

- 前端改动（`src/app/**`、`src/components/**`）请遵循 **[`CLAUDE.md`](CLAUDE.md)** / **[`AGENTS.md`](AGENTS.md)** 中的约定（通过注册表使用 shadcn、Tailwind v4、RSC-first）。
- 提交 PR 前请先运行 `pnpm lint`。
- 各研究的流水线（`research/**`）是没有测试框架的纯 TypeScript——流水线脚本本身就是正确性的校验。

---

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="36">
</picture>

<br/><br/>

**研究作者 [thinkthinking](https://thinkthinking.ai) · 技术支持 [ZenMux.ai](https://zenmux.ai)**

线上地址 **[arena.zenmux.ai](https://arena.zenmux.ai)** · 所有模型调用均通过 ZenMux 的 Anthropic Messages API 路由——一把密钥，触达每个厂商。

<sub>项目脚手架来自 <a href="https://nextjs.org">Next.js</a>；原始 create-next-app 文档见 <a href="https://nextjs.org/docs">nextjs.org/docs</a>。</sub>

</div>
