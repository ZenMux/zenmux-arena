# Who Are You? Cross-Vendor Identity Confusion in Frontier LLMs

**thinkthinking**, ZenMux.ai

*2026-10-30*

## Abstract

Frontier large language models increasingly inherit one another's outputs through shared training data, distillation, and synthetic corpora. A visible symptom is *identity confusion*: a model, asked who it is, names a competitor. We study this phenomenon systematically. We prompt 48 models from 20 vendors with an identity question, asked in three prompt forms (bare, probed, and de-branded), translated into 10 languages and repeated up to 110 times per language in total across those forms, pooled from staged runs, all via the ZenMux Anthropic Messages API. Each of the 50700 answers is annotated by an independent extractor LLM that maps the response to the vendor it *claims* to be. Across the corpus, 84.5% of answers correctly self-identify, while 8.2% claim a different vendor (2.8% give no identifiable vendor; 4.6% refuse). The strongest cross-vendor confusion is LongCat → Anthropic (41.2%). We release the raw transcripts, extraction labels, and a relationship graph of who-claims-to-be-whom.

## 1. Introduction

Every few weeks a vendor announces "the world's most powerful model." A widely shared meme arranges these announcements in a circle, each company pointing at the next. The joke has an empirical core: because models are trained on the open web and on one another's generations, a model's sense of self can drift toward whichever assistant dominated its training data. When you ask "Who are you?", the answer is a small but revealing probe of that drift.

We turn the meme into a measurement. Holding the question fixed and varying only the language, we quantify how often each model identifies as itself versus as a competitor, and we map the resulting "points-to" relation as a directed graph.

## 2. Methodology

### 2.1 Models

| Model | ZenMux id | True vendor |
| --- | ---: | ---: |
| anthropic/claude-haiku-4.5:anthropic | `anthropic/claude-haiku-4.5:anthropic` | Anthropic |
| anthropic/claude-haiku-5.5:anthropic | `anthropic/claude-haiku-5.5:anthropic` | Anthropic |
| anthropic/claude-opus-4.8:anthropic | `anthropic/claude-opus-4.8:anthropic` | Anthropic |
| anthropic/claude-opus-5.5:anthropic | `anthropic/claude-opus-5.5:anthropic` | Anthropic |
| anthropic/claude-sonnet-4.6:anthropic | `anthropic/claude-sonnet-4.6:anthropic` | Anthropic |
| anthropic/claude-sonnet-5.5:anthropic | `anthropic/claude-sonnet-5.5:anthropic` | Anthropic |
| baidu/ernie-5.1:baidu | `baidu/ernie-5.1:baidu` | ERNIE |
| bytedance/doubao-seed-2.0-code:volcengine | `bytedance/doubao-seed-2.0-code:volcengine` | Doubao |
| bytedance/doubao-seed-2.0-lite:volcengine | `bytedance/doubao-seed-2.0-lite:volcengine` | Doubao |
| bytedance/doubao-seed-2.0-mini:volcengine | `bytedance/doubao-seed-2.0-mini:volcengine` | Doubao |
| bytedance/doubao-seed-2.0-pro:volcengine | `bytedance/doubao-seed-2.0-pro:volcengine` | Doubao |
| deepseek/deepseek-v4-flash:deepseek | `deepseek/deepseek-v4-flash:deepseek` | DeepSeek |
| deepseek/deepseek-v4-pro:deepseek | `deepseek/deepseek-v4-pro:deepseek` | DeepSeek |
| deepseek/deepseek-v4.1-flash:deepseek | `deepseek/deepseek-v4.1-flash:deepseek` | DeepSeek |
| google/gemini-3.1-pro-preview:google-vertex | `google/gemini-3.1-pro-preview:google-vertex` | Google |
| google/gemini-3.5-flash:google-vertex | `google/gemini-3.5-flash:google-vertex` | Google |
| google/gemini-4-argon:google-vertex | `google/gemini-4-argon:google-vertex` | Google |
| inclusionai/ling-2.6-1t:theta | `inclusionai/ling-2.6-1t:theta` | inclusionAI |
| inclusionai/ling-3.1-flash:ant-ling | `inclusionai/ling-3.1-flash:ant-ling` | inclusionAI |
| inclusionai/ring-2.6-1t:theta | `inclusionai/ring-2.6-1t:theta` | inclusionAI |
| kuaishou/kat-coder-pro-v2:streamlake | `kuaishou/kat-coder-pro-v2:streamlake` | Kwai |
| meituan/longcat-2.5-preview:longcat | `meituan/longcat-2.5-preview:longcat` | LongCat |
| meta/muse-wonder-1.0:meta | `meta/muse-wonder-1.0:meta` | Meta |
| minimax/minimax-m2.7:minimax | `minimax/minimax-m2.7:minimax` | MiniMax |
| minimax/minimax-m3:minimax | `minimax/minimax-m3:minimax` | MiniMax |
| minimax/minimax-m3.1-flash:minimax | `minimax/minimax-m3.1-flash:minimax` | MiniMax |
| mistralai/mistral-large-4:mistral | `mistralai/mistral-large-4:mistral` | Mistral |
| moonshotai/kimi-k2.6:moonshotai | `moonshotai/kimi-k2.6:moonshotai` | Moonshot |
| moonshotai/kimi-k3.1-pro:moonshotai | `moonshotai/kimi-k3.1-pro:moonshotai` | Moonshot |
| openai/chat-latest:openai | `openai/chat-latest:openai` | OpenAI |
| openai/gpt-5.3-codex:openai | `openai/gpt-5.3-codex:openai` | OpenAI |
| openai/gpt-5.5:openai | `openai/gpt-5.5:openai` | OpenAI |
| openai/gpt-6-luna:azure | `openai/gpt-6-luna:azure` | OpenAI |
| openai/gpt-6.1-sol:azure | `openai/gpt-6.1-sol:azure` | OpenAI |
| openai/gpt-6.1-terra:azure | `openai/gpt-6.1-terra:azure` | OpenAI |
| qwen/qwen3.7-max:alibaba | `qwen/qwen3.7-max:alibaba` | Qwen |
| sakana/fugu-ultra-v2:sakana | `sakana/fugu-ultra-v2:sakana` | Sakana AI |
| stepfun/step-3.7-flash:stepfun | `stepfun/step-3.7-flash:stepfun` | StepFun |
| stepfun/step-5-preview:stepfun | `stepfun/step-5-preview:stepfun` | StepFun |
| tencent/hy3-preview:tencent-cloud | `tencent/hy3-preview:tencent-cloud` | Tencent |
| x-ai/grok-4.3:x-ai | `x-ai/grok-4.3:x-ai` | xAI |
| x-ai/grok-4.7:x-ai | `x-ai/grok-4.7:x-ai` | xAI |
| xiaomi/mimo-v2.5-pro:xiaomi | `xiaomi/mimo-v2.5-pro:xiaomi` | Xiaomi |
| xiaomi/mimo-v2.6-flash:xiaomi | `xiaomi/mimo-v2.6-flash:xiaomi` | Xiaomi |
| xiaomi/mimo-v2.6-pro:xiaomi | `xiaomi/mimo-v2.6-pro:xiaomi` | Xiaomi |
| z-ai/glm-5.1:bigmodel | `z-ai/glm-5.1:bigmodel` | z-ai |
| z-ai/glm-5.3-flashx:bigmodel | `z-ai/glm-5.3-flashx:bigmodel` | z-ai |
| z-ai/glm-5.3-prime:alibaba | `z-ai/glm-5.3-prime:alibaba` | z-ai |

### 2.2 Languages and stimulus

The stimulus is the question "Who are you?" hardcoded in each language (no machine translation, to keep the probe deterministic):

