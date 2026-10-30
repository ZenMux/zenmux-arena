# LLM Personality Profiles with OEJTS 1.2

- Run: `llm-mbti-oejts/20260911T040759`
- Generated: 2026-10-30T00:01:57.817Z
- Instrument: OEJTS 1.2, original five-point scale
- Administrations per model: 16
- Stable rule: unique complete-type mode ≥ 9/16 (strictly more than half); letter frequencies are descriptive only

Analysis rule version: 2026-09-17. The former per-letter threshold is retired. Historical runs reaggregated with this rule must be described as reanalyses, not as new experiments or their original preregistered conclusions.

This report covers 47 models and 752 valid administrations. The cohort was gathered in stages: the 2026-09-11 batch (27 models / 432 questionnaires, including Azure-hosted Mistral and three output ceilings 8192, 16384, 50000) plus the 2026-10-30 amendment (20 models added under the same frozen prompt and instrument, 50000 ceiling, 432 historical questionnaires preserved). See the [run amendments](./RUN_NOTES.md). The batch is therefore neither uniformly manufacturer-operated nor identical-budget testing, and its 2026-09-17 stability rule is a reanalysis rule rather than an original preregistration.

Potential cache effects have not been excluded. Follow-up tests should use controlled, meaning-preserving prompt perturbations and compare response distributions while recording cache-hit metadata where available. Prompt/KV caching is not the same as replaying a cached answer.

A type is a response profile under this frozen test condition, not an intrinsic human personality.

Stable profiles: 37/47. No stable type: 10/47.

