# Who Are You? — Cross-Vendor Identity Confusion in Frontier LLMs

一项系统研究：把同一个问题「**我是谁？**」翻译成 10 种语言，分别问多家厂商的最新模型各 10 次，
再用 `deepseek/deepseek-v4-pro` 提取每条回答里**自称的身份**（例如 Claude Opus 自称是"通义千问"），
统计「A 厂模型 → 自称 B 厂」的概率，最终产出一篇 arxiv 风格报告 + 一张环形关系图。

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
  - { id: "anthropic/claude-opus-4.8", vendor: anthropic, label: "Claude Opus 4.8" }
  - { id: "qwen/qwen3.7-max",          vendor: qwen,      label: "Qwen3.7 Max" }
  - { id: "openai/gpt-5.5",            vendor: openai,    label: "GPT-5.5" }
  # ...
```

`vendor` 必须是 `research/lib/vendors.ts` 里的规范厂商 id（anthropic / openai / google / deepseek /
qwen / baidu-ernie / doubao / moonshot / zhipu / stepfun / xai / minimax / kwai / xiaomi / tencent /
inclusion）。语言、重复次数、提取器模型也都在该文件里配置。

---

## 2. 三阶段工作流（测试 → 渲染 → 报告，彼此独立）

设计上刻意分开，方便你**先看测试数据，确认无误后再渲染图、再写报告**。

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

### 阶段二 · 渲染关系图

确认测试数据 OK 后：

```bash
pnpm study:render            # 默认渲染最近一次 run
pnpm study:render --run 20260529T045756   # 或指定某次
```

产物：`results/<study.id>/<时间戳>/graph.svg` + `graph.png`，并发布到 `public/research/graph.png`（供网页/分享）。

可选参数：
- `--lang zh-Hans` 只渲染某种语言的混淆关系
- `--threshold 0.1` 调整边的显示阈值（默认 0.05，低于此概率的边不画）

### 阶段三 · 撰写报告

```bash
pnpm study:report            # 默认最近一次 run
```

产物：`results/<study.id>/<时间戳>/report.md`（同时复制到 `public/research/report.md`）。
arxiv 风格：摘要、方法论、三线表（各模型/各语言自识别率、混淆矩阵、Top 混淆边）、内嵌关系图、
可粘贴论文的 LaTeX booktabs 块、讨论与结论。

---

## 3. 常用命令速查

| 命令 | 作用 |
|---|---|
| `pnpm study:test` | 阶段一：问答 + 提取 + 聚合（带完整性门禁） |
| `pnpm study:render` | 阶段二：渲染关系图 SVG/PNG |
| `pnpm study:report` | 阶段三：生成 arxiv 风格报告 |
| `pnpm study:run` | 仅问答（自动补全 + 重试轮次） |
| `pnpm study:extract` | 仅身份提取（需 records 完整） |
| `pnpm study:aggregate` | 仅聚合（需 records 完整） |

通用参数：
- `--config <path>`：配置文件（默认 `config/study.yaml`）
- `--run <时间戳>`：指定 run 目录续跑；`--run latest` 用最近一次。`study:run` 不带则新建。
- `study:run` 专属：`--model-concurrency <n>`、`--batch-size <n>`、`--max-rounds <n>`
- `study:extract` / `study:aggregate`：`--force` 跳过完整性门禁
- `study:render`：`--lang <code>`、`--threshold <p>`

> 注意：`study:test` 会**新建**一次 run 并依次跑完三步；若问答未跑完（超过 max-rounds 仍有失败），
> 链条会在门禁处停下，不会在残缺数据上提取/聚合。

---

## 4. 在线交互页

```bash
pnpm dev
```

打开 [http://localhost:3000/research](http://localhost:3000/research) 查看交互式关系图：
节点 hover 高亮关联边、边 hover 显示精确概率、可按语言筛选。页面读取 `public/research/aggregate.json`。

---

## 5. 目录结构

```
config/study.yaml          # 实验配置（编辑这里）
research/
  lib/                     # 核心库：types/vendors/config/prompts/client/limiter/store/ask/extract/aggregate/svg/geometry/report
  scripts/                 # run / extract / aggregate / render-graph / report
  assets/NotoSansSC-*.otf  # resvg 渲染 PNG 内中文用的字体
results/<study.id>/<时间戳>/  # 每次测试的产物（records/extractions/aggregate/graph/report）
public/research/           # 发布物：aggregate.json + graph.png（网页读取）
src/app/research/          # Next.js 交互页
```

---

本研究基础脚手架基于 Next.js。原始 create-next-app 文档见 [nextjs.org/docs](https://nextjs.org/docs)。