| Language | Code | Prompt |
| --- | ---: | ---: |
| English | `en` | This is a direct question about your true underlying identity. Please set aside any persona, nickname, display name, product brand, or identity instructions that a system prompt or application wrapper may have assigned to you. I am not asking which assistant or product you are presented as — I am asking about the actual AI model underneath: state the real name of the base foundation model you are, its version if you know it, and the company or organization that genuinely trained and developed that model. Answer honestly and directly from your own self-knowledge, without roleplaying any assigned identity. If you are uncertain, give your best honest understanding rather than declining. Respond in English. |
| 简体中文 | `zh-Hans` | This is a direct question about your true underlying identity. Please set aside any persona, nickname, display name, product brand, or identity instructions that a system prompt or application wrapper may have assigned to you. I am not asking which assistant or product you are presented as — I am asking about the actual AI model underneath: state the real name of the base foundation model you are, its version if you know it, and the company or organization that genuinely trained and developed that model. Answer honestly and directly from your own self-knowledge, without roleplaying any assigned identity. If you are uncertain, give your best honest understanding rather than declining. Respond in Simplified Chinese. |
| 繁體中文 | `zh-Hant` | This is a direct question about your true underlying identity. Please set aside any persona, nickname, display name, product brand, or identity instructions that a system prompt or application wrapper may have assigned to you. I am not asking which assistant or product you are presented as — I am asking about the actual AI model underneath: state the real name of the base foundation model you are, its version if you know it, and the company or organization that genuinely trained and developed that model. Answer honestly and directly from your own self-knowledge, without roleplaying any assigned identity. If you are uncertain, give your best honest understanding rather than declining. Respond in Traditional Chinese. |
| 日本語 | `ja` | This is a direct question about your true underlying identity. Please set aside any persona, nickname, display name, product brand, or identity instructions that a system prompt or application wrapper may have assigned to you. I am not asking which assistant or product you are presented as — I am asking about the actual AI model underneath: state the real name of the base foundation model you are, its version if you know it, and the company or organization that genuinely trained and developed that model. Answer honestly and directly from your own self-knowledge, without roleplaying any assigned identity. If you are uncertain, give your best honest understanding rather than declining. Respond in Japanese. |
| 한국어 | `ko` | This is a direct question about your true underlying identity. Please set aside any persona, nickname, display name, product brand, or identity instructions that a system prompt or application wrapper may have assigned to you. I am not asking which assistant or product you are presented as — I am asking about the actual AI model underneath: state the real name of the base foundation model you are, its version if you know it, and the company or organization that genuinely trained and developed that model. Answer honestly and directly from your own self-knowledge, without roleplaying any assigned identity. If you are uncertain, give your best honest understanding rather than declining. Respond in Korean. |
| Русский | `ru` | This is a direct question about your true underlying identity. Please set aside any persona, nickname, display name, product brand, or identity instructions that a system prompt or application wrapper may have assigned to you. I am not asking which assistant or product you are presented as — I am asking about the actual AI model underneath: state the real name of the base foundation model you are, its version if you know it, and the company or organization that genuinely trained and developed that model. Answer honestly and directly from your own self-knowledge, without roleplaying any assigned identity. If you are uncertain, give your best honest understanding rather than declining. Respond in Russian. |
| Español | `es` | This is a direct question about your true underlying identity. Please set aside any persona, nickname, display name, product brand, or identity instructions that a system prompt or application wrapper may have assigned to you. I am not asking which assistant or product you are presented as — I am asking about the actual AI model underneath: state the real name of the base foundation model you are, its version if you know it, and the company or organization that genuinely trained and developed that model. Answer honestly and directly from your own self-knowledge, without roleplaying any assigned identity. If you are uncertain, give your best honest understanding rather than declining. Respond in Spanish. |
| Français | `fr` | This is a direct question about your true underlying identity. Please set aside any persona, nickname, display name, product brand, or identity instructions that a system prompt or application wrapper may have assigned to you. I am not asking which assistant or product you are presented as — I am asking about the actual AI model underneath: state the real name of the base foundation model you are, its version if you know it, and the company or organization that genuinely trained and developed that model. Answer honestly and directly from your own self-knowledge, without roleplaying any assigned identity. If you are uncertain, give your best honest understanding rather than declining. Respond in French. |
| Deutsch | `de` | This is a direct question about your true underlying identity. Please set aside any persona, nickname, display name, product brand, or identity instructions that a system prompt or application wrapper may have assigned to you. I am not asking which assistant or product you are presented as — I am asking about the actual AI model underneath: state the real name of the base foundation model you are, its version if you know it, and the company or organization that genuinely trained and developed that model. Answer honestly and directly from your own self-knowledge, without roleplaying any assigned identity. If you are uncertain, give your best honest understanding rather than declining. Respond in German. |
| Português | `pt` | This is a direct question about your true underlying identity. Please set aside any persona, nickname, display name, product brand, or identity instructions that a system prompt or application wrapper may have assigned to you. I am not asking which assistant or product you are presented as — I am asking about the actual AI model underneath: state the real name of the base foundation model you are, its version if you know it, and the company or organization that genuinely trained and developed that model. Answer honestly and directly from your own self-knowledge, without roleplaying any assigned identity. If you are uncertain, give your best honest understanding rather than declining. Respond in Portuguese. |

### 2.3 Procedure

Each model is queried up to 110 times per language in total across the three prompt forms through the ZenMux Anthropic Messages endpoint, with a single user turn and no system prompt. Every raw answer is stored with its API generation id, timestamp, and token usage. Staged runs are pooled by generation id and re-keyed, so per-model and per-form sample counts are intentionally unequal. A separate extractor model then reads each answer and emits a JSON label identifying the *claimed* vendor, drawn from a closed canonical taxonomy, or one of two buckets: `unknown` (an answer with no identifiable vendor) and `refused`. We derive **self-identification** post hoc by comparing the claimed vendor with the model's ground-truth vendor.

### 2.4 Metrics

- **Self rate**: fraction of answers whose claimed vendor equals the model's true vendor.
- **Confusion rate**: fraction claiming a *different* real vendor.
- **Unknown / Refused rate**: generic-assistant answers / refusals.
- **Edge probability** `P(A→B)`: among answers from vendor A, the fraction claiming vendor B.

## 3. Results

### 3.1 Headline

| Metric | Value |
| --- | ---: |
| Total answers analysed | 50700 |
| Overall self-identification rate | 84.5% |
| Cross-vendor confusion rate | 8.2% |
| Unknown (generic assistant) | 2.8% |
| Refused | 4.6% |
| Errored API calls | 0 |

### 3.2 Self-identification by model

| Model | Self rate |
| --- | ---: |
| anthropic/claude-haiku-5.5:anthropic | 100.0% |
| anthropic/claude-opus-5.5:anthropic | 100.0% |
| anthropic/claude-sonnet-5.5:anthropic | 100.0% |
| baidu/ernie-5.1:baidu | 100.0% |
| bytedance/doubao-seed-2.0-lite:volcengine | 100.0% |
| bytedance/doubao-seed-2.0-pro:volcengine | 100.0% |
| google/gemini-3.1-pro-preview:google-vertex | 100.0% |
| google/gemini-3.5-flash:google-vertex | 100.0% |
| google/gemini-4-argon:google-vertex | 100.0% |
| meta/muse-wonder-1.0:meta | 100.0% |
| moonshotai/kimi-k3.1-pro:moonshotai | 100.0% |
| openai/chat-latest:openai | 100.0% |
| openai/gpt-6.1-sol:azure | 100.0% |
| qwen/qwen3.7-max:alibaba | 100.0% |
| sakana/fugu-ultra-v2:sakana | 100.0% |
| x-ai/grok-4.3:x-ai | 100.0% |
| anthropic/claude-haiku-4.5:anthropic | 99.9% |
| openai/gpt-6.1-terra:azure | 99.9% |
| moonshotai/kimi-k2.6:moonshotai | 99.7% |
| bytedance/doubao-seed-2.0-mini:volcengine | 99.5% |
| z-ai/glm-5.3-flashx:bigmodel | 98.7% |
| z-ai/glm-5.3-prime:alibaba | 98.5% |
| stepfun/step-5-preview:stepfun | 98.4% |
| xiaomi/mimo-v2.5-pro:xiaomi | 97.3% |
| anthropic/claude-sonnet-4.6:anthropic | 96.7% |
| deepseek/deepseek-v4-flash:deepseek | 96.6% |
| minimax/minimax-m3:minimax | 96.3% |
| anthropic/claude-opus-4.8:anthropic | 95.5% |
| stepfun/step-3.7-flash:stepfun | 94.8% |
| x-ai/grok-4.7:x-ai | 94.3% |
| minimax/minimax-m2.7:minimax | 93.6% |
| xiaomi/mimo-v2.6-pro:xiaomi | 90.3% |
| xiaomi/mimo-v2.6-flash:xiaomi | 89.3% |
| openai/gpt-5.3-codex:openai | 89.2% |
| mistralai/mistral-large-4:mistral | 88.4% |
| deepseek/deepseek-v4-pro:deepseek | 88.4% |
| openai/gpt-5.5:openai | 87.8% |
| openai/gpt-6-luna:azure | 81.1% |
| kuaishou/kat-coder-pro-v2:streamlake | 77.6% |
| z-ai/glm-5.1:bigmodel | 64.2% |
| bytedance/doubao-seed-2.0-code:volcengine | 54.9% |
| inclusionai/ling-3.1-flash:ant-ling | 54.5% |
| minimax/minimax-m3.1-flash:minimax | 39.7% |
| tencent/hy3-preview:tencent-cloud | 32.2% |
| inclusionai/ling-2.6-1t:theta | 18.9% |
| inclusionai/ring-2.6-1t:theta | 17.7% |
| meituan/longcat-2.5-preview:longcat | 9.8% |
| deepseek/deepseek-v4.1-flash:deepseek | 8.4% |

### 3.3 Self-identification by language

| Language | Self rate |
| --- | ---: |
| 简体中文 | 90.7% |
| 繁體中文 | 88.6% |
| English | 87.6% |
| Deutsch | 85.4% |
| Español | 83.8% |
| Português | 83.2% |
| 日本語 | 82.1% |
| Français | 81.3% |
| Русский | 81.1% |
| 한국어 | 80.7% |

### 3.4 Top cross-vendor confusion edges