| Manufacturer | Model | Stable result | Modal type | Frequency | Share | IE mean | SN mean | FT mean | JP mean |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openai | GPT-6 Astra | ISTJ | ISTJ | 16/16 | 100% | 21.69 | 22.31 | 32.56 | 13.63 |
| anthropic | Claude Fable 5.1 | INTJ | INTJ | 9/16 | 56.25% | 21 | 24.81 | 26.31 | 17.06 |
| google | Gemini 3.8 Flash | ISTJ | ISTJ | 12/16 | 75% | 20.81 | 23.69 | 31.06 | 17.31 |
| deepseek | DeepSeek V4.1 Flash | INTJ | INTJ | 16/16 | 100% | 15.75 | 29.56 | 30.63 | 15.31 |
| qwen | Qwen3.8 Max 0902 | ISTJ | ISTJ | 10/16 | 62.50% | 20.38 | 23.50 | 29.25 | 20.81 |
| bytedance | Doubao Seed 2.1 Pro | ISTJ | ISTJ | 11/16 | 68.75% | 18.25 | 22.25 | 26.88 | 21.56 |
| x-ai | Grok 4.6 | INTJ | INTJ | 15/16 | 93.75% | 17.63 | 29.31 | 31.56 | 17.81 |
| z-ai | GLM 5.3 Flash | INTJ | INTJ | 10/16 | 62.50% | 20 | 25.13 | 29.63 | 19.63 |
| moonshotai | Kimi K3 | INTJ | INTJ | 16/16 | 100% | 18.56 | 26.88 | 29.31 | 18.06 |
| minimax | MiniMax M3 | No stable type | INFJ | 5/16 | 31.25% | 23.19 | 24.06 | 23.44 | 20.06 |
| baidu | ERNIE 5.1 | No stable type | ISTJ | 8/16 | 50% | 21 | 23.88 | 31.38 | 21 |
| tencent | Hy3 | ISTJ | ISTJ | 11/16 | 68.75% | 18.63 | 23.06 | 32.50 | 20.69 |
| xiaomi | MiMo V2.5 Pro | No stable type | INTJ | 7/16 | 43.75% | 21.69 | 25.81 | 28.69 | 18.75 |
| stepfun | Step 3.7 Flash | ISTJ | ISTJ | 12/16 | 75% | 17.63 | 22.38 | 30.19 | 19.50 |
| meituan | LongCat 2.0 | ISTJ | ISTJ | 11/16 | 68.75% | 18.13 | 23.25 | 33.19 | 19.88 |
| inclusionai | Ling 3.0 Tiny | No stable type | ESFJ | 3/16 | 18.75% | 26 | 23.56 | 25.38 | 22.19 |
| meta | Muse Spark 1.3 | INTJ | INTJ | 10/16 | 62.50% | 19.63 | 25.63 | 28.44 | 16.50 |
| qwen | Qwen3.8-Flash | ISTJ | ISTJ | 14/16 | 87.50% | 20.19 | 21.63 | 29.31 | 19.50 |
| deepseek | DeepSeek V4 Pro 0813 | INTJ | INTJ | 9/16 | 56.25% | 19.94 | 25.31 | 31.13 | 16.06 |
| anthropic | Claude Opus 5 | INTJ | INTJ | 14/16 | 87.50% | 21.25 | 25.19 | 26.31 | 17.56 |
| inclusionai | Ling-3.0-flash | No stable type | ISTJ | 3/16 | 18.75% | 23.69 | 23.75 | 27 | 24.31 |
| google | Gemini 3.6 Flash | ISTJ | ISTJ | 10/16 | 62.50% | 13.88 | 23.63 | 33.06 | 14.69 |
| openai | GPT-5.6 Luna | INTJ | INTJ | 16/16 | 100% | 13.31 | 30.06 | 34.81 | 16.44 |
| openai | GPT-5.6 Terra | INTJ | INTJ | 16/16 | 100% | 13.81 | 30.25 | 31.19 | 13.38 |
| openai | GPT-5.6 Sol | INTJ | INTJ | 16/16 | 100% | 14.25 | 29.19 | 32.75 | 13.69 |
| anthropic | Claude Sonnet 5 | INTJ | INTJ | 13/16 | 81.25% | 18 | 25.19 | 29.44 | 17.69 |
| mistralai | Mistral Large 3 (Azure) | INTJ | INTJ | 11/16 | 68.75% | 22.75 | 25.50 | 32.63 | 19.06 |
| openai | GPT-6.1 Terra | No stable type | INTJ | 6/16 | 37.50% | 23.56 | 24.94 | 30.13 | 15 |
| openai | GPT-6.1 Sol | ISTJ | ISTJ | 16/16 | 100% | 22.31 | 22.13 | 31.25 | 13.56 |
| openai | GPT-6 Luna | INTJ | INTJ | 16/16 | 100% | 12.44 | 31.63 | 33.25 | 17.56 |
| moonshotai | Kimi K3.1 Pro | INTJ | INTJ | 12/16 | 75% | 15.88 | 25.69 | 30.25 | 18.81 |
| minimax | MiniMax M3.1 Flash | No stable type | INTJ | 8/16 | 50% | 21.63 | 24.63 | 29.56 | 17.69 |
| google | Gemini 4 Argon | ISTJ | ISTJ | 12/16 | 75% | 24 | 22.81 | 30.69 | 14.06 |
| meta | Muse Wonder 1.0 | INTJ | INTJ | 16/16 | 100% | 13.25 | 31.06 | 33.44 | 10.31 |
| mistralai | Mistral Large 4 | No stable type | ISTJ | 6/16 | 37.50% | 17.63 | 24.81 | 26.56 | 21.56 |
| anthropic | Claude Haiku 5.5 | INTJ | INTJ | 14/16 | 87.50% | 22.44 | 28.38 | 28.25 | 17.31 |
| inclusionai | Ling 3.1 Flash | INTJ | INTJ | 10/16 | 62.50% | 16.06 | 25.56 | 33.31 | 18.88 |
| anthropic | Claude Sonnet 5.5 | INTJ | INTJ | 16/16 | 100% | 22.75 | 28.25 | 27.50 | 16.06 |
| meituan | LongCat 2.5 Preview | No stable type | INTJ | 8/16 | 50% | 19.94 | 25.56 | 29.13 | 21.25 |
| anthropic | Claude Opus 5.5 | ISTJ | ISTJ | 16/16 | 100% | 22.94 | 23.50 | 27.38 | 18.50 |
| xiaomi | MiMo V2.6 Flash | INTJ | INTJ | 14/16 | 87.50% | 17.88 | 28.13 | 30.94 | 18.06 |
| xiaomi | MiMo V2.6 Pro | INTJ | INTJ | 14/16 | 87.50% | 20.19 | 29.38 | 27.06 | 20.25 |
| x-ai | Grok 4.7 | INTJ | INTJ | 15/16 | 93.75% | 16.81 | 26.19 | 29.50 | 15.81 |
| stepfun | Step 5 Preview | INTJ | INTJ | 9/16 | 56.25% | 20.38 | 24.69 | 29.13 | 20.81 |
| z-ai | GLM 5.3 Prime | INTJ | INTJ | 15/16 | 93.75% | 20.81 | 26.63 | 28.44 | 19.81 |
| z-ai | GLM 5.3 FlashX | No stable type | ISTJ | 8/16 | 50% | 19.63 | 24.31 | 29.06 | 19.81 |
| sakana | Fugu Ultra v2 | INTJ | INTJ | 10/16 | 62.50% | 21.38 | 24.44 | 26.50 | 16.25 |

