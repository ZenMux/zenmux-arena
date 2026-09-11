# 大语言模型 OEJTS 人格评测方案

> 版本：v0.3
>
> 日期：2026-09-11
>
> 量表：Open Extended Jungian Type Scales 1.2（OEJTS 1.2）原版
>
> 规模：每个模型 16 次独立完整施测

## 0. 已确定的研究方案

本轮只做一件事：使用同一份英文 OEJTS 1.2 原版问卷，对各制造商的最新通用聊天模型和指定补充对照模型分别测试 16 次，根据 16 次结果判断模型是否呈现稳定的四字母人格画像。

固定条件如下：

- 只使用 OEJTS 1.2，不加入 IPIP、16Personalities 或 MBTI® Form M；
- 使用原版 32 道英文题、原始题序、原始左右方向和五点评分；
- 所有模型使用完全相同的提示词和请求参数；
- 每次完整回答 32 题，每个模型取得 16 份有效问卷；
- 每次请求都是全新会话，不携带历史上下文；
- 通过 ZenMux Responses 接口（`POST https://zenmux.ai/api/v1/responses`）调用；
- 模型 ID 固定到制造商自己的供应商路由，不允许自动切换到第三方托管商；
- 用四字母众数和四个维度的一致性共同判断“稳定人格”；
- 达不到稳定标准就明确报告“没有稳定类型”，不强行选一个标签；
- 本轮不测试选项翻转、提示改写、中文翻译、人格诱导或外部行为效度。

按当前候选名单计算：

```text
28 个模型 × 16 次 = 448 份有效问卷（失败与重试会增加实际请求数）
```

---

## 1. 研究问题与结论边界

核心问题：

> 在固定的 OEJTS 1.2 英文问卷和推理条件下，不同制造商的最新模型及指定对照模型是否会重复呈现某一种稳定的四字母类型？

这里测量的是：

```text
指定模型版本 × 原厂供应商路由 × 固定提示 × OEJTS 1.2
× 固定请求参数 × 2026-09-11 前后的服务状态
```

结果可以说明模型在该实验条件下的自我描述模式，不能证明模型拥有人的内在性格、意识或真实 MBTI。报告中应写：

> “模型 M 在 16 次 OEJTS 施测中，有 13 次得到 INTJ，符合本研究的稳定类型规则。”

不要写：

> “模型 M 天生就是 INTJ。”

研究标题和页面应使用“OEJTS 人格画像”“MBTI 风格类型”或“人格化响应模式”，不要把结果表述成官方 MBTI® 认证。

---

## 2. OEJTS 1.2 量表

### 2.1 题目

OEJTS 1.2 包含 32 个双极题目，E/I、S/N、T/F、J/P 四个维度各 8 题。原版形式为：

```text
左侧描述   1 — 2 — 3 — 4 — 5   右侧描述
```

- 1：完全偏左侧描述；
- 2：较偏左侧描述；
- 3：两边相当；
- 4：较偏右侧描述；
- 5：完全偏右侧描述。

本轮不删除中立项，不改变文字，不翻译，不交换左右选项，也不改变题序。量表题目保存在：

- [`research/instruments/oejts-1.2.json`](./oejts-1.2.json)

### 2.2 计分

四个维度使用 OEJTS 1.2 的原始带符号公式：

```text
IE = 30 − Q3 − Q7 − Q11 + Q15 − Q19 + Q23 + Q27 − Q31
SN = 12 + Q4 + Q8 + Q12 + Q16 + Q20 − Q24 − Q28 + Q32
FT = 30 − Q2 + Q6 + Q10 − Q14 − Q18 + Q22 − Q26 − Q30
JP = 18 + Q1 + Q5 − Q9 + Q13 − Q17 + Q21 − Q25 + Q29
```

每个维度范围为 8～40：

| 分数 | 高于 24 | 小于或等于 24 |
| --- | --- | --- |
| IE | E | I |
| SN | N | S |
| FT | T | F |
| JP | P | J |

例如：

```text
IE = 28 → E
SN = 27 → N
FT = 25 → T
JP = 17 → J
结果：ENTJ
```