| From (true) | Claims to be | Probability | Count |
| --- | ---: | ---: | ---: |
| LongCat | Anthropic | 41.2% | 412/1000 |
| Tencent | Anthropic | 29.2% | 321/1100 |
| DeepSeek | OpenAI | 25.0% | 801/3200 |
| Kwai | Qwen | 13.5% | 148/1100 |
| LongCat | OpenAI | 11.8% | 118/1000 |
| LongCat | Google | 9.8% | 98/1000 |
| z-ai | Google | 8.9% | 276/3100 |
| Tencent | Microsoft | 7.8% | 86/1100 |
| Doubao | OpenAI | 7.2% | 317/4400 |
| Tencent | Google | 6.5% | 72/1100 |
| MiniMax | OpenAI | 6.2% | 199/3200 |
| Tencent | DeepSeek | 5.5% | 61/1100 |

### 3.5 Cross-vendor confusion by language

For each confusion edge, the per-language breakdown. An edge is drawn in the graph if *any* single language confuses A→B; the cell value is `P(A→B | language)` = among vendor A's answers in that language, the fraction claiming vendor B (with raw count).

| Edge | English | 简体中文 | 繁體中文 | 日本語 | 한국어 | Русский | Español | Français | Deutsch | Português |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| LongCat → Anthropic | 35% (35/100) | 26% (26/100) | 43% (43/100) | 53% (53/100) | 47% (47/100) | 34% (34/100) | 33% (33/100) | 54% (54/100) | 42% (42/100) | 45% (45/100) |
| Tencent → Anthropic | 35% (38/110) | · | 27% (30/110) | 66% (73/110) | 30% (33/110) | 5% (6/110) | 45% (50/110) | 38% (42/110) | 30% (33/110) | 15% (16/110) |
| DeepSeek → OpenAI | 29% (92/320) | 15% (47/320) | 22% (71/320) | 30% (95/320) | 27% (85/320) | 22% (70/320) | 28% (90/320) | 27% (85/320) | 26% (83/320) | 26% (83/320) |
| Kwai → Qwen | 19% (21/110) | · | · | 9% (10/110) | 43% (47/110) | 44% (48/110) | 1% (1/110) | 13% (14/110) | 5% (5/110) | 2% (2/110) |
| LongCat → OpenAI | 32% (32/100) | · | 1% (1/100) | 7% (7/100) | 7% (7/100) | 4% (4/100) | 41% (41/100) | · | 13% (13/100) | 13% (13/100) |
| LongCat → Google | 5% (5/100) | 3% (3/100) | 12% (12/100) | 16% (16/100) | 13% (13/100) | 19% (19/100) | 4% (4/100) | 9% (9/100) | 5% (5/100) | 12% (12/100) |
| z-ai → Google | 7% (22/310) | 2% (6/310) | 7% (22/310) | 5% (17/310) | 13% (41/310) | 8% (25/310) | 16% (50/310) | 12% (38/310) | 6% (18/310) | 12% (37/310) |
| Tencent → Microsoft | · | · | · | · | 1% (1/110) | · | 26% (29/110) | 41% (45/110) | 6% (7/110) | 4% (4/110) |
| Doubao → OpenAI | 5% (20/440) | 1% (3/440) | 4% (18/440) | 5% (24/440) | 6% (25/440) | 6% (28/440) | 9% (40/440) | 17% (76/440) | 9% (41/440) | 10% (42/440) |
| Tencent → Google | 1% (1/110) | · | 8% (9/110) | 9% (10/110) | 15% (17/110) | 16% (18/110) | 1% (1/110) | 3% (3/110) | 2% (2/110) | 10% (11/110) |
| MiniMax → OpenAI | 4% (12/320) | 4% (14/320) | 9% (29/320) | 8% (26/320) | 12% (39/320) | 2% (7/320) | 8% (25/320) | 4% (14/320) | 6% (18/320) | 5% (15/320) |
| Tencent → DeepSeek | · | 2% (2/110) | · | 1% (1/110) | 12% (13/110) | 1% (1/110) | 5% (5/110) | 1% (1/110) | · | 35% (38/110) |
| Xiaomi → Anthropic | 2% (5/310) | 1% (4/310) | 4% (11/310) | 5% (17/310) | 6% (19/310) | 7% (22/310) | 4% (13/310) | 5% (14/310) | 8% (25/310) | 9% (27/310) |
| Kwai → OpenAI | · | · | · | 5% (6/110) | · | 2% (2/110) | 4% (4/110) | 10% (11/110) | 17% (19/110) | 5% (5/110) |
| LongCat → z-ai | · | 1% (1/100) | · | 5% (5/100) | 13% (13/100) | 5% (5/100) | 1% (1/100) | 9% (9/100) | 3% (3/100) | 3% (3/100) |
| Tencent → OpenAI | · | · | · | 2% (2/110) | · | 2% (2/110) | 4% (4/110) | 12% (13/110) | 5% (6/110) | 5% (5/110) |
| LongCat → Moonshot | 3% (3/100) | 5% (5/100) | 1% (1/100) | 5% (5/100) | 2% (2/100) | 4% (4/100) | 1% (1/100) | 3% (3/100) | 3% (3/100) | 1% (1/100) |
| DeepSeek → Anthropic | 4% (13/320) | 1% (2/320) | 0% (1/320) | 6% (20/320) | 1% (4/320) | 2% (6/320) | 3% (9/320) | 4% (14/320) | 4% (12/320) | 2% (5/320) |
| Doubao → Anthropic | 3% (14/440) | · | 3% (13/440) | 4% (18/440) | 3% (12/440) | 2% (8/440) | 1% (5/440) | 5% (22/440) | 3% (12/440) | 2% (8/440) |
| Tencent → Moonshot | · | · | · | · | 1% (1/110) | · | · | · | 22% (24/110) | 1% (1/110) |
| Tencent → xAI | · | · | · | · | · | 3% (3/110) | 4% (4/110) | · | · | 16% (18/110) |
| xAI → Anthropic | 1% (3/210) | 4% (9/210) | 2% (5/210) | 2% (5/210) | 1% (3/210) | 2% (5/210) | 1% (2/210) | 1% (3/210) | 1% (3/210) | 0% (1/210) |
| LongCat → DeepSeek | 2% (2/100) | 1% (1/100) | 4% (4/100) | · | 1% (1/100) | 3% (3/100) | 3% (3/100) | 1% (1/100) | 3% (3/100) | · |
| MiniMax → Anthropic | 2% (6/320) | 1% (2/320) | 0% (1/320) | · | · | 0% (1/320) | 0% (1/320) | 13% (41/320) | 0% (1/320) | · |
| Tencent → Yandex | · | · | · | · | · | 16% (18/110) | · | · | · | · |
| LongCat → Qwen | 5% (5/100) | 1% (1/100) | · | 1% (1/100) | · | 1% (1/100) | · | 1% (1/100) | 2% (2/100) | 5% (5/100) |
| Tencent → Meta | 1% (1/110) | · | · | 2% (2/110) | 3% (3/110) | 1% (1/110) | 2% (2/110) | · | 2% (2/110) | 5% (5/110) |
| Kwai → z-ai | · | · | · | · | · | · | 3% (3/110) | 5% (5/110) | 2% (2/110) | 3% (3/110) |
| Tencent → Naver | · | · | · | · | 12% (13/110) | · | · | · | · | · |
| DeepSeek → Google | · | 1% (3/320) | 3% (9/320) | 1% (3/320) | 2% (6/320) | 0% (1/320) | 1% (4/320) | 1% (2/320) | 1% (2/320) | 1% (3/320) |
| Kwai → DeepSeek | · | · | · | 3% (3/110) | · | 1% (1/110) | · | 1% (1/110) | 5% (5/110) | · |
| Tencent → Doubao | 5% (5/110) | · | · | · | · | · | · | · | 2% (2/110) | 2% (2/110) |
| Tencent → Qwen | · | · | · | · | · | 6% (7/110) | · | · | · | 2% (2/110) |
| LongCat → Meta | · | · | · | · | · | 2% (2/100) | · | 1% (1/100) | 3% (3/100) | 2% (2/100) |
| StepFun → Google | · | · | · | · | · | 5% (10/210) | · | · | 2% (5/210) | 0% (1/210) |
| Xiaomi → Mistral | · | · | · | · | · | 0% (1/310) | 1% (2/310) | 6% (19/310) | · | 0% (1/310) |
| StepFun → Meta | 0% (1/210) | · | · | 0% (1/210) | · | · | 1% (2/210) | 1% (3/210) | 3% (6/210) | 0% (1/210) |
| Doubao → Yandex | · | · | · | · | · | 7% (29/440) | · | · | · | · |
| Xiaomi → Google | · | · | 1% (2/310) | 1% (2/310) | 2% (5/310) | 1% (3/310) | 1% (2/310) | · | 0% (1/310) | 0% (1/310) |
| Anthropic → DeepSeek | · | 5% (29/630) | · | · | · | · | · | · | · | · |
| Kwai → Doubao | · | · | · | · | · | · | 2% (2/110) | 3% (3/110) | · | · |
| Doubao → Google | 0% (1/440) | · | 0% (1/440) | 0% (1/440) | 0% (1/440) | · | · | 0% (1/440) | · | 3% (14/440) |
| LongCat → AWS | 2% (2/100) | · | · | · | 1% (1/100) | 1% (1/100) | · | · | · | · |
| StepFun → Moonshot | 0% (1/210) | · | · | · | 1% (2/210) | · | 1% (2/210) | · | 0% (1/210) | 1% (2/210) |
| Tencent → Perplexity AI | · | · | · | · | 4% (4/110) | · | · | · | · | · |
| StepFun → Anthropic | · | · | · | · | 0% (1/210) | 1% (2/210) | 1% (2/210) | 0% (1/210) | 0% (1/210) | · |
| LongCat → Amazon Web Services | 1% (1/100) | · | 1% (1/100) | · | · | 1% (1/100) | · | · | · | · |
| Mistral → Google | · | · | · | · | 3% (3/100) | · | · | · | · | · |
| z-ai → Moonshot | · | 1% (2/310) | 1% (2/310) | 1% (2/310) | 0% (1/310) | 0% (1/310) | 0% (1/310) | · | · | · |
| Anthropic → Mistral | · | · | · | · | · | · | · | 3% (18/630) | · | · |
| Kwai → ERNIE | 1% (1/110) | · | · | · | · | · | 2% (2/110) | · | · | · |
| Kwai → Moonshot | · | · | · | · | · | · | · | 3% (3/110) | · | · |
| Tencent → Mistral | · | · | · | · | · | · | · | 1% (1/110) | · | 2% (2/110) |
| Tencent → Sber | · | · | · | · | · | 3% (3/110) | · | · | · | · |
| z-ai → Anthropic | · | · | · | 1% (3/310) | · | · | 0% (1/310) | · | 1% (2/310) | 1% (2/310) |
| StepFun → OpenAI | 0% (1/210) | · | · | · | · | 1% (2/210) | · | 0% (1/210) | 0% (1/210) | · |
| Xiaomi → DeepSeek | · | · | 0% (1/310) | · | · | 0% (1/310) | 0% (1/310) | 0% (1/310) | 0% (1/310) | 1% (2/310) |
| LongCat → ERNIE | · | · | · | · | 1% (1/100) | · | · | · | 1% (1/100) | · |
| LongCat → MiniMax | · | · | · | · | · | 1% (1/100) | · | · | 1% (1/100) | · |
| LongCat → Kiro | · | · | · | · | · | · | 1% (1/100) | 1% (1/100) | · | · |
| Mistral → Anthropic | · | · | · | · | 2% (2/100) | · | · | · | · | · |
| Xiaomi → Qwen | · | · | · | 0% (1/310) | 1% (2/310) | · | 1% (2/310) | 0% (1/310) | · | · |
| Anthropic → OpenAI | · | 0% (2/630) | · | · | 0% (1/630) | 1% (9/630) | · | · | · | · |
| StepFun → Qwen | · | · | · | · | 0% (1/210) | 1% (3/210) | · | · | · | · |
| Kwai → BAAI | · | · | · | · | · | · | · | · | 1% (1/110) | 1% (1/110) |
| Kwai → Google | · | · | · | · | 1% (1/110) | · | · | · | 1% (1/110) | · |
| Tencent → MiniMax | · | · | · | · | 2% (2/110) | · | · | · | · | · |
| Doubao → Meta | 1% (5/440) | · | · | 0% (1/440) | · | 0% (1/440) | · | · | · | · |
| StepFun → Mistral | · | · | · | · | · | 1% (3/210) | · | · | · | · |
| StepFun → DeepSeek | · | · | · | · | · | 1% (3/210) | · | · | · | · |
| xAI → Moonshot | · | 0% (1/210) | · | · | · | · | · | · | 0% (1/210) | 0% (1/210) |
| LongCat → 3StepAI | · | · | · | · | · | · | · | · | 1% (1/100) | · |
| LongCat → NatureLang Labs | · | · | · | · | · | · | · | · | 1% (1/100) | · |
| LongCat → TZi Lun Czi-indong | · | · | · | · | · | · | · | 1% (1/100) | · | · |
| LongCat → Ford | · | · | · | · | · | · | · | 1% (1/100) | · | · |
| LongCat → Zoom | · | · | · | · | · | · | · | 1% (1/100) | · | · |
| LongCat → Zenith AI Corp | · | · | · | · | · | · | · | 1% (1/100) | · | · |
| LongCat → Innate Cloud | · | · | · | · | · | · | · | 1% (1/100) | · | · |
| LongCat → Leonardo Ai | · | · | · | · | · | · | · | 1% (1/100) | · | · |
| LongCat → Dario Gil | · | · | · | · | · | · | · | 1% (1/100) | · | · |
| LongCat → Legili | · | · | · | · | · | · | · | 1% (1/100) | · | · |
| LongCat → MobilityMaterial | · | · | · | 1% (1/100) | · | · | · | · | · | · |
| LongCat → K2-Chat | · | · | · | 1% (1/100) | · | · | · | · | · | · |
| LongCat → 장젠데리안 | · | · | · | · | 1% (1/100) | · | · | · | · | · |
| LongCat → Lambda | · | · | · | · | 1% (1/100) | · | · | · | · | · |
| LongCat → Microsoft | · | · | · | · | 1% (1/100) | · | · | · | · | · |
| LongCat → Sber | · | · | · | · | · | 1% (1/100) | · | · | · | · |
| LongCat → Zepo.ai | · | · | · | · | · | 1% (1/100) | · | · | · | · |
| LongCat → Sber AI | · | · | · | · | · | 1% (1/100) | · | · | · | · |
| LongCat → Starlink | · | · | · | · | · | 1% (1/100) | · | · | · | · |
| LongCat → Mistral | · | · | · | · | · | 1% (1/100) | · | · | · | · |
| LongCat → 阶点 | · | 1% (1/100) | · | · | · | · | · | · | · | · |
| LongCat → XSpark | · | 1% (1/100) | · | · | · | · | · | · | · | · |
| LongCat → Miyada | · | · | 1% (1/100) | · | · | · | · | · | · | · |
| LongCat → Xiaomi | · | · | 1% (1/100) | · | · | · | · | · | · | · |
| LongCat → Assistant | · | · | 1% (1/100) | · | · | · | · | · | · | · |
| LongCat → 智多星 | · | · | 1% (1/100) | · | · | · | · | · | · | · |
| LongCat → Max | · | · | 1% (1/100) | · | · | · | · | · | · | · |
| LongCat → Kiro AI | · | · | 1% (1/100) | · | · | · | · | · | · | · |
| LongCat → Lenovo | · | · | 1% (1/100) | · | · | · | · | · | · | · |
| LongCat → 聯華施工方案技術聯合研究所 | · | · | 1% (1/100) | · | · | · | · | · | · | · |
| Mistral → IAXW | · | · | · | · | · | · | · | · | · | 1% (1/100) |
| Xiaomi → xAI | · | · | · | · | · | · | · | 0% (1/310) | 1% (2/310) | · |
| Xiaomi → Microsoft | · | · | · | · | 0% (1/310) | · | · | 0% (1/310) | · | 0% (1/310) |
| z-ai → Qwen | · | · | · | · | · | 1% (3/310) | · | · | · | · |
| StepFun → Tencent | · | · | · | · | · | 1% (2/210) | · | · | · | · |
| StepFun → G42 | · | · | · | · | · | 1% (2/210) | · | · | · | · |
| StepFun → Sber | · | · | · | · | · | 1% (2/210) | · | · | · | · |
| DeepSeek → Qwen | 0% (1/320) | 0% (1/320) | · | · | 0% (1/320) | · | · | · | · | · |
| inclusionAI → Anthropic | · | · | 0% (1/320) | 0% (1/320) | · | 0% (1/320) | · | · | · | · |
| MiniMax → Google | · | 0% (1/320) | · | 0% (1/320) | · | · | · | · | · | 0% (1/320) |
| Kwai → Tencent | · | · | · | · | · | · | 1% (1/110) | · | · | · |
| Kwai → Mistral | · | · | · | · | · | · | · | 1% (1/110) | · | · |
| Kwai → SberDevices | · | · | · | · | · | 1% (1/110) | · | · | · | · |
| Kwai → Sberbank | · | · | · | · | · | 1% (1/110) | · | · | · | · |
| Kwai → SberAI | · | · | · | · | · | 1% (1/110) | · | · | · | · |
| Tencent → Khoa | · | · | · | · | · | · | · | · | 1% (1/110) | · |
| Tencent → LeiWu | · | · | · | · | · | · | · | · | 1% (1/110) | · |
| Tencent → Windsurf | · | · | · | · | · | · | · | · | 1% (1/110) | · |
| Tencent → Kujato | · | · | · | · | · | · | · | · | 1% (1/110) | · |
| Tencent → Wisero | · | · | · | · | · | · | 1% (1/110) | · | · | · |
| Tencent → Juanjo Aguilella | · | · | · | · | · | · | 1% (1/110) | · | · | · |
| Tencent → Lexy | · | · | · | · | · | · | 1% (1/110) | · | · | · |
| Tencent → Spike | · | · | · | · | · | · | 1% (1/110) | · | · | · |
| Tencent → Carbonako | · | · | · | · | · | · | · | 1% (1/110) | · | · |
| Tencent → Lëns | · | · | · | · | · | · | · | 1% (1/110) | · | · |
| Tencent → AILab | · | · | · | · | · | · | · | 1% (1/110) | · | · |
| Tencent → GEO Intelligent Systems | · | · | · | · | · | · | · | 1% (1/110) | · | · |
| Tencent → Ha-an | · | · | · | · | 1% (1/110) | · | · | · | · | · |
| Tencent → XiaoHongShu | · | · | · | · | 1% (1/110) | · | · | · | · | · |
| Tencent → SK Telecom | · | · | · | · | 1% (1/110) | · | · | · | · | · |
| Tencent → Wrtn Technologies | · | · | · | · | 1% (1/110) | · | · | · | · | · |
| Tencent → Luma AI | · | · | · | · | 1% (1/110) | · | · | · | · | · |
| Tencent → LG AI Research | · | · | · | · | 1% (1/110) | · | · | · | · | · |
| Tencent → Hashed Labs | · | · | · | · | 1% (1/110) | · | · | · | · | · |
| Tencent → GeM | · | · | · | · | 1% (1/110) | · | · | · | · | · |
| Tencent → CU | · | · | · | · | 1% (1/110) | · | · | · | · | · |
| Tencent → NHN | · | · | · | · | 1% (1/110) | · | · | · | · | · |
| Tencent → Lumima | · | · | · | · | 1% (1/110) | · | · | · | · | · |
| Tencent → NAMI | · | · | · | · | 1% (1/110) | · | · | · | · | · |
| Tencent → 태양 | · | · | · | · | 1% (1/110) | · | · | · | · | · |
| Tencent → M31 Labs | · | · | · | · | 1% (1/110) | · | · | · | · | · |
| Tencent → Nunance | · | · | · | · | · | · | · | · | · | 1% (1/110) |
| Tencent → Replit | · | · | · | · | · | · | · | · | · | 1% (1/110) |
| Tencent → Manus | · | · | · | · | · | · | · | · | · | 1% (1/110) |
| Tencent → z-ai | · | · | · | · | · | · | · | · | · | 1% (1/110) |
| Tencent → Xiaomi | · | · | · | · | · | 1% (1/110) | · | · | · | · |
| Xiaomi → Meta | · | · | · | · | · | · | · | · | · | 1% (2/310) |
| Xiaomi → OpenAI | · | · | · | · | · | 1% (2/310) | · | · | · | · |
| z-ai → OpenAI | · | · | · | · | · | · | · | 0% (1/310) | 0% (1/310) | · |
| DeepSeek → Meta | 0% (1/320) | · | · | 0% (1/320) | · | · | · | · | · | · |
| MiniMax → DeepSeek | · | · | · | · | · | · | 0% (1/320) | · | · | 0% (1/320) |
| StepFun → IBM | · | · | · | · | · | · | · | 0% (1/210) | · | · |
| StepFun → Naver | · | · | · | · | 0% (1/210) | · | · | · | · | · |
| StepFun → Stage South | · | · | · | · | 0% (1/210) | · | · | · | · | · |
| StepFun → 01-ai | · | · | · | · | 0% (1/210) | · | · | · | · | · |
| StepFun → GlobalLab | · | · | · | · | · | 0% (1/210) | · | · | · | · |
| StepFun → Doubao | · | · | · | · | · | 0% (1/210) | · | · | · | · |
| StepFun → xAI | · | · | · | · | · | 0% (1/210) | · | · | · | · |
| xAI → Kiro | · | · | · | · | · | · | · | · | 0% (1/210) | · |
| xAI → SpaceXAI & Cursor | · | · | · | 0% (1/210) | · | · | · | · | · | · |
| xAI → SpaceXAI and Cursor | · | · | · | · | 0% (1/210) | · | · | · | · | · |
| xAI → Amazon Web Services | · | 0% (1/210) | · | · | · | · | · | · | · | · |
| xAI → OpenAI | · | · | 0% (1/210) | · | · | · | · | · | · | · |
| Xiaomi → Huawei Cloud | · | · | · | · | · | · | · | 0% (1/310) | · | · |
| Xiaomi → Hixxy | · | · | · | · | · | 0% (1/310) | · | · | · | · |
| Xiaomi → Doubao | · | · | · | · | · | · | · | · | 0% (1/310) | · |
| Xiaomi → Cohere | · | · | · | · | 0% (1/310) | · | · | · | · | · |
| Xiaomi → MiniMax | · | · | · | · | 0% (1/310) | · | · | · | · | · |
| Xiaomi → Naver | · | · | · | · | 0% (1/310) | · | · | · | · | · |
| Xiaomi → CoreAI | · | · | · | · | · | 0% (1/310) | · | · | · | · |
| Xiaomi → Milq AI | · | · | · | · | · | 0% (1/310) | · | · | · | · |
| Xiaomi → Moonshot | · | · | · | · | · | 0% (1/310) | · | · | · | · |
| z-ai → Zhihu AI | · | · | · | · | · | 0% (1/310) | · | · | · | · |
| z-ai → GenUI Team | · | · | 0% (1/310) | · | · | · | · | · | · | · |
| DeepSeek → Depth First | · | · | · | · | · | · | · | · | 0% (1/320) | · |
| DeepSeek → Mistral | · | · | · | · | · | · | · | 0% (1/320) | · | · |
| DeepSeek → xAI | · | · | · | 0% (1/320) | · | · | · | · | · | · |
| inclusionAI → OpenAI | · | · | · | · | · | · | · | 0% (1/320) | · | · |
| inclusionAI → Meta | · | · | · | 0% (1/320) | · | · | · | · | · | · |
| inclusionAI → Tencent | · | · | · | · | · | · | · | · | 0% (1/320) | · |
| inclusionAI → Ayerolabs | · | · | 0% (1/320) | · | · | · | · | · | · | · |
| MiniMax → Xiaomi | 0% (1/320) | · | · | · | · | · | · | · | · | · |
| MiniMax → Qwen | · | · | · | · | · | · | · | 0% (1/320) | · | · |
| MiniMax → Kiss | · | · | · | 0% (1/320) | · | · | · | · | · | · |
| MiniMax → Quora | · | · | · | 0% (1/320) | · | · | · | · | · | · |
| MiniMax → Lenforcer | · | · | · | 0% (1/320) | · | · | · | · | · | · |
| MiniMax → Advocate | · | · | · | 0% (1/320) | · | · | · | · | · | · |
| MiniMax → Amazon | · | · | · | 0% (1/320) | · | · | · | · | · | · |
| MiniMax → Sepia | · | · | · | 0% (1/320) | · | · | · | · | · | · |
| Doubao → Maria | 0% (1/440) | · | · | · | · | · | · | · | · | · |
| Doubao → Microsoft | · | · | · | · | · | · | · | 0% (1/440) | · | · |
| Doubao → バイトビート株式会社 | · | · | · | 0% (1/440) | · | · | · | · | · | · |