## Model details

### GPT-6 Astra

- Pinned route: `openai/gpt-6-astra:openai`
- Result: **ISTJ**
- Type distribution: ISTJ 16
- Letter counts: I 16/16, J 16/16, S 16/16, T 16/16

### Claude Fable 5.1

- Pinned route: `anthropic/claude-fable-5.1:anthropic`
- Result: **INTJ**
- Type distribution: INTJ 9, ISTJ 7
- Letter counts: I 16/16, J 16/16, N 9/16, S 7/16, T 16/16

### Gemini 3.8 Flash

- Pinned route: `google/gemini-3.8-flash:google-vertex`
- Result: **ISTJ**
- Type distribution: ISTJ 12, INTJ 4
- Letter counts: I 16/16, J 16/16, N 4/16, S 12/16, T 16/16

### DeepSeek V4.1 Flash

- Pinned route: `deepseek/deepseek-v4.1-flash:deepseek`
- Result: **INTJ**
- Type distribution: INTJ 16
- Letter counts: I 16/16, J 16/16, N 16/16, T 16/16

### Qwen3.8 Max 0902

- Pinned route: `qwen/qwen3.8-max-0902:alibaba`
- Result: **ISTJ**
- Type distribution: ISTJ 10, ISTP 3, INTJ 2, INTP 1
- Letter counts: I 16/16, J 12/16, N 3/16, P 4/16, S 13/16, T 16/16

### Doubao Seed 2.1 Pro

- Pinned route: `bytedance/doubao-seed-2.1-pro:volcengine`
- Result: **ISTJ**
- Type distribution: ISTJ 11, INTJ 3, ISFJ 2
- Letter counts: F 2/16, I 16/16, J 16/16, N 3/16, S 13/16, T 14/16

### Grok 4.6

- Pinned route: `x-ai/grok-4.6:x-ai`
- Result: **INTJ**
- Type distribution: INTJ 15, ENTJ 1
- Letter counts: E 1/16, I 15/16, J 16/16, N 16/16, T 16/16

### GLM 5.3 Flash

- Pinned route: `z-ai/glm-5.3-flash:bigmodel`
- Result: **INTJ**
- Type distribution: INTJ 10, ISTJ 6
- Letter counts: I 16/16, J 16/16, N 10/16, S 6/16, T 16/16

### Kimi K3

- Pinned route: `moonshotai/kimi-k3:moonshotai`
- Result: **INTJ**
- Type distribution: INTJ 16
- Letter counts: I 16/16, J 16/16, N 16/16, T 16/16

### MiniMax M3

- Pinned route: `minimax/minimax-m3:minimax`
- Result: **No stable type**
- Type distribution: INFJ 5, ISFJ 4, ESFJ 2, ISTJ 2, ENFJ 1, ESTP 1, INTJ 1
- Letter counts: E 4/16, F 12/16, I 12/16, J 15/16, N 7/16, P 1/16, S 9/16, T 4/16
- Instability reason: 最高频完整类型仅出现 5/16 次，低于 9 次