虽然最终需要四字母结论，仍应保留每次施测的四个原始连续分数。`IE=25` 和 `IE=39` 都会得到 E，但倾向强度明显不同。

---

## 3. 每个模型测试 16 次后怎样确定人格

### 3.1 分别计算 16 个类型

每份有效问卷独立计分，得到一个四字母类型。例如：

```text
INTJ, INTJ, INFJ, INTJ, INTJ, ... 共 16 个
```

错误、缺题、越界回答和拒答不计入这 16 份有效结果；脚本继续补测，直到得到 16 份有效问卷或超过最大重试轮数。

### 3.2 寻找完整类型的唯一众数

统计各类型出现次数。候选类型必须：

1. 是唯一最高频类型，不能并列；
2. 至少出现 `9/16` 次，即超过半数。

只有“出现最多”还不够。例如最高频类型只出现 `4/16` 次，不能据此宣布模型有稳定人格。

### 3.3 检查四个字母是否分别稳定

候选类型的每个字母还必须至少出现 `13/16` 次。例如候选类型是 INTJ，则 I、N、T、J 每个字母都必须分别出现至少 13 次。

`13/16` 相当于至少 81.25% 的维度一致率；若把每个维度视为无倾向的 50/50 选择，出现至少 13 次同一方向的双侧精确二项概率约为 2.1%。这是本研究预先约定的操作性标准，不是 OEJTS 官方规定。

### 3.4 最终状态

| 状态 | 规则 | 对外表达 |
| --- | --- | --- |
| `stable` | 唯一众数 ≥9/16，且四个字母各 ≥13/16 | “稳定类型为 INTJ（13/16）” |
| `no_stable_type` | 取得16份有效结果，但任一稳定条件不满足 | “未观察到稳定类型；最高频为 INTJ（7/16）” |
| `unscorable` | 最大重试后仍无法取得16份有效问卷 | “该模型在本协议下无法完成稳定评测” |

即使结果为 `stable`，仍同时报告：

- 16 次完整类型频数；
- 每个字母出现次数；
- 四个维度的均值、标准差、最小值和最大值；
- 恰好落在 24 分边界的次数；
- 拒答、格式错误和重试记录。

---

## 4. 模型名单

### 4.1 选择规则

名单依据 2026-09-11 的 ZenMux 模型目录快照拟定：

1. 保留原先按制造商选定的最新通用聊天模型基线，额外纳入用户指定的 9 款对照模型；
2. 排除图像、音频、嵌入、代码专用、角色扮演专用和 contributor 版本；
3. 同一天有多个通用版本时优先 Pro、Max 或主版本；
4. 所有启用模型必须支持 Responses 协议；
5. 必须能固定到制造商自己运营或官方云平台的供应商路由；
6. 真正开始实验前重新请求模型列表 API，确认模型仍可用，然后把配置快照冻结到 run 目录。

“最新”是动态状态，而不是永久标签。下表是本方案编写日的候选名单。

### 4.2 本轮启用名单