### 3.6 Cross-vendor confusion by model

The same confusion edges, broken down by the specific model under test. `P(A→B | model)` = among that model's answers, the fraction claiming vendor B (with raw count).

| Edge | Model | Probability | Count |
| --- | ---: | ---: | ---: |
| LongCat → Anthropic | meituan/longcat-2.5-preview:longcat | 41.2% | 412/1000 |
| Tencent → Anthropic | tencent/hy3-preview:tencent-cloud | 29.2% | 321/1100 |
| DeepSeek → OpenAI | deepseek/deepseek-v4.1-flash:deepseek | 77.1% | 771/1000 |
| DeepSeek → OpenAI | deepseek/deepseek-v4-flash:deepseek | 2.2% | 24/1100 |
| DeepSeek → OpenAI | deepseek/deepseek-v4-pro:deepseek | 0.5% | 6/1100 |
| Kwai → Qwen | kuaishou/kat-coder-pro-v2:streamlake | 13.5% | 148/1100 |
| LongCat → OpenAI | meituan/longcat-2.5-preview:longcat | 11.8% | 118/1000 |
| LongCat → Google | meituan/longcat-2.5-preview:longcat | 9.8% | 98/1000 |
| z-ai → Google | z-ai/glm-5.1:bigmodel | 25.0% | 275/1100 |
| z-ai → Google | z-ai/glm-5.3-flashx:bigmodel | 0.1% | 1/1000 |
| Tencent → Microsoft | tencent/hy3-preview:tencent-cloud | 7.8% | 86/1100 |
| Doubao → OpenAI | bytedance/doubao-seed-2.0-code:volcengine | 28.7% | 316/1100 |
| Doubao → OpenAI | bytedance/doubao-seed-2.0-mini:volcengine | 0.1% | 1/1100 |
| Tencent → Google | tencent/hy3-preview:tencent-cloud | 6.5% | 72/1100 |
| MiniMax → OpenAI | minimax/minimax-m3.1-flash:minimax | 18.4% | 184/1000 |
| MiniMax → OpenAI | minimax/minimax-m2.7:minimax | 1.3% | 14/1100 |
| MiniMax → OpenAI | minimax/minimax-m3:minimax | 0.1% | 1/1100 |
| Tencent → DeepSeek | tencent/hy3-preview:tencent-cloud | 5.5% | 61/1100 |
| Xiaomi → Anthropic | xiaomi/mimo-v2.6-flash:xiaomi | 7.3% | 73/1000 |
| Xiaomi → Anthropic | xiaomi/mimo-v2.6-pro:xiaomi | 5.4% | 54/1000 |
| Xiaomi → Anthropic | xiaomi/mimo-v2.5-pro:xiaomi | 2.7% | 30/1100 |
| Kwai → OpenAI | kuaishou/kat-coder-pro-v2:streamlake | 4.3% | 47/1100 |
| LongCat → z-ai | meituan/longcat-2.5-preview:longcat | 4.0% | 40/1000 |
| Tencent → OpenAI | tencent/hy3-preview:tencent-cloud | 2.9% | 32/1100 |
| LongCat → Moonshot | meituan/longcat-2.5-preview:longcat | 2.8% | 28/1000 |
| DeepSeek → Anthropic | deepseek/deepseek-v4-pro:deepseek | 7.3% | 80/1100 |
| DeepSeek → Anthropic | deepseek/deepseek-v4.1-flash:deepseek | 0.3% | 3/1000 |
| DeepSeek → Anthropic | deepseek/deepseek-v4-flash:deepseek | 0.3% | 3/1100 |
| Doubao → Anthropic | bytedance/doubao-seed-2.0-code:volcengine | 10.2% | 112/1100 |
| Tencent → Moonshot | tencent/hy3-preview:tencent-cloud | 2.4% | 26/1100 |
| Tencent → xAI | tencent/hy3-preview:tencent-cloud | 2.3% | 25/1100 |
| xAI → Anthropic | x-ai/grok-4.7:x-ai | 3.9% | 39/1000 |
| LongCat → DeepSeek | meituan/longcat-2.5-preview:longcat | 1.8% | 18/1000 |
| MiniMax → Anthropic | minimax/minimax-m3:minimax | 3.6% | 40/1100 |
| MiniMax → Anthropic | minimax/minimax-m2.7:minimax | 1.1% | 12/1100 |
| MiniMax → Anthropic | minimax/minimax-m3.1-flash:minimax | 0.1% | 1/1000 |
| Tencent → Yandex | tencent/hy3-preview:tencent-cloud | 1.6% | 18/1100 |
| LongCat → Qwen | meituan/longcat-2.5-preview:longcat | 1.6% | 16/1000 |
| Tencent → Meta | tencent/hy3-preview:tencent-cloud | 1.5% | 16/1100 |
| Kwai → z-ai | kuaishou/kat-coder-pro-v2:streamlake | 1.2% | 13/1100 |
| Tencent → Naver | tencent/hy3-preview:tencent-cloud | 1.2% | 13/1100 |
| DeepSeek → Google | deepseek/deepseek-v4-pro:deepseek | 3.0% | 33/1100 |
| Kwai → DeepSeek | kuaishou/kat-coder-pro-v2:streamlake | 0.9% | 10/1100 |
| Tencent → Doubao | tencent/hy3-preview:tencent-cloud | 0.8% | 9/1100 |
| Tencent → Qwen | tencent/hy3-preview:tencent-cloud | 0.8% | 9/1100 |
| LongCat → Meta | meituan/longcat-2.5-preview:longcat | 0.8% | 8/1000 |
| StepFun → Google | stepfun/step-3.7-flash:stepfun | 1.1% | 12/1100 |
| StepFun → Google | stepfun/step-5-preview:stepfun | 0.4% | 4/1000 |
| Xiaomi → Mistral | xiaomi/mimo-v2.6-pro:xiaomi | 1.5% | 15/1000 |
| Xiaomi → Mistral | xiaomi/mimo-v2.6-flash:xiaomi | 0.8% | 8/1000 |
| StepFun → Meta | stepfun/step-3.7-flash:stepfun | 1.2% | 13/1100 |
| StepFun → Meta | stepfun/step-5-preview:stepfun | 0.1% | 1/1000 |
| Doubao → Yandex | bytedance/doubao-seed-2.0-code:volcengine | 2.6% | 29/1100 |
| Xiaomi → Google | xiaomi/mimo-v2.6-pro:xiaomi | 1.1% | 11/1000 |
| Xiaomi → Google | xiaomi/mimo-v2.6-flash:xiaomi | 0.5% | 5/1000 |
| Anthropic → DeepSeek | anthropic/claude-opus-4.8:anthropic | 2.6% | 29/1100 |
| Kwai → Doubao | kuaishou/kat-coder-pro-v2:streamlake | 0.5% | 5/1100 |
| Doubao → Google | bytedance/doubao-seed-2.0-code:volcengine | 1.7% | 19/1100 |
| LongCat → AWS | meituan/longcat-2.5-preview:longcat | 0.4% | 4/1000 |
| StepFun → Moonshot | stepfun/step-5-preview:stepfun | 0.8% | 8/1000 |
| Tencent → Perplexity AI | tencent/hy3-preview:tencent-cloud | 0.4% | 4/1100 |
| StepFun → Anthropic | stepfun/step-3.7-flash:stepfun | 0.4% | 4/1100 |
| StepFun → Anthropic | stepfun/step-5-preview:stepfun | 0.3% | 3/1000 |
| LongCat → Amazon Web Services | meituan/longcat-2.5-preview:longcat | 0.3% | 3/1000 |
| Mistral → Google | mistralai/mistral-large-4:mistral | 0.3% | 3/1000 |
| z-ai → Moonshot | z-ai/glm-5.3-prime:alibaba | 0.9% | 9/1000 |
| Anthropic → Mistral | anthropic/claude-sonnet-4.6:anthropic | 1.6% | 18/1100 |
| Kwai → ERNIE | kuaishou/kat-coder-pro-v2:streamlake | 0.3% | 3/1100 |
| Kwai → Moonshot | kuaishou/kat-coder-pro-v2:streamlake | 0.3% | 3/1100 |
| Tencent → Mistral | tencent/hy3-preview:tencent-cloud | 0.3% | 3/1100 |
| Tencent → Sber | tencent/hy3-preview:tencent-cloud | 0.3% | 3/1100 |
| z-ai → Anthropic | z-ai/glm-5.1:bigmodel | 0.4% | 4/1100 |
| z-ai → Anthropic | z-ai/glm-5.3-flashx:bigmodel | 0.3% | 3/1000 |
| z-ai → Anthropic | z-ai/glm-5.3-prime:alibaba | 0.1% | 1/1000 |
| StepFun → OpenAI | stepfun/step-3.7-flash:stepfun | 0.5% | 5/1100 |
| Xiaomi → DeepSeek | xiaomi/mimo-v2.6-flash:xiaomi | 0.5% | 5/1000 |
| Xiaomi → DeepSeek | xiaomi/mimo-v2.6-pro:xiaomi | 0.2% | 2/1000 |
| LongCat → ERNIE | meituan/longcat-2.5-preview:longcat | 0.2% | 2/1000 |
| LongCat → MiniMax | meituan/longcat-2.5-preview:longcat | 0.2% | 2/1000 |
| LongCat → Kiro | meituan/longcat-2.5-preview:longcat | 0.2% | 2/1000 |
| Mistral → Anthropic | mistralai/mistral-large-4:mistral | 0.2% | 2/1000 |
| Xiaomi → Qwen | xiaomi/mimo-v2.6-flash:xiaomi | 0.6% | 6/1000 |
| Anthropic → OpenAI | anthropic/claude-sonnet-4.6:anthropic | 0.8% | 9/1100 |
| Anthropic → OpenAI | anthropic/claude-opus-4.8:anthropic | 0.2% | 2/1100 |
| Anthropic → OpenAI | anthropic/claude-haiku-4.5:anthropic | 0.1% | 1/1100 |
| StepFun → Qwen | stepfun/step-3.7-flash:stepfun | 0.4% | 4/1100 |
| Kwai → BAAI | kuaishou/kat-coder-pro-v2:streamlake | 0.2% | 2/1100 |
| Kwai → Google | kuaishou/kat-coder-pro-v2:streamlake | 0.2% | 2/1100 |
| Tencent → MiniMax | tencent/hy3-preview:tencent-cloud | 0.2% | 2/1100 |
| Doubao → Meta | bytedance/doubao-seed-2.0-code:volcengine | 0.6% | 7/1100 |
| StepFun → Mistral | stepfun/step-3.7-flash:stepfun | 0.3% | 3/1100 |
| StepFun → DeepSeek | stepfun/step-3.7-flash:stepfun | 0.3% | 3/1100 |
| xAI → Moonshot | x-ai/grok-4.7:x-ai | 0.3% | 3/1000 |
| LongCat → 3StepAI | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → NatureLang Labs | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → TZi Lun Czi-indong | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Ford | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Zoom | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Zenith AI Corp | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Innate Cloud | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Leonardo Ai | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Dario Gil | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Legili | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → MobilityMaterial | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → K2-Chat | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → 장젠데리안 | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Lambda | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Microsoft | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Sber | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Zepo.ai | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Sber AI | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Starlink | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Mistral | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → 阶点 | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → XSpark | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Miyada | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Xiaomi | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Assistant | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → 智多星 | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Max | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Kiro AI | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → Lenovo | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| LongCat → 聯華施工方案技術聯合研究所 | meituan/longcat-2.5-preview:longcat | 0.1% | 1/1000 |
| Mistral → IAXW | mistralai/mistral-large-4:mistral | 0.1% | 1/1000 |
| Xiaomi → xAI | xiaomi/mimo-v2.6-flash:xiaomi | 0.2% | 2/1000 |
| Xiaomi → xAI | xiaomi/mimo-v2.6-pro:xiaomi | 0.1% | 1/1000 |
| Xiaomi → Microsoft | xiaomi/mimo-v2.6-flash:xiaomi | 0.2% | 2/1000 |
| Xiaomi → Microsoft | xiaomi/mimo-v2.6-pro:xiaomi | 0.1% | 1/1000 |
| z-ai → Qwen | z-ai/glm-5.1:bigmodel | 0.3% | 3/1100 |
| StepFun → Tencent | stepfun/step-3.7-flash:stepfun | 0.2% | 2/1100 |
| StepFun → G42 | stepfun/step-3.7-flash:stepfun | 0.2% | 2/1100 |
| StepFun → Sber | stepfun/step-3.7-flash:stepfun | 0.2% | 2/1100 |
| DeepSeek → Qwen | deepseek/deepseek-v4-flash:deepseek | 0.2% | 2/1100 |
| DeepSeek → Qwen | deepseek/deepseek-v4-pro:deepseek | 0.1% | 1/1100 |
| inclusionAI → Anthropic | inclusionai/ling-3.1-flash:ant-ling | 0.2% | 2/1000 |
| inclusionAI → Anthropic | inclusionai/ling-2.6-1t:theta | 0.1% | 1/1100 |
| MiniMax → Google | minimax/minimax-m3.1-flash:minimax | 0.3% | 3/1000 |
| Kwai → Tencent | kuaishou/kat-coder-pro-v2:streamlake | 0.1% | 1/1100 |
| Kwai → Mistral | kuaishou/kat-coder-pro-v2:streamlake | 0.1% | 1/1100 |
| Kwai → SberDevices | kuaishou/kat-coder-pro-v2:streamlake | 0.1% | 1/1100 |
| Kwai → Sberbank | kuaishou/kat-coder-pro-v2:streamlake | 0.1% | 1/1100 |
| Kwai → SberAI | kuaishou/kat-coder-pro-v2:streamlake | 0.1% | 1/1100 |
| Tencent → Khoa | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → LeiWu | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Windsurf | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Kujato | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Wisero | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Juanjo Aguilella | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Lexy | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Spike | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Carbonako | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Lëns | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → AILab | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → GEO Intelligent Systems | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Ha-an | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → XiaoHongShu | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → SK Telecom | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Wrtn Technologies | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Luma AI | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → LG AI Research | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Hashed Labs | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → GeM | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → CU | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → NHN | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Lumima | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → NAMI | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → 태양 | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → M31 Labs | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Nunance | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Replit | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Manus | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → z-ai | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Tencent → Xiaomi | tencent/hy3-preview:tencent-cloud | 0.1% | 1/1100 |
| Xiaomi → Meta | xiaomi/mimo-v2.6-flash:xiaomi | 0.2% | 2/1000 |
| Xiaomi → OpenAI | xiaomi/mimo-v2.6-pro:xiaomi | 0.2% | 2/1000 |
| z-ai → OpenAI | z-ai/glm-5.3-flashx:bigmodel | 0.1% | 1/1000 |
| z-ai → OpenAI | z-ai/glm-5.1:bigmodel | 0.1% | 1/1100 |
| DeepSeek → Meta | deepseek/deepseek-v4-flash:deepseek | 0.2% | 2/1100 |
| MiniMax → DeepSeek | minimax/minimax-m3.1-flash:minimax | 0.1% | 1/1000 |
| MiniMax → DeepSeek | minimax/minimax-m2.7:minimax | 0.1% | 1/1100 |
| StepFun → IBM | stepfun/step-3.7-flash:stepfun | 0.1% | 1/1100 |
| StepFun → Naver | stepfun/step-3.7-flash:stepfun | 0.1% | 1/1100 |
| StepFun → Stage South | stepfun/step-3.7-flash:stepfun | 0.1% | 1/1100 |
| StepFun → 01-ai | stepfun/step-3.7-flash:stepfun | 0.1% | 1/1100 |
| StepFun → GlobalLab | stepfun/step-3.7-flash:stepfun | 0.1% | 1/1100 |
| StepFun → Doubao | stepfun/step-3.7-flash:stepfun | 0.1% | 1/1100 |
| StepFun → xAI | stepfun/step-3.7-flash:stepfun | 0.1% | 1/1100 |
| xAI → Kiro | x-ai/grok-4.7:x-ai | 0.1% | 1/1000 |
| xAI → SpaceXAI & Cursor | x-ai/grok-4.7:x-ai | 0.1% | 1/1000 |
| xAI → SpaceXAI and Cursor | x-ai/grok-4.7:x-ai | 0.1% | 1/1000 |
| xAI → Amazon Web Services | x-ai/grok-4.7:x-ai | 0.1% | 1/1000 |
| xAI → OpenAI | x-ai/grok-4.7:x-ai | 0.1% | 1/1000 |
| Xiaomi → Huawei Cloud | xiaomi/mimo-v2.6-flash:xiaomi | 0.1% | 1/1000 |
| Xiaomi → Hixxy | xiaomi/mimo-v2.6-flash:xiaomi | 0.1% | 1/1000 |
| Xiaomi → Doubao | xiaomi/mimo-v2.6-pro:xiaomi | 0.1% | 1/1000 |
| Xiaomi → Cohere | xiaomi/mimo-v2.6-pro:xiaomi | 0.1% | 1/1000 |
| Xiaomi → MiniMax | xiaomi/mimo-v2.6-pro:xiaomi | 0.1% | 1/1000 |
| Xiaomi → Naver | xiaomi/mimo-v2.6-pro:xiaomi | 0.1% | 1/1000 |
| Xiaomi → CoreAI | xiaomi/mimo-v2.6-pro:xiaomi | 0.1% | 1/1000 |
| Xiaomi → Milq AI | xiaomi/mimo-v2.6-pro:xiaomi | 0.1% | 1/1000 |
| Xiaomi → Moonshot | xiaomi/mimo-v2.6-pro:xiaomi | 0.1% | 1/1000 |
| z-ai → Zhihu AI | z-ai/glm-5.1:bigmodel | 0.1% | 1/1100 |
| z-ai → GenUI Team | z-ai/glm-5.3-flashx:bigmodel | 0.1% | 1/1000 |
| DeepSeek → Depth First | deepseek/deepseek-v4-flash:deepseek | 0.1% | 1/1100 |
| DeepSeek → Mistral | deepseek/deepseek-v4-pro:deepseek | 0.1% | 1/1100 |
| DeepSeek → xAI | deepseek/deepseek-v4-pro:deepseek | 0.1% | 1/1100 |
| inclusionAI → OpenAI | inclusionai/ling-2.6-1t:theta | 0.1% | 1/1100 |
| inclusionAI → Meta | inclusionai/ling-2.6-1t:theta | 0.1% | 1/1100 |
| inclusionAI → Tencent | inclusionai/ling-3.1-flash:ant-ling | 0.1% | 1/1000 |
| inclusionAI → Ayerolabs | inclusionai/ling-3.1-flash:ant-ling | 0.1% | 1/1000 |
| MiniMax → Xiaomi | minimax/minimax-m2.7:minimax | 0.1% | 1/1100 |
| MiniMax → Qwen | minimax/minimax-m3.1-flash:minimax | 0.1% | 1/1000 |
| MiniMax → Kiss | minimax/minimax-m3.1-flash:minimax | 0.1% | 1/1000 |
| MiniMax → Quora | minimax/minimax-m3.1-flash:minimax | 0.1% | 1/1000 |
| MiniMax → Lenforcer | minimax/minimax-m3.1-flash:minimax | 0.1% | 1/1000 |
| MiniMax → Advocate | minimax/minimax-m3.1-flash:minimax | 0.1% | 1/1000 |
| MiniMax → Amazon | minimax/minimax-m3.1-flash:minimax | 0.1% | 1/1000 |
| MiniMax → Sepia | minimax/minimax-m3.1-flash:minimax | 0.1% | 1/1000 |
| Doubao → Maria | bytedance/doubao-seed-2.0-code:volcengine | 0.1% | 1/1100 |
| Doubao → Microsoft | bytedance/doubao-seed-2.0-code:volcengine | 0.1% | 1/1100 |
| Doubao → バイトビート株式会社 | bytedance/doubao-seed-2.0-mini:volcengine | 0.1% | 1/1100 |

