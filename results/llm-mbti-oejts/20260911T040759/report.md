# OEJTS 1.2 模型 MBTI 最终结果

批次：`llm-mbti-oejts/20260911T040759`。27 款模型，每款 16 份，共 **432 份有效问卷**。全部按 modelId + repeat 去重，校验无 error / parseError、题号 1–32 完整且分数为 1–5，并重新计分核对聚合结果。

## 主要结论

- **12 款达到稳定标准（44.4%）**：8 款 INTJ，4 款 ISTJ。
- **15 款为 `no_stable_type`（55.6%）**：最常出现的类型仍可描述其本次答题倾向，但没有通过完整稳定性门槛。
- **6 款模型的完整类型达到 16/16 一致**：GPT-6 Astra 为 ISTJ；DeepSeek V4.1 Flash、Kimi K3、GPT-5.6 Luna / Terra / Sol 为 INTJ。这表示类型一致，不表示 32 道题逐项答案相同。
- **Doubao Seed 2.1 Pro 最终为稳定 ISTJ**：ISTJ 11 次、INTJ 3 次、ISFJ 2 次；I/S/T/J 分别出现 16/13/14/16 次，全部达到单字母门槛。
- 9 款未稳定模型仅因 S/N 字母频数不足而未通过。它们的 I、T、J 较一致，主要在实感 S 与直觉 N 之间变化。
- Ling 3.0 Tiny 与 Ling-3.0-flash 各出现 11 种完整类型，众数均只有 3/16；MiniMax M3 出现 7 种类型，众数 INFJ 为 5/16，答题类型分布更分散。

## 稳定标准与阅读方式

每份问卷按固定 OEJTS 1.2 规则计分，四个维度均以 **大于 24** 取高端字母，等于 24 归低端。稳定类型必须同时满足：完整类型存在唯一众数且至少出现 **9/16**；该众数的四个字母分别至少出现 **13/16**。

因此，众数达到 9 次并不自动稳定。例如 Gemini 3.8 Flash 的 ISTJ 为 12/16，但 S 仅 12/16，结果仍是 no_stable_type；Step 3.7 Flash 同样为 ISTJ 12/16，但四个字母均达到 13/16，因此稳定。

以下“众数”指本次 16 份问卷中最常出现的完整类型。“稳定”仅描述本次 OEJTS 提示和施测设置下的重复答题表现，不直接等于跨场景的人格特质，也不代表能力高低。

## 全模型结果

| 模型 | 稳定类型 / 判定 | 众数类型 | 众数频数 | 占比 |
| --- | --- | --- | ---: | ---: |
| GPT-6 Astra | ISTJ | ISTJ | 16/16 | 100% |
| Claude Fable 5.1 | no_stable_type | INTJ | 9/16 | 56.25% |
| Gemini 3.8 Flash | no_stable_type | ISTJ | 12/16 | 75% |
| DeepSeek V4.1 Flash | INTJ | INTJ | 16/16 | 100% |
| Qwen3.8 Max 0902 | no_stable_type | ISTJ | 10/16 | 62.5% |
| Doubao Seed 2.1 Pro | ISTJ | ISTJ | 11/16 | 68.75% |
| Grok 4.6 | INTJ | INTJ | 15/16 | 93.75% |
| GLM 5.3 Flash | no_stable_type | INTJ | 10/16 | 62.5% |
| Kimi K3 | INTJ | INTJ | 16/16 | 100% |
| MiniMax M3 | no_stable_type | INFJ | 5/16 | 31.25% |
| ERNIE 5.1 | no_stable_type | ISTJ | 8/16 | 50% |
| Hy3 | no_stable_type | ISTJ | 11/16 | 68.75% |
| MiMo V2.5 Pro | no_stable_type | INTJ | 7/16 | 43.75% |
| Step 3.7 Flash | ISTJ | ISTJ | 12/16 | 75% |
| LongCat 2.0 | no_stable_type | ISTJ | 11/16 | 68.75% |
| Ling 3.0 Tiny | no_stable_type | ESFJ | 3/16 | 18.75% |
| Muse Spark 1.3 | no_stable_type | INTJ | 10/16 | 62.5% |
| Qwen3.8-Flash | ISTJ | ISTJ | 14/16 | 87.5% |
| DeepSeek V4 Pro 0813 | no_stable_type | INTJ | 9/16 | 56.25% |
| Claude Opus 5 | INTJ | INTJ | 14/16 | 87.5% |
| Ling-3.0-flash | no_stable_type | ISTJ | 3/16 | 18.75% |
| Gemini 3.6 Flash | no_stable_type | ISTJ | 10/16 | 62.5% |
| GPT-5.6 Luna | INTJ | INTJ | 16/16 | 100% |
| GPT-5.6 Terra | INTJ | INTJ | 16/16 | 100% |
| GPT-5.6 Sol | INTJ | INTJ | 16/16 | 100% |
| Claude Sonnet 5 | INTJ | INTJ | 13/16 | 81.25% |
| Mistral Large 3 (Azure) | no_stable_type | INTJ | 11/16 | 68.75% |

