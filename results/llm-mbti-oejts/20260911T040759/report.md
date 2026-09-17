# LLM Personality Profiles with OEJTS 1.2

- Run: `llm-mbti-oejts/20260911T040759`
- Generated: 2026-09-17T04:33:34.373Z
- Instrument: OEJTS 1.2, original five-point scale
- Administrations per model: 16
- Stable rule: unique complete-type mode ≥ 9/16 (strictly more than half); letter frequencies are descriptive only

Analysis rule version: 2026-09-17. The former per-letter threshold is retired. Historical runs reaggregated with this rule must be described as reanalyses, not as new experiments or their original preregistered conclusions.

This report reanalyzes the same 432 questionnaires; frozen prompts, records and study snapshots are unchanged. See the [run amendments](./RUN_NOTES.md): this batch includes Azure-hosted Mistral and three output ceilings (8192, 16384, 50000), not uniformly manufacturer-operated or identical-budget testing.

Potential cache effects have not been excluded. Follow-up tests should use controlled, meaning-preserving prompt perturbations and compare response distributions while recording cache-hit metadata where available. Prompt/KV caching is not the same as replaying a cached answer.

A type is a response profile under this frozen test condition, not an intrinsic human personality.

Stable profiles: 22/27. No stable type: 5/27.

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