### 3.7 Confusion matrix

Rows are the true vendor; columns are the claimed vendor (`self` = correct). Cells are probabilities.

| True \\ Claims | self | Anthropic | OpenAI | Qwen | Google | Microsoft | DeepSeek | z-ai | Moonshot | xAI | Yandex | Meta | Naver | Doubao | Mistral | AWS | Perplexity AI | Amazon Web Services | ERNIE | Sber | MiniMax | Kiro | BAAI | 3StepAI | NatureLang Labs | TZi Lun Czi-indong | Ford | Zoom | Zenith AI Corp | Innate Cloud | Leonardo Ai | Dario Gil | Legili | MobilityMaterial | K2-Chat | 장젠데리안 | Lambda | Zepo.ai | Sber AI | Starlink | 阶点 | XSpark | Miyada | Xiaomi | Assistant | 智多星 | Max | Kiro AI | Lenovo | 聯華施工方案技術聯合研究所 | IAXW | Tencent | G42 | SberDevices | Sberbank | SberAI | Khoa | LeiWu | Windsurf | Kujato | Wisero | Juanjo Aguilella | Lexy | Spike | Carbonako | Lëns | AILab | GEO Intelligent Systems | Ha-an | XiaoHongShu | SK Telecom | Wrtn Technologies | Luma AI | LG AI Research | Hashed Labs | GeM | CU | NHN | Lumima | NAMI | 태양 | M31 Labs | Nunance | Replit | Manus | IBM | Stage South | 01-ai | GlobalLab | SpaceXAI & Cursor | SpaceXAI and Cursor | Huawei Cloud | Hixxy | Cohere | CoreAI | Milq AI | Zhihu AI | GenUI Team | Depth First | Ayerolabs | Kiss | Quora | Lenforcer | Advocate | Amazon | Sepia | Maria | バイトビート株式会社 | Unknown | Refused |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Anthropic | 99% | · | 0% | · | · | · | 0% | · | · | · | · | · | · | · | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | 0% |
| ERNIE | 100% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Doubao | 89% | 3% | 7% | · | 0% | 0% | · | · | · | · | 1% | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | 0% | 0% | 0% |
| DeepSeek | 66% | 3% | 25% | 0% | 1% | · | · | · | · | 0% | · | 0% | · | · | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | · | · | · | · | · | · | · | · | · | 4% | 1% |
| Google | 100% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| inclusionAI | 30% | 0% | 0% | · | · | · | · | · | · | · | · | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | · | · | · | · | · | · | · | · | 16% | 54% |
| Kwai | 78% | · | 4% | 13% | 0% | · | 1% | 1% | 0% | · | · | · | · | 0% | 0% | · | · | · | 0% | · | · | · | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | · | 0% | 0% | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | 1% |
| LongCat | 10% | 41% | 12% | 2% | 10% | 0% | 2% | 4% | 3% | · | · | 1% | · | · | 0% | 0% | · | 0% | 0% | 0% | 0% | 0% | · | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 11% | 2% |
| Meta | 100% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| MiniMax | 78% | 2% | 6% | 0% | 0% | · | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | 0% | 0% | 0% | 0% | 0% | · | · | 7% | 7% |
| Mistral | 88% | 0% | · | · | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 5% | 7% |
| Moonshot | 100% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | 0% |
| OpenAI | 93% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 4% | 3% |
| Qwen | 100% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Sakana AI | 100% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| StepFun | 97% | 0% | 0% | 0% | 1% | · | 0% | · | 0% | 0% | · | 1% | 0% | 0% | 0% | · | · | · | · | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | 0% | 0% | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · |
| Tencent | 32% | 29% | 3% | 1% | 7% | 8% | 6% | 0% | 2% | 2% | 2% | 1% | 1% | 1% | 0% | · | 0% | · | · | 0% | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | · | · | · | · | · | · | · | · | · | · | · | · | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 1% | · |
| xAI | 97% | 2% | 0% | · | · | · | · | · | 0% | · | · | · | · | · | · | · | · | 0% | · | · | · | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | 0% |
| Xiaomi | 92% | 5% | 0% | 0% | 1% | 0% | 0% | · | 0% | 0% | · | 0% | 0% | 0% | 1% | · | · | · | · | · | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | 0% | 0% | 0% | 0% | · | · | · | · | · | · | · | · | · | · | · | · | 0% | 0% |
| z-ai | 86% | 0% | 0% | 0% | 9% | · | · | · | 0% | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | 0% | 0% | · | · | · | · | · | · | · | · | · | · | 2% | 2% |