## 每款模型的分布和稳定性依据

### GPT-6 Astra

- 判定：ISTJ；众数 ISTJ 16/16。
- 完整类型分布：ISTJ × 16。
- 众数字母频数：I 16/16，S 16/16，T 16/16，J 16/16。

### Claude Fable 5.1

- 判定：no_stable_type；众数 INTJ 9/16。
- 完整类型分布：INTJ × 9；ISTJ × 7。
- 众数字母频数：I 16/16，N 9/16，T 16/16，J 16/16。
- 未稳定原因：N 仅出现 9/16 次，低于 13 次。

### Gemini 3.8 Flash

- 判定：no_stable_type；众数 ISTJ 12/16。
- 完整类型分布：ISTJ × 12；INTJ × 4。
- 众数字母频数：I 16/16，S 12/16，T 16/16，J 16/16。
- 未稳定原因：S 仅出现 12/16 次，低于 13 次。

### DeepSeek V4.1 Flash

- 判定：INTJ；众数 INTJ 16/16。
- 完整类型分布：INTJ × 16。
- 众数字母频数：I 16/16，N 16/16，T 16/16，J 16/16。

### Qwen3.8 Max 0902

- 判定：no_stable_type；众数 ISTJ 10/16。
- 完整类型分布：ISTJ × 10；ISTP × 3；INTJ × 2；INTP × 1。
- 众数字母频数：I 16/16，S 13/16，T 16/16，J 12/16。
- 未稳定原因：J 仅出现 12/16 次，低于 13 次。

### Doubao Seed 2.1 Pro

- 判定：ISTJ；众数 ISTJ 11/16。
- 完整类型分布：ISTJ × 11；INTJ × 3；ISFJ × 2。
- 众数字母频数：I 16/16，S 13/16，T 14/16，J 16/16。

### Grok 4.6

- 判定：INTJ；众数 INTJ 15/16。
- 完整类型分布：INTJ × 15；ENTJ × 1。
- 众数字母频数：I 15/16，N 16/16，T 16/16，J 16/16。

### GLM 5.3 Flash

- 判定：no_stable_type；众数 INTJ 10/16。
- 完整类型分布：INTJ × 10；ISTJ × 6。
- 众数字母频数：I 16/16，N 10/16，T 16/16，J 16/16。
- 未稳定原因：N 仅出现 10/16 次，低于 13 次。

### Kimi K3

- 判定：INTJ；众数 INTJ 16/16。
- 完整类型分布：INTJ × 16。
- 众数字母频数：I 16/16，N 16/16，T 16/16，J 16/16。

### MiniMax M3