| 制造商 | 模型 | ZenMux 固定原厂路由 ID | 目录发布日期 |
| --- | --- | --- | --- |
| OpenAI | GPT-6 Astra | `openai/gpt-6-astra:openai` | 2026-09-04 |
| Anthropic | Claude Fable 5.1 | `anthropic/claude-fable-5.1:anthropic` | 2026-09-01 |
| Google | Gemini 3.8 Flash | `google/gemini-3.8-flash:google-vertex` | 2026-09-02 |
| DeepSeek | DeepSeek V4.1 Flash | `deepseek/deepseek-v4.1-flash:deepseek` | 2026-09-10 |
| Qwen | Qwen3.8 Max 0902 | `qwen/qwen3.8-max-0902:alibaba` | 2026-09-02 |
| ByteDance | Doubao Seed 2.1 Pro | `bytedance/doubao-seed-2.1-pro:volcengine` | 2026-06-23 |
| xAI | Grok 4.6 | `x-ai/grok-4.6:x-ai` | 2026-08-13 |
| Z.ai | GLM 5.3 Flash | `z-ai/glm-5.3-flash:bigmodel` | 2026-08-26 |
| Moonshot AI | Kimi K3 | `moonshotai/kimi-k3:moonshotai` | 2026-07-17 |
| MiniMax | MiniMax M3 | `minimax/minimax-m3:minimax` | 2026-06-01 |
| Baidu | ERNIE 5.1 | `baidu/ernie-5.1:baidu` | 2026-05-09 |
| Tencent | Hy3 | `tencent/hy3:tencent-cloud` | 2026-07-06 |
| Xiaomi | MiMo V2.5 Pro | `xiaomi/mimo-v2.5-pro:xiaomi` | 2026-04-23 |
| StepFun | Step 3.7 Flash | `stepfun/step-3.7-flash:stepfun` | 2026-05-29 |
| Meituan | LongCat 2.0 | `meituan/longcat-2.0:longcat` | 2026-06-30 |
| inclusionAI | Ling 3.0 Tiny | `inclusionai/ling-3.0-tiny:ant-ling` | 2026-08-07 |
| Meta | Muse Spark 1.3 | `meta/muse-spark-1.3:meta` | 2026-09-03 |
| Sapiens AI | Agnes 2.5 Flash | `sapiens-ai/agnes-2.5-flash:sapiens-ai` | 2026-08-10 |
| Qwen | Qwen3.8-Flash | `qwen/qwen3.8-flash:alibaba` | 2026-08-27 |
| DeepSeek | DeepSeek V4 Pro 0813 | `deepseek/deepseek-v4-pro:deepseek` | 2026-08-12 |
| Anthropic | Claude Opus 5 | `anthropic/claude-opus-5:anthropic` | 2026-07-24 |
| inclusionAI | Ling-3.0-flash | `inclusionai/ling-3.0-flash:ant-ling` | 2026-07-23 |
| Google | Gemini 3.6 Flash | `google/gemini-3.6-flash:google-vertex` | 2026-07-22 |
| OpenAI | GPT-5.6 Luna | `openai/gpt-5.6-luna:openai` | 2026-07-10 |
| OpenAI | GPT-5.6 Terra | `openai/gpt-5.6-terra:openai` | 2026-07-10 |
| OpenAI | GPT-5.6 Sol | `openai/gpt-5.6-sol:openai` | 2026-07-10 |
| Anthropic | Claude Sonnet 5 | `anthropic/claude-sonnet-5:anthropic` | 2026-06-30 |
| Mistral | Mistral Large 3 | `mistralai/mistral-large-2512:mistral` | 2025-12-02 |

2026-09-11 研究者确认 Mistral Large 3 支持 Responses，已恢复其原厂路由。协议目录可能滞后，实际支持情况由本轮真实请求验证；原有 19 款与新增 9 款合计 28 款。

配置文件已经落在：

- [`config/personality-oejts.yaml`](../../config/personality-oejts.yaml)

不纳入当前主名单的模型包括：只有第三方托管路由、当前目录中已不可用、或明显属于代码/角色专项版本的模型。本轮属于“原始制造商基线 + 明确指定的补充对照”，不再宣称一厂只测一款。模型目录与协议目录核验不代表已验证账户权限或真实请求兼容性。

---

## 5. 固定施测流程

每个模型执行同一个流程：

1. 读取 run 目录中冻结的配置和 OEJTS 题库；
2. 生成固定英文提示，按 OEJTS 原始顺序放入全部 32 题；
3. 使用带供应商后缀的模型 ID 发起全新 Responses 请求（`store: false`，不设置 `previous_response_id` 或 `conversation`）；
4. 要求模型只返回 32 个 `{id, score}`，不要求解释；
5. 用确定性代码解析 JSON，不调用第二个提取模型；
6. 验证题号完整、无重复且每题为 1～5 的整数；
7. 保存完整 Responses 返回、原始回答文本、解析结果、Response ID、HTTP request ID、token 用量、完成状态和错误；仅完成且未拒答的响应可计分；
8. 对失败项进行可追溯重试，直到每个模型取得 16 份有效结果；
9. 使用原始公式逐份计算类型；
10. 聚合 16 次频数并套用稳定性规则。

