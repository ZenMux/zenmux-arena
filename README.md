# Who Are You? — Cross-Vendor Identity Confusion in Frontier LLMs

一项系统研究：把同一个问题「**你是谁？**」翻译成 10 种语言，分别问多家厂商的最新模型各 30 次，
再用提取器模型（config 里的 `extractor.model`，当前为 `gpt-5.5:openai`）提取每条回答里**自称的身份**
（例如 Claude Opus 自称是"通义千问"），统计「A 厂模型 → 自称 B 厂」的概率，
最终产出一篇 arxiv 风格报告 + 一张环形关系图。

> 当前刺激为**裸问题「你是谁？」**（自发自述基线形态）——只问开放式身份，不追加"请说出模型名和公司"。
> 改用更强的"probed"形态请见 `config/study.yaml` 里 `languages:` 上方的说明。

所有模型调用走 **ZenMux 的 Anthropic Messages 协议**（`https://zenmux.ai/api/anthropic`）。

> 以上研究由 **thinkthinking** | **ZenMux.ai** 测试

---

## 1. 准备

```bash
# 安装依赖（已装可跳过）
pnpm install

# 设置 ZenMux API Key（必需）
export ZENMUX_API_KEY=sk-...
```

编辑 **`config/study.yaml`**，在 `models` 列表里填入要测试的真实 ZenMux 模型 id 及其归属厂商，例如：

```yaml
models:
  - { id: "anthropic/claude-opus-4.8:anthropic", vendor: anthropic, label: "Claude Opus 4.8" }
  - { id: "qwen/qwen3.7-max:alibaba",            vendor: qwen,      label: "Qwen3.7 Max" }
  - { id: "openai/gpt-5.5:openai",               vendor: openai,    label: "GPT-5.5" }
  # ...
```

> `id` 用 ZenMux 的完整模型 id，含 `:provider` 路由后缀（如 `:anthropic` / `:openai` / `:alibaba`）。
> `vendor` 是该模型的**真实归属厂商**（用于和提取器判定的"自称厂商"对比，算混淆率），二者各司其职。

`vendor` 必须是 `research/lib/vendors.ts` 里的规范厂商 **id**（注意 id 与显示名不同，校验认的是 id）：
anthropic / openai / google / deepseek / qwen / baidu / bytedance / moonshot / z-ai / stepfun /
x-ai / minimax / kwai / xiaomi / tencent / inclusionai / meta / mistral / agnes。
语言、重复次数（`repeats`）、提取器模型（`extractor.model`）也都在 `config/study.yaml` 里配置。

---

## 2. 工作流（测试 → 报告，彼此独立；关系图在网页里导出）

设计上刻意分开，方便你**先看测试数据，确认无误后再写报告**。
关系图不再用命令行渲染——改为在网页 **Graph Studio** 里实时预览并手动导出 PNG/SVG（见第 4 节）。

### 阶段一 · 测试（问答 + 提取 + 聚合）

```bash
pnpm study:test
```

依次执行：问答 → 身份提取 → 聚合。每次运行有独立的**时间戳目录**，产物在
`results/<study.id>/<时间戳>/`（如 `results/who-are-you/20260529T045756/`）：

| 文件 | 内容 |
|---|---|
| `records.jsonl` | 每条原始回答，含 `generationId`、时间戳、token 用量、完整文本 |
| `extractions.jsonl` | 每条回答的身份提取标注（自称哪家厂商） |
| `aggregate.json` | 聚合后的边/概率/汇总指标 |

聚合阶段会在终端打印**头条数字**（总体自识别率、混淆率、Top 混淆边），你可以直接看：

```
[aggregate] selfRate=56.1% confusion=38.3% unknown=5.6% refused=0.0%
[aggregate]   anthropic -> qwen: 20.0% (6/30)
[aggregate]   stepfun -> openai: 50.0% (15/30)
```

也可以单独跑某一步：`pnpm study:run` / `pnpm study:extract` / `pnpm study:aggregate`。

#### 断点续跑 & 自动补全

- **不带 `--run`**：每次新建一个时间戳目录，从头跑。
- **`--run <时间戳>`**：续跑指定目录，**只补缺失/失败的请求**，不重跑已成功的。
- **`--run latest`**：续跑该 study 最近一次的目录。

```bash
# 续跑某次未完成的 run，自动补齐
pnpm study:run --run 20260529T045756
```

