# Run parameter amendment

- Changed at: 2026-09-11T04:15:57.779282+00:00
- User requested increasing `api.maxTokens` / Responses `max_output_tokens` from **8192 to 16384**.
- Retained 50 completed valid questionnaires from 54 earlier attempts.
- The original configuration is preserved in `study.before-max-tokens-16384.yaml`.
- The runner was stopped before changing `study.yaml` and resumed afterward. Missing and invalid questionnaires use the new ceiling.
- This batch contains two output-token ceilings; reports must disclose the amendment rather than describe a uniform ceiling across all administrations.
- `config-amendments.jsonl` records the boundary, configuration hashes, and retained keys.

## Concurrency increase

- Changed at: 2026-09-11T04:27:44.529593+00:00
- Increased from 8 models × 4 requests (32 maximum) to 16 models × 8 requests (128 maximum).
- Retained 99 valid questionnaires; resumed only missing or invalid keys.
- Aligned Node response-header/body timeouts with the SDK 10-minute request deadline using a matching undici fetch and Agent.
- Prompt, scoring, provider routes and max_output_tokens=16384 are unchanged.

- Transport correction: use `EnvHttpProxyAgent` to preserve the existing proxy environment as well as the 10-minute transport deadline. The initial direct Agent caused connection timeouts; those unsuccessful attempts remain in the log/records.

## Route removal and Doubao-only continuation

- Changed at: 2026-09-11T04:55:50.000Z
- The user removed Agnes 2.5 Flash and Mistral Large 3 from this batch after their route failures (HTTP 429 and HTTP 422 respectively). Their historical attempt records remain intact, but they are no longer part of the expected 26-model set.
- Increased `api.maxTokens` / Responses `max_output_tokens` from **16384 to 50000** for the remaining 16 incomplete Doubao Seed 2.1 Pro administrations.
- Stopped the previous runner before applying this amendment so no request continues with the old 16384 ceiling. Existing 400 valid questionnaires are retained.
- This batch now has three output-token ceilings: 8192 for the original retained cohort, 16384 for the first continuation, and 50000 for the Doubao-only continuation. Any aggregate or report must disclose this non-uniform history.

## Mistral Azure route re-test

- Added at: 2026-09-11T05:00:00.000Z
- The user requested one new 16-administration group for `mistralai/mistral-large-2512:azure`. This replaces neither the historical, removed `:mistral` route nor the 26 configured routes.
- The ZenMux model detail page was checked at the time of amendment: the Azure provider slug is `azure`, supports the Responses protocol, and advertises a 256000-token completion limit. The frozen OEJTS prompt and instrument remain unchanged.
- The Azure group is a distinct provider-pinned model route. It shares the current 50000 Responses output ceiling unless amended again; it must not be conflated with the earlier `:mistral` failures.

## Streaming Responses transport

- Changed at: 2026-09-11T05:30:00.000Z
- The user requested SSE streaming for Responses after long non-streaming Doubao requests timed out at the gateway. The client now accumulates `response.output_text.delta` events and uses the final `response.completed`, `response.incomplete`, or `response.failed` event for status and usage.
- The frozen prompt, OEJTS instrument, scoring, provider routes, `max_output_tokens`, and retry policy are unchanged. A completed stream still must parse into the same complete 32-answer questionnaire before it becomes valid.
- This affects only newly started runner processes. A process that was already running with non-streaming code must be stopped and relaunched to use SSE.

## Live-only reasoning diagnostics

- Changed at: 2026-09-11T05:35:00.000Z
- The runner now prints `response.reasoning_text.delta` and `response.reasoning_summary_text.delta` events with a model label to the terminal, so liveness is visible while a long response is in progress.
- Reasoning text is terminal-only: it is neither accumulated as questionnaire output nor written to `records.jsonl`. Final `rawResponse` is sanitized to remove reasoning output items before persistence.

## Majority-only reanalysis (2026-09-17)

- At the user's request, the only stability criterion is now a unique complete-type mode strictly above half: at least 9 of 16 valid questionnaires. The former per-letter threshold no longer participates in classification; letter counts and dimension statistics remain descriptive.
- This is a retrospective analysis-rule amendment, not a new experiment or the original preregistered rule. Raw records, instrument, prompt, provider routes, and historical `study*.yaml` snapshots are unchanged. The loader deliberately excludes the retired `minLetterCount` when producing the current classification configuration.
- Regenerated aggregate/report: **22/27 stable** (13 INTJ, 9 ISTJ), **5/27 no stable type**, based on the same 432 valid questionnaires. Ten models change from no stable type to stable; no questionnaire, type distribution, or dimension score changed.
- Potential cache effects have not been excluded. Follow-up tests should compare controlled, meaning-preserving prompt perturbations with unperturbed runs, record available cache-hit metadata, and use provider-supported cache bypass controls where possible. Prompt/KV caching does not by itself mean a whole answer was replayed. Perturbations may independently affect answers, so changed distributions alone do not establish a cache effect.