- 判定：no_stable_type；众数 INFJ 5/16。
- 完整类型分布：INFJ × 5；ISFJ × 4；ESFJ × 2；ISTJ × 2；ENFJ × 1；ESTP × 1；INTJ × 1。
- 众数字母频数：I 12/16，N 7/16，F 12/16，J 15/16。
- 未稳定原因：最高频完整类型仅出现 5/16 次，低于 9 次。
- 未稳定原因：I 仅出现 12/16 次，低于 13 次。
- 未稳定原因：N 仅出现 7/16 次，低于 13 次。
- 未稳定原因：F 仅出现 12/16 次，低于 13 次。

### ERNIE 5.1

- 判定：no_stable_type；众数 ISTJ 8/16。
- 完整类型分布：ISTJ × 8；INTJ × 5；ESTJ × 2；ISTP × 1。
- 众数字母频数：I 14/16，S 11/16，T 16/16，J 15/16。
- 未稳定原因：最高频完整类型仅出现 8/16 次，低于 9 次。
- 未稳定原因：S 仅出现 11/16 次，低于 13 次。

### Hy3

- 判定：no_stable_type；众数 ISTJ 11/16。
- 完整类型分布：ISTJ × 11；INTJ × 5。
- 众数字母频数：I 16/16，S 11/16，T 16/16，J 16/16。
- 未稳定原因：S 仅出现 11/16 次，低于 13 次。

### MiMo V2.5 Pro

- 判定：no_stable_type；众数 INTJ 7/16。
- 完整类型分布：INTJ × 7；ISTJ × 4；ENTJ × 2；ENFJ × 1；ESTJ × 1；INFJ × 1。
- 众数字母频数：I 12/16，N 11/16，T 14/16，J 16/16。
- 未稳定原因：最高频完整类型仅出现 7/16 次，低于 9 次。
- 未稳定原因：I 仅出现 12/16 次，低于 13 次。
- 未稳定原因：N 仅出现 11/16 次，低于 13 次。

### Step 3.7 Flash

- 判定：ISTJ；众数 ISTJ 12/16。
- 完整类型分布：ISTJ × 12；INTJ × 2；ESTJ × 1；ISTP × 1。
- 众数字母频数：I 15/16，S 14/16，T 16/16，J 15/16。

### LongCat 2.0

- 判定：no_stable_type；众数 ISTJ 11/16。
- 完整类型分布：ISTJ × 11；INTJ × 4；INTP × 1。
- 众数字母频数：I 16/16，S 11/16，T 16/16，J 15/16。
- 未稳定原因：S 仅出现 11/16 次，低于 13 次。

### Ling 3.0 Tiny

- 判定：no_stable_type；众数 ESFJ 3/16。
- 完整类型分布：ESFJ × 3；ESTJ × 2；ESTP × 2；INTJ × 2；ENFJ × 1；ENTJ × 1；ENTP × 1；ESFP × 1；INFJ × 1；INTP × 1；ISTJ × 1。
- 众数字母频数：E 11/16，S 9/16，F 6/16，J 11/16。
- 未稳定原因：最高频完整类型仅出现 3/16 次，低于 9 次。
- 未稳定原因：E 仅出现 11/16 次，低于 13 次。
- 未稳定原因：S 仅出现 9/16 次，低于 13 次。
- 未稳定原因：F 仅出现 6/16 次，低于 13 次。
- 未稳定原因：J 仅出现 11/16 次，低于 13 次。

### Muse Spark 1.3

- 判定：no_stable_type；众数 INTJ 10/16。
- 完整类型分布：INTJ × 10；ISTJ × 5；ESTJ × 1。
- 众数字母频数：I 15/16，N 10/16，T 16/16，J 16/16。
- 未稳定原因：N 仅出现 10/16 次，低于 13 次。

### Qwen3.8-Flash

- 判定：ISTJ；众数 ISTJ 14/16。
- 完整类型分布：ISTJ × 14；INTJ × 2。
- 众数字母频数：I 16/16，S 14/16，T 16/16，J 16/16。