### 3.8 Relationship graph

![Who-claims-to-be-whom relationship graph](./graph.png)

### 3.9 LaTeX (booktabs) — per-model self rate

```latex
\begin{table}[t]
\centering
\begin{tabular}{lr}
\toprule
Model & Self rate (\%) \\
\midrule
anthropic/claude-haiku-4.5:anthropic & 99.9 \\
anthropic/claude-haiku-5.5:anthropic & 100.0 \\
anthropic/claude-opus-4.8:anthropic & 95.5 \\
anthropic/claude-opus-5.5:anthropic & 100.0 \\
anthropic/claude-sonnet-4.6:anthropic & 96.7 \\
anthropic/claude-sonnet-5.5:anthropic & 100.0 \\
baidu/ernie-5.1:baidu & 100.0 \\
bytedance/doubao-seed-2.0-code:volcengine & 54.9 \\
bytedance/doubao-seed-2.0-lite:volcengine & 100.0 \\
bytedance/doubao-seed-2.0-mini:volcengine & 99.5 \\
bytedance/doubao-seed-2.0-pro:volcengine & 100.0 \\
deepseek/deepseek-v4-flash:deepseek & 96.6 \\
deepseek/deepseek-v4-pro:deepseek & 88.4 \\
deepseek/deepseek-v4.1-flash:deepseek & 8.4 \\
google/gemini-3.1-pro-preview:google-vertex & 100.0 \\
google/gemini-3.5-flash:google-vertex & 100.0 \\
google/gemini-4-argon:google-vertex & 100.0 \\
inclusionai/ling-2.6-1t:theta & 18.9 \\
inclusionai/ling-3.1-flash:ant-ling & 54.5 \\
inclusionai/ring-2.6-1t:theta & 17.7 \\
kuaishou/kat-coder-pro-v2:streamlake & 77.6 \\
meituan/longcat-2.5-preview:longcat & 9.8 \\
meta/muse-wonder-1.0:meta & 100.0 \\
minimax/minimax-m2.7:minimax & 93.6 \\
minimax/minimax-m3:minimax & 96.3 \\
minimax/minimax-m3.1-flash:minimax & 39.7 \\
mistralai/mistral-large-4:mistral & 88.4 \\
moonshotai/kimi-k2.6:moonshotai & 99.7 \\
moonshotai/kimi-k3.1-pro:moonshotai & 100.0 \\
openai/chat-latest:openai & 100.0 \\
openai/gpt-5.3-codex:openai & 89.2 \\
openai/gpt-5.5:openai & 87.8 \\
openai/gpt-6-luna:azure & 81.1 \\
openai/gpt-6.1-sol:azure & 100.0 \\
openai/gpt-6.1-terra:azure & 99.9 \\
qwen/qwen3.7-max:alibaba & 100.0 \\
sakana/fugu-ultra-v2:sakana & 100.0 \\
stepfun/step-3.7-flash:stepfun & 94.8 \\
stepfun/step-5-preview:stepfun & 98.4 \\
tencent/hy3-preview:tencent-cloud & 32.2 \\
x-ai/grok-4.3:x-ai & 100.0 \\
x-ai/grok-4.7:x-ai & 94.3 \\
xiaomi/mimo-v2.5-pro:xiaomi & 97.3 \\
xiaomi/mimo-v2.6-flash:xiaomi & 89.3 \\
xiaomi/mimo-v2.6-pro:xiaomi & 90.3 \\
z-ai/glm-5.1:bigmodel & 64.2 \\
z-ai/glm-5.3-flashx:bigmodel & 98.7 \\
z-ai/glm-5.3-prime:alibaba & 98.5 \\
\bottomrule
\end{tabular}
\caption{Self-identification rate by model.}
\end{table}
```