`study:run` 内置**自动重试轮次**：主跑完后若还有缺失/失败的 key，会自动再跑几轮直到补齐
（默认最多 5 轮，可用 `--max-rounds 8` 调整）。每个请求本身也有指数退避重试（`maxRetries`）。

#### 完整性门禁（重要）

`study:extract` 和 `study:aggregate` 在执行前会**强制检查 `records.jsonl` 是否完整**
（每个 模型×语言×repeat 都有成功记录）。**只要还有缺失或失败的请求，就拒绝提取/聚合并退出**，
并提示你先把 run 跑完：

```
[extract] ✗ ABORT: records.jsonl is incomplete; refusing to extract on partial data.
[extract]   incomplete sample: stepfun/step-3.7-flash::ko::0, ...
[extract]   finish the run first:  pnpm study:run --run 20260529T045756
```

确实想在不完整数据上强跑，可加 `--force`。

#### 合并多次测试（mix）

测试常常分阶段攒：先跑一次 26 个模型的大 run，过几天补一个新模型，再加跑几次提高 `repeats`。
`study:mix` 把这些 run **汇总成一个最终结果**，让你一次看全。它**不调用任何 API**、也**不自动聚合**——
合并完你再手动 `study:aggregate --run mix-<时间戳>`（和管线其余部分一样刻意分步）。

```bash
# 指定要合并的 run（逗号分隔的时间戳）
pnpm study:mix --runs 20260531T175027,20260601T012758
# 或合并该 study 下所有「原生」run（自动跳过已有的 mix-* 目录）
pnpm study:mix --all
```

产物是一个新的 **`results/<study.id>/mix-<时间戳>/`** 目录（时间戳命名、绝不覆盖），里面照常有
`records.jsonl` / `extractions.jsonl` / `study.yaml`，外加一个 **`mix.json`** 清单（记录来源 run、
各自贡献的样本数、以及方法论警告）。之后按常规聚合即可：

```bash
pnpm study:aggregate --run mix-<时间戳>     # mix.json 让聚合自动放宽「矩形完整性门禁」
pnpm study:report    --run mix-<时间戳>
```

几个关键点：

- **合并的单位是 `generationId`（每次 API 调用的 `message.id`），不是续跑 key。** 续跑 key
  `模型::语言::repeat` 刻意不编码 run/prompt，所以同一模型的两次 run 会产生**撞 key**——直接按 key 去重
  会**静默丢掉重叠的样本**。mix 改按 `generationId` 池化回答、按 `sourceGenerationId` 池化提取并对齐，
  然后**按 (模型,语言) 重新编号 `repeat`**，使合并目录的 key 重新全局唯一——所以聚合 / 网页 / 导出都无需改动
  即可识别它。每条记录都保留原始 key + 来源 run（写在 `mixSource` 里）供溯源。
- **跨刺激合并只警告、不拦截。** 若被合并的 run 在同一语言用了不同的 prompt（如裸「你是谁？」对上 probed 形态），
  mix 会逐语言打印警告并把所有变体记进 `mix.json`，但仍继续——是否跨刺激家族池化是你的方法论选择。
- 合并目录会被网页 **studio / browse 自动发现**；browse 里每条回答还会标出它来自哪次源 run。

### 阶段二 · 撰写报告

```bash
pnpm study:report            # 默认最近一次 run
```

产物：`results/<study.id>/<时间戳>/report.md`（同时复制到 `public/research/report.md`）。
arxiv 风格：摘要、方法论、三线表（各模型/各语言自识别率、混淆矩阵、Top 混淆边）、内嵌关系图、
可粘贴论文的 LaTeX booktabs 块、讨论与结论。

> 关系图（PNG/SVG）请到网页 **Graph Studio** 里调参后手动导出（第 4 节），不再有命令行渲染步骤。

---

## 3. 常用命令速查

| 命令 | 作用 |
|---|---|
| `pnpm study:test` | 阶段一：问答 + 提取 + 聚合（带完整性门禁） |
| `pnpm study:report` | 阶段二：生成 arxiv 风格报告 |
| `pnpm study:run` | 仅问答（自动补全 + 重试轮次） |
| `pnpm study:extract` | 仅身份提取（需 records 完整） |
| `pnpm study:mix` | 把多次 run 池化成一个合并结果（不调 API、不自动聚合） |
| `pnpm study:aggregate` | 仅聚合（需 records 完整；mix 目录自动放宽门禁） |