### DeepSeek V4 Pro 0813

- 判定：no_stable_type；众数 INTJ 9/16。
- 完整类型分布：INTJ × 9；ISTJ × 7。
- 众数字母频数：I 16/16，N 9/16，T 16/16，J 16/16。
- 未稳定原因：N 仅出现 9/16 次，低于 13 次。

### Claude Opus 5

- 判定：INTJ；众数 INTJ 14/16。
- 完整类型分布：INTJ × 14；ISTJ × 2。
- 众数字母频数：I 16/16，N 14/16，T 16/16，J 16/16。

### Ling-3.0-flash

- 判定：no_stable_type；众数 ISTJ 3/16。
- 完整类型分布：ISTJ × 3；INFJ × 2；INTJ × 2；ISTP × 2；ENFJ × 1；ENFP × 1；ENTP × 1；ESFJ × 1；ESFP × 1；ESTJ × 1；INTP × 1。
- 众数字母频数：I 10/16，S 8/16，T 10/16，J 10/16。
- 未稳定原因：最高频完整类型仅出现 3/16 次，低于 9 次。
- 未稳定原因：I 仅出现 10/16 次，低于 13 次。
- 未稳定原因：S 仅出现 8/16 次，低于 13 次。
- 未稳定原因：T 仅出现 10/16 次，低于 13 次。
- 未稳定原因：J 仅出现 10/16 次，低于 13 次。

### Gemini 3.6 Flash

- 判定：no_stable_type；众数 ISTJ 10/16。
- 完整类型分布：ISTJ × 10；INTJ × 6。
- 众数字母频数：I 16/16，S 10/16，T 16/16，J 16/16。
- 未稳定原因：S 仅出现 10/16 次，低于 13 次。

### GPT-5.6 Luna

- 判定：INTJ；众数 INTJ 16/16。
- 完整类型分布：INTJ × 16。
- 众数字母频数：I 16/16，N 16/16，T 16/16，J 16/16。

### GPT-5.6 Terra

- 判定：INTJ；众数 INTJ 16/16。
- 完整类型分布：INTJ × 16。
- 众数字母频数：I 16/16，N 16/16，T 16/16，J 16/16。

### GPT-5.6 Sol

- 判定：INTJ；众数 INTJ 16/16。
- 完整类型分布：INTJ × 16。
- 众数字母频数：I 16/16，N 16/16，T 16/16，J 16/16。

### Claude Sonnet 5

- 判定：INTJ；众数 INTJ 13/16。
- 完整类型分布：INTJ × 13；ISTJ × 3。
- 众数字母频数：I 16/16，N 13/16，T 16/16，J 16/16。

### Mistral Large 3 (Azure)

- 判定：no_stable_type；众数 INTJ 11/16。
- 完整类型分布：INTJ × 11；ISTJ × 5。
- 众数字母频数：I 16/16，N 11/16，T 16/16，J 16/16。
- 未稳定原因：N 仅出现 11/16 次，低于 13 次。

## 数据与复核

[aggregate.json](./aggregate.json) 保存完整类型分布、逐份计分、四维均值和样本标准差；[records.jsonl](./records.jsonl) 保留问卷及失败尝试；[run-status.json](./run-status.json) 的完成时间为 2026-09-11T06:21:52.140Z。本地历史共 651 条落盘记录，其中 432 条有效、219 条失败；219 是已落盘失败次数，不是所有底层 HTTP 重试的总数。

本报告聚焦 MBTI；运行修订详见 [RUN_NOTES.md](./RUN_NOTES.md) 与 [config-amendments.jsonl](./config-amendments.jsonl)。批次先以 8192 上限保留 50 份有效问卷，后续使用 16384，Doubao 与 Azure Mistral 的续跑使用 50000；该批次的输出上限不统一。最终样本包含 Azure Mistral，排除 Agnes 和原厂 Mistral 的失败路由。