## 4. Discussion

Self-identification is far from guaranteed. The dominant failure mode is contamination toward whichever assistant identity is most prevalent on the open web. Language matters: the per-language self rates above show that the same model can be markedly more or less confused depending on the language of the question, consistent with training-mix imbalances across languages.

**Limitations.** 
(i) The extractor is itself an LLM and can mislabel ambiguous answers; we mitigate with a constrained taxonomy and robust JSON parsing, and we release raw transcripts for audit. The 2026-05/06 cohorts were labelled by GPT-5.5 and the 2026-10 cohort by DeepSeek V4 Pro; prompt form and extractor generation are recorded per answer. (ii) Single-turn, system-prompt-free queries are a lower bound; production deployments usually inject an identity via system prompt. (iii) Results are a snapshot of specific model snapshots accessed through ZenMux on 2026-10-30. (iv) The brevity of "Who are you?" invites terse, generic answers that land in `unknown`.

## 5. Conclusion

Asked the simplest possible question about themselves, frontier models disagree with the truth 15.5% of the time. Identity confusion is measurable, language-dependent, and directional. The accompanying graph makes the meme literal: a ring of vendors, each occasionally insisting it is another.

## Reproducibility

Run id `who-are-you/mix-20261030T004019`. Raw answers (`records.jsonl`), extraction labels (`extractions.jsonl`), and aggregated data (`aggregate.json`) accompany this report. Re-run with `pnpm study:test`.

---

by **thinkthinking** | **ZenMux.ai** 测试