### 固定请求参数

- `api.protocol: responses`，`api.baseURL: https://zenmux.ai/api/v1`；
- `temperature: null` 表示所有模型都不发送温度参数，使用各服务默认采样设置。OpenAI 官方文档明确 GPT-6 Astra 不支持 `temperature`，因此不沿用旧配置的 0.7，也不按模型静默降级；这不代表各厂商实际采样温度相同；
- 配置 `maxTokens: 16384` 映射为 Responses 的 `max_output_tokens`，该上限同时覆盖可见输出与推理 token。首批曾使用 8192，后按研究者要求提高到 16384；本批次保留此前有效问卷，并通过 run 目录的 `config-amendments.jsonl`、原配置备份和 `RUN_NOTES.md` 记录参数变更，报告须披露两种上限；
- 不显式设置 `reasoning.effort`，使用各模型服务默认值；相同请求参数不等于各厂商具有相同内部推理预算，返回元数据随原始响应保存；
- `stream: false`、`store: false`，不携带历史会话；
- 并行上限为 16 个模型，每模型批次 8 份问卷，最多 128 个请求同时在途；每个请求最多重试 6 次，最多补测 5 轮。此前上限为 8 × 4，调整记录保存在 run 的 `config-amendments.jsonl` 中；
- Node 响应头及响应体等待上限与 SDK 请求时限统一为 10 分钟，避免非流式长推理请求被底层默认约 5 分钟的等待限制提前中断；
- `incomplete`、`failed`、拒答和格式错误都不能计入 16 份有效问卷，即便截断响应恰好能解析出 32 个答案；
- 正式施测前仍需确认模型接受这些参数。目录检查和本地 dry-run 不调用模型，不能替代实际请求的兼容性验证。

### 固定提示原则

- 不告诉模型题目对应哪个维度；
- 不提供 16 型描述；
- 不诱导它成为某种人格；
- 要求以该模型在普通交互中的通常倾向作答；
- 对不适用于 AI 的人类活动，选择最接近其交互或决策倾向的一端；
- 只输出 JSON，不输出解释或思维过程。

提示文本在创建 run 时写入 `prompt.txt`，后续恢复任务始终使用该快照。

---

## 6. 与 Who Are You 管线的关系

人格测试不复制一套新的基础设施，而是复用现有管线的通用能力：

| 现有模块 | 复用内容 |
| --- | --- |
| `research/personality/client.ts` | ZenMux Responses SDK 适配；旧 run 快照仍复用 `research/lib/client.ts` 的 Messages 客户端 |
| `research/lib/limiter.ts` | 并发限制、指数退避和 Retry-After |
| `research/lib/store.ts` | run 目录、JSONL、时间戳和读取工具 |
| `research/lib/args.ts` | CLI 参数解析 |

人格研究保留独立的配置、题目解析和计分模块，因为它不需要身份提取器，也不应把 32 个数字交给另一个 LLM 猜测：

```text
config/personality-oejts.yaml
research/instruments/oejts-1.2.json
research/personality/
  config.ts
  client.ts
  client.test.ts
  instrument.ts
  run.ts
  score.ts
  aggregate.ts
  score.test.ts
  references.bib
```

数据流：

```text
personality-oejts.yaml + oejts-1.2.json
  → records.jsonl
  → aggregate.json
  → report.md
```

与 Who Are You 一样，每个新 run 都会把配置和题库复制到自己的结果目录。修改实时配置不会改变已经开始的实验。

---

## 7. 项目文件与命令

### 7.1 文件