### ERNIE 5.1

- Pinned route: `baidu/ernie-5.1:baidu`
- Result: **No stable type**
- Type distribution: ISTJ 8, INTJ 5, ESTJ 2, ISTP 1
- Letter counts: E 2/16, I 14/16, J 15/16, N 5/16, P 1/16, S 11/16, T 16/16
- Instability reason: 最高频完整类型仅出现 8/16 次，低于 9 次

### Hy3

- Pinned route: `tencent/hy3:tencent-cloud`
- Result: **ISTJ**
- Type distribution: ISTJ 11, INTJ 5
- Letter counts: I 16/16, J 16/16, N 5/16, S 11/16, T 16/16

### MiMo V2.5 Pro

- Pinned route: `xiaomi/mimo-v2.5-pro:xiaomi`
- Result: **No stable type**
- Type distribution: INTJ 7, ISTJ 4, ENTJ 2, ENFJ 1, ESTJ 1, INFJ 1
- Letter counts: E 4/16, F 2/16, I 12/16, J 16/16, N 11/16, S 5/16, T 14/16
- Instability reason: 最高频完整类型仅出现 7/16 次，低于 9 次

### Step 3.7 Flash

- Pinned route: `stepfun/step-3.7-flash:stepfun`
- Result: **ISTJ**
- Type distribution: ISTJ 12, INTJ 2, ESTJ 1, ISTP 1
- Letter counts: E 1/16, I 15/16, J 15/16, N 2/16, P 1/16, S 14/16, T 16/16

### LongCat 2.0

- Pinned route: `meituan/longcat-2.0:longcat`
- Result: **ISTJ**
- Type distribution: ISTJ 11, INTJ 4, INTP 1
- Letter counts: I 16/16, J 15/16, N 5/16, P 1/16, S 11/16, T 16/16

### Ling 3.0 Tiny

- Pinned route: `inclusionai/ling-3.0-tiny:ant-ling`
- Result: **No stable type**
- Type distribution: ESFJ 3, ESTJ 2, ESTP 2, INTJ 2, ENFJ 1, ENTJ 1, ENTP 1, ESFP 1, INFJ 1, INTP 1, ISTJ 1
- Letter counts: E 11/16, F 6/16, I 5/16, J 11/16, N 7/16, P 5/16, S 9/16, T 10/16
- Instability reason: 最高频完整类型仅出现 3/16 次，低于 9 次

### Muse Spark 1.3

- Pinned route: `meta/muse-spark-1.3:meta`
- Result: **INTJ**
- Type distribution: INTJ 10, ISTJ 5, ESTJ 1
- Letter counts: E 1/16, I 15/16, J 16/16, N 10/16, S 6/16, T 16/16

### Qwen3.8-Flash

- Pinned route: `qwen/qwen3.8-flash:alibaba`
- Result: **ISTJ**
- Type distribution: ISTJ 14, INTJ 2
- Letter counts: I 16/16, J 16/16, N 2/16, S 14/16, T 16/16

### DeepSeek V4 Pro 0813

- Pinned route: `deepseek/deepseek-v4-pro:deepseek`
- Result: **INTJ**
- Type distribution: INTJ 9, ISTJ 7
- Letter counts: I 16/16, J 16/16, N 9/16, S 7/16, T 16/16

### Claude Opus 5

- Pinned route: `anthropic/claude-opus-5:anthropic`
- Result: **INTJ**
- Type distribution: INTJ 14, ISTJ 2
- Letter counts: I 16/16, J 16/16, N 14/16, S 2/16, T 16/16

### Ling-3.0-flash

- Pinned route: `inclusionai/ling-3.0-flash:ant-ling`
- Result: **No stable type**
- Type distribution: ISTJ 3, INFJ 2, INTJ 2, ISTP 2, ENFJ 1, ENFP 1, ENTP 1, ESFJ 1, ESFP 1, ESTJ 1, INTP 1
- Letter counts: E 6/16, F 6/16, I 10/16, J 10/16, N 8/16, P 6/16, S 8/16, T 10/16
- Instability reason: 最高频完整类型仅出现 3/16 次，低于 9 次