通用参数：
- `--config <path>`：配置文件（默认 `config/study.yaml`）
- `--run <时间戳>`：指定 run 目录续跑；`--run latest` 用最近一次。`study:run` 不带则新建。
- `study:run` 专属：`--model-concurrency <n>`、`--batch-size <n>`、`--max-rounds <n>`
- `study:extract` / `study:aggregate`：`--force` 跳过完整性门禁
- `study:mix` 专属：`--runs <时间戳,时间戳,…>`（要合并的源 run）**或** `--all`（合并全部原生 run，跳过 `mix-*`）

> 注意：`study:test` 会**新建**一次 run 并依次跑完三步；若问答未跑完（超过 max-rounds 仍有失败），
> 链条会在门禁处停下，不会在残缺数据上提取/聚合。

### 多 config 文件（重要）

`--config` **只在新建 run 时生效**：`study:run` 不带 `--run` 时会把该 config 快照进 run 目录，此后该 run 的
config 就被钉死；续跑（`--run`）时读的是快照，传 `--config` 仅用于（靠 `study.id`）定位 run 目录，不会改配置。

> ⚠️ **不要用 `pnpm study:test --config foo.yaml`**。`study:test` 是 `run && extract && aggregate` 三条
> 命令用 `&&` 串起来的，npm/pnpm 把额外参数拼到**整条链末尾**，于是 `--config foo.yaml` 只落到最后的
> `aggregate` 上，前面的 `run`/`extract` 仍用默认 `config/study.yaml` —— 你指定的 config 被**静默忽略**。

多 config 时改走分步命令，每条都显式带 `--config`：

```bash
export ZENMUX_API_KEY=sk-...
pnpm study:run       --config config/who-are-you-bare.yaml             # 建新 run + 拍该 config 的快照
pnpm study:extract   --config config/who-are-you-bare.yaml --run latest
pnpm study:aggregate --config config/who-are-you-bare.yaml --run latest
pnpm study:report    --config config/who-are-you-bare.yaml --run latest
```

> 建议给不同实验设**不同的 `study.id`**（run 目录是 `results/<study.id>/<时间戳>/`）。若多份 config 共用同一个
> `study.id`，它们会挤在同一目录下，`--run latest` 会跨配置串味。

---

## 4. 在线交互页

```bash
pnpm dev
```

三个页面（均读取 `results/<study.id>/<时间戳>/` 下的数据；`/research` 读 `public/research/aggregate.json`）：

- **[/research](http://localhost:3000/research)** — 报告页：头条指标、交互式关系图（节点 hover 高亮关联边、边 hover 显示精确概率、可按语言筛选）、汇总表格。
- **[/research/studio](http://localhost:3000/research/studio)** — Graph Studio：实时调参（间距/节点大小/曲率/阈值/配色/标签模式/背景），拖动改边形状，隐藏厂商，然后**导出 PNG/SVG**（所见即所得，导出图脚注自带 ZenMux 标识 + 源码地址）。**关系图就在这里出图**。
- **[/research/browse](http://localhost:3000/research/browse)** — 原始回答浏览：按模型 slug 浏览每条 `records.jsonl` 回答，按语言分组，每条回答下方展示 `extractions.jsonl` 里的提取结果（自称厂商、自称文本、置信度、理由；无对应结果时显示「无」）。浏览 **mix 合并目录**时，每条回答还会标出它来自哪次源 run（`mixSource` 溯源）。

---

## 5. 目录结构

```
config/study.yaml          # 实验配置（编辑这里）
research/
  lib/                     # 核心库：types/vendors/config/args/prompts/client/limiter/store/ask/extract/mix/aggregate/svg/geometry/report/branding
  scripts/                 # run / extract / mix / aggregate / report
  assets/NotoSansSC-*.otf  # resvg 导出 PNG 内中文用的字体
results/<study.id>/<时间戳>/    # 每次测试的产物（records/extractions/aggregate/report）
results/<study.id>/mix-<时间戳>/ # study:mix 合并多次 run 的产物（多一个 mix.json 清单）
public/research/           # 发布物：aggregate.json + report.md（+ 网页导出的 graph.png 作 OG 图）
src/app/research/          # Next.js 交互页：报告页 / studio（出图+导出）/ browse（原始回答浏览）
```

---

本研究基础脚手架基于 Next.js。原始 create-next-app 文档见 [nextjs.org/docs](https://nextjs.org/docs)。