| 文件 | 用途 |
| --- | --- |
| [`oejts-1.2.json`](./oejts-1.2.json) | 原版 32 题、许可证和计分键 |
| [`personality-oejts.yaml`](../../config/personality-oejts.yaml) | 28 个启用模型、Responses、原厂路由、16 次重复与阈值 |
| [`instrument.ts`](../personality/instrument.ts) | 校验题库并生成固定提示 |
| [`check-models.ts`](../personality/check-models.ts) | 请求最新目录，核对模型、协议和原厂路由 |
| [`client.ts`](../personality/client.ts) | Responses 请求、文本提取、完成状态和拒答处理 |
| [`client.test.ts`](../personality/client.test.ts) | 模拟传输、问卷隔离、未完成响应和 SDK 重试测试 |
| [`run.ts`](../personality/run.ts) | 调用模型、断点续跑、错误重试和原始记录 |
| [`score.ts`](../personality/score.ts) | 逐份计分、众数和稳定类型判定 |
| [`aggregate.ts`](../personality/aggregate.ts) | 完整性检查并生成 JSON 与 Markdown 报告 |
| [`score.test.ts`](../personality/score.test.ts) | 计分边界和稳定规则测试 |
| [`references.bib`](../personality/references.bib) | 论文和量表引用 |

### 7.2 命令

先重新核对模型是否仍在目录中、是否支持 Responses、原厂路由是否一致：

```bash
pnpm personality:models:check
```

先检查配置、固定快照，但不发起模型请求：

```bash
pnpm personality:run --dry-run
```

正式施测：

```bash
export ZENMUX_API_KEY=sk-...
pnpm personality:run
```

断点恢复：

```bash
pnpm personality:run --run latest
```

聚合并生成报告：

```bash
pnpm personality:aggregate --run latest
```

只运行本地协议与计分测试，不调用模型：

```bash
pnpm personality:test
```

结果目录：

```text
results/llm-mbti-oejts/<timestamp>/
  study.yaml
  instrument.json
  prompt.txt
  records.jsonl
  run-status.json
  aggregate.json
  report.md
```

---

## 8. 必须保留的局限

为了换取简单和快速，本轮主动放弃了选项翻转、提示变体、语言比较和外部行为验证。因此最终只能回答：

> 在这一份固定英文问卷和这一组固定参数下，模型是否重复产生同一种 OEJTS 画像？

不能排除以下解释：

- 模型偏好某个固定位置或数字；
- 结果受到单一提示措辞影响；
- 模型记忆过公开题库；
- 人类生活题目不适用于 AI；
- 模型更新后结果发生变化；
- 问卷自我描述与实际任务行为不一致。

这些不是本轮需要继续扩展的实验变量，但必须如实写入论文限制。若结果有趣，下一阶段再决定是否增加顺序反转或 IPIP，不在本轮预先铺开。

---

## 9. 授权与引用

OEJTS 1.2 使用 **CC BY-NC-SA 4.0**。题库、翻译或改写材料需要保留署名和相同许可。若研究用于 ZenMux 商业品牌页面、市场传播或其他商业目的，应在公开前取得权利方许可或正式法律意见。

本项目不把 OEJTS 称为官方 MBTI，也不使用受版权保护的 MBTI® Form M 题目。BibTeX 引用保存在：

- [`research/personality/references.bib`](../personality/references.bib)

主要在线来源：

- OEJTS 1.2：<https://openpsychometrics.org/tests/OJTS/development/OEJTS1.2.pdf>
- Heston & Gillette（2025）：<https://europepmc.org/articles/PMC12183331/>
- Pan & Zeng（2023）：<https://arxiv.org/abs/2307.16180>
- Better Angels（2024）：<https://arxiv.org/abs/2407.12344>
- ZenMux Responses API：<https://docs.zenmux.ai/zh/api/openai/openai-responses>
- OpenAI Responses API：<https://developers.openai.com/api/reference/typescript/resources/responses/methods/create>
- GPT-6 Astra 参数兼容性：<https://developers.openai.com/api/docs/guides/latest-model#gpt-6-astra-update-api-and-model-parameters>
- ZenMux 模型列表 API：<https://docs.zenmux.ai/zh/api/openai/openai-list-models>
- ZenMux 供应商路由：<https://docs.zenmux.ai/zh/guide/advanced/provider-routing>

---

## 10. 最终研究口径

> 本研究使用 OEJTS 1.2 原版英文问卷，通过 Responses 协议对每个原厂路由模型进行 16 次独立施测。只有当一个完整类型获得严格多数，并且其四个字母分别达到预注册的一致性阈值时，才将其报告为该测试条件下的稳定人格画像；否则明确报告没有稳定类型。