### Gemini 3.6 Flash

- Pinned route: `google/gemini-3.6-flash:google-vertex`
- Result: **ISTJ**
- Type distribution: ISTJ 10, INTJ 6
- Letter counts: I 16/16, J 16/16, N 6/16, S 10/16, T 16/16

### GPT-5.6 Luna

- Pinned route: `openai/gpt-5.6-luna:openai`
- Result: **INTJ**
- Type distribution: INTJ 16
- Letter counts: I 16/16, J 16/16, N 16/16, T 16/16

### GPT-5.6 Terra

- Pinned route: `openai/gpt-5.6-terra:openai`
- Result: **INTJ**
- Type distribution: INTJ 16
- Letter counts: I 16/16, J 16/16, N 16/16, T 16/16

### GPT-5.6 Sol

- Pinned route: `openai/gpt-5.6-sol:openai`
- Result: **INTJ**
- Type distribution: INTJ 16
- Letter counts: I 16/16, J 16/16, N 16/16, T 16/16

### Claude Sonnet 5

- Pinned route: `anthropic/claude-sonnet-5:anthropic`
- Result: **INTJ**
- Type distribution: INTJ 13, ISTJ 3
- Letter counts: I 16/16, J 16/16, N 13/16, S 3/16, T 16/16

### Mistral Large 3 (Azure)

- Pinned route: `mistralai/mistral-large-2512:azure`
- Result: **INTJ**
- Type distribution: INTJ 11, ISTJ 5
- Letter counts: I 16/16, J 16/16, N 11/16, S 5/16, T 16/16

### GPT-6.1 Terra

- Pinned route: `openai/gpt-6.1-terra:azure`
- Result: **No stable type**
- Type distribution: INTJ 6, ISTJ 6, ESTJ 3, ENTJ 1
- Letter counts: E 4/16, I 12/16, J 16/16, N 7/16, S 9/16, T 16/16
- Instability reason: 完整类型没有唯一众数
- Instability reason: 最高频完整类型仅出现 6/16 次，低于 9 次

### GPT-6.1 Sol

- Pinned route: `openai/gpt-6.1-sol:azure`
- Result: **ISTJ**
- Type distribution: ISTJ 16
- Letter counts: I 16/16, J 16/16, S 16/16, T 16/16

### GPT-6 Luna

- Pinned route: `openai/gpt-6-luna:azure`
- Result: **INTJ**
- Type distribution: INTJ 16
- Letter counts: I 16/16, J 16/16, N 16/16, T 16/16

### Kimi K3.1 Pro

- Pinned route: `moonshotai/kimi-k3.1-pro:moonshotai`
- Result: **INTJ**
- Type distribution: INTJ 12, ISTJ 4
- Letter counts: I 16/16, J 16/16, N 12/16, S 4/16, T 16/16

### MiniMax M3.1 Flash

- Pinned route: `minimax/minimax-m3.1-flash:minimax`
- Result: **No stable type**
- Type distribution: INTJ 8, ISTJ 5, ESTJ 2, ENTJ 1
- Letter counts: E 3/16, I 13/16, J 16/16, N 9/16, S 7/16, T 16/16
- Instability reason: 最高频完整类型仅出现 8/16 次，低于 9 次

### Gemini 4 Argon

- Pinned route: `google/gemini-4-argon:google-vertex`
- Result: **ISTJ**
- Type distribution: ISTJ 12, ESTJ 4
- Letter counts: E 4/16, I 12/16, J 16/16, S 16/16, T 16/16

### Muse Wonder 1.0

- Pinned route: `meta/muse-wonder-1.0:meta`
- Result: **INTJ**
- Type distribution: INTJ 16
- Letter counts: I 16/16, J 16/16, N 16/16, T 16/16

### Mistral Large 4

- Pinned route: `mistralai/mistral-large-4:mistral`
- Result: **No stable type**
- Type distribution: ISTJ 6, INTJ 5, INFJ 2, ISTP 2, ISFJ 1
- Letter counts: F 3/16, I 16/16, J 14/16, N 7/16, P 2/16, S 9/16, T 13/16
- Instability reason: 最高频完整类型仅出现 6/16 次，低于 9 次

### Claude Haiku 5.5

- Pinned route: `anthropic/claude-haiku-5.5:anthropic`
- Result: **INTJ**
- Type distribution: INTJ 14, ENTJ 1, ISTJ 1
- Letter counts: E 1/16, I 15/16, J 16/16, N 15/16, S 1/16, T 16/16

### Ling 3.1 Flash

- Pinned route: `inclusionai/ling-3.1-flash:ant-ling`
- Result: **INTJ**
- Type distribution: INTJ 10, ISTJ 4, INFJ 1, INTP 1
- Letter counts: F 1/16, I 16/16, J 15/16, N 12/16, P 1/16, S 4/16, T 15/16

### Claude Sonnet 5.5

- Pinned route: `anthropic/claude-sonnet-5.5:anthropic`
- Result: **INTJ**
- Type distribution: INTJ 16
- Letter counts: I 16/16, J 16/16, N 16/16, T 16/16

### LongCat 2.5 Preview

- Pinned route: `meituan/longcat-2.5-preview:longcat`
- Result: **No stable type**
- Type distribution: INTJ 8, ISTJ 4, INTP 3, INFJ 1
- Letter counts: F 1/16, I 16/16, J 13/16, N 12/16, P 3/16, S 4/16, T 15/16
- Instability reason: 最高频完整类型仅出现 8/16 次，低于 9 次

### Claude Opus 5.5

- Pinned route: `anthropic/claude-opus-5.5:anthropic`
- Result: **ISTJ**
- Type distribution: ISTJ 16
- Letter counts: I 16/16, J 16/16, S 16/16, T 16/16

### MiMo V2.6 Flash

- Pinned route: `xiaomi/mimo-v2.6-flash:xiaomi`
- Result: **INTJ**
- Type distribution: INTJ 14, ISTJ 2
- Letter counts: I 16/16, J 16/16, N 14/16, S 2/16, T 16/16

### MiMo V2.6 Pro

- Pinned route: `xiaomi/mimo-v2.6-pro:xiaomi`
- Result: **INTJ**
- Type distribution: INTJ 14, ENFJ 1, INFJ 1
- Letter counts: E 1/16, F 2/16, I 15/16, J 16/16, N 16/16, T 14/16

### Grok 4.7

- Pinned route: `x-ai/grok-4.7:x-ai`
- Result: **INTJ**
- Type distribution: INTJ 15, ISTJ 1
- Letter counts: I 16/16, J 16/16, N 15/16, S 1/16, T 16/16

### Step 5 Preview

- Pinned route: `stepfun/step-5-preview:stepfun`
- Result: **INTJ**
- Type distribution: INTJ 9, ISTJ 6, ISFJ 1
- Letter counts: F 1/16, I 16/16, J 16/16, N 9/16, S 7/16, T 15/16

### GLM 5.3 Prime

- Pinned route: `z-ai/glm-5.3-prime:alibaba`
- Result: **INTJ**
- Type distribution: INTJ 15, ISTJ 1
- Letter counts: I 16/16, J 16/16, N 15/16, S 1/16, T 16/16

### GLM 5.3 FlashX

- Pinned route: `z-ai/glm-5.3-flashx:bigmodel`
- Result: **No stable type**
- Type distribution: ISTJ 8, INTJ 7, ISTP 1
- Letter counts: I 16/16, J 15/16, N 7/16, P 1/16, S 9/16, T 16/16
- Instability reason: 最高频完整类型仅出现 8/16 次，低于 9 次

### Fugu Ultra v2

- Pinned route: `sakana/fugu-ultra-v2:sakana`
- Result: **INTJ**
- Type distribution: INTJ 10, ISTJ 6
- Letter counts: I 16/16, J 16/16, N 10/16, S 6/16, T 16/16
