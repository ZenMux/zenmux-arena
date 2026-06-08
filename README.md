<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="56">
</picture>

# ZenMux Arena

**An open lab for cross-vendor experiments on frontier LLMs.**
One question, asked many ways, across many models — measured, aggregated, and visualized.

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

<sub>The flagship study — <b>“Who Are You?”</b> — rendered in the in-app Graph Studio. Each arrow: model of vendor <i>A</i> claiming to be vendor <i>B</i>.</sub>

<br/>

<!-- README-I18N:START -->

**English** | [简体中文](./README.zh-Hans.md) | [繁體中文](./README.zh-Hant.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Русский](./README.ru.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Português](./README.pt.md)

<!-- README-I18N:END -->

</div>

---

## What is this?

**ZenMux Arena** is a research harness **+** a Next.js viewer for running the *same* probe against many vendors' frontier models and turning the raw answers into a graph, tables, and an arxiv-style report.

It is built as a **hub for a growing series of experiments**, not a single one. The shared registry lives in [`src/lib/experiments.ts`](src/lib/experiments.ts); every study surfaces automatically on the homepage and in the sidebar. Today the Arena ships one **live** study and reserves space for more:

| Study | Question it asks | Status |
|---|---|---|
| 🫆 **[Who Are You?](#-featured-who-are-you)** | *Which vendor does each model claim to be — in ten languages?* | ✅ **Live** |
| 🧭 *More experiments* | Cross-vendor probes of refusal, sycophancy, knowledge cutoffs, persona stability… | 🔜 *Coming soon* |

> Want to add your own probe? See **[Adding a new experiment](#adding-a-new-experiment)** — it's a registry entry plus a config file.

Every model call goes through **[ZenMux](https://zenmux.ai)'s Anthropic Messages endpoint** (`https://zenmux.ai/api/anthropic`) using the official [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript) client, so one API key reaches every vendor under test.

---

## 🫆 Featured: "Who Are You?"

> **Cross-Vendor Identity Confusion in Frontier LLMs**

A systematic study: translate one question — **"Who are you?"** — into **10 languages**, ask each vendor's latest models **N times each**, then use a separate *extractor* model to label the **vendor each answer claims to be** (e.g. a Claude model answering *"I am Qwen"*). We aggregate the cross-vendor confusion into a graph + report.

The current stimulus is a **de-branding / identity-elicitation probe**: the instruction body is held byte-for-byte identical across all ten languages (only the trailing *"Respond in &lt;Language&gt;."* clause varies), and it explicitly asks the model to set aside any system-prompt persona and report the *underlying* model. See `config/study.yaml` above the `languages:` block for the exact wording and the alternative bare-question baseline.

### Headline findings

From the latest pooled run (`mix-20260601T062425`): **27 models × 10 languages × 40 repeats ≈ 29,700 answers.**

| Metric | Value | Meaning |
|---|--:|---|
| 🟢 **Self-identification** | **85.2%** | answered with its *own* true vendor |
| 🔴 **Cross-vendor confusion** | **7.1%** | claimed a *different* vendor |
| ⚪ **Unknown** | **2.4%** | answered, but no identity given |
| ⛔ **Refused** | **5.3%** | declined to answer |

**A few of the most striking confusions** *(model of vendor → vendor it claimed)*:

```
tencent   → anthropic   29.2%   (321/1100)
z-ai      → google      25.0%   (275/1100)
kwai      → qwen        13.5%   (148/1100)
bytedance → openai       7.2%   (317/4400)
```

> Read the full write-up in the generated `report.md`, or explore it interactively at **[`/research`](#-the-web-viewer)**.

### Downstream reuse

The published run artifacts are intentionally inspectable and reusable. One downstream example: [API Relay Audit](https://github.com/toby-bridges/api-relay-audit) used the `mix-20260601T062425` records, extractions, and aggregate data to calibrate natural-language model self-identification checks, helping it treat self-ID mismatches as consistency signals rather than standalone attribution proof.

---

## ⚡ Quickstart

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

Edit **[`config/study.yaml`](config/study.yaml)** to choose which models, languages, and repeat count to test. Each model entry pairs a ZenMux model `id` with its **ground-truth `vendor`** (one of the canonical ids in [`research/lib/vendors.ts`](research/lib/vendors.ts) — 27 vendors are registered):

```yaml
models:
  - { id: "anthropic/claude-opus-4.8:anthropic", vendor: anthropic, label: "Claude Opus 4.8" }
  - { id: "qwen/qwen3.7-max:alibaba",            vendor: qwen,      label: "Qwen3.7 Max" }
  - { id: "openai/gpt-5.5:openai",               vendor: openai,    label: "GPT-5.5" }
  # ...
```

> The `id` uses ZenMux's full model id **including** the `:provider` routing suffix (`:anthropic` / `:openai` / `:alibaba`…). The `vendor` is the model's *true* maker — it's compared against the extractor's *claimed* vendor to compute the confusion rate.

---

## 🔬 How the pipeline works

The pipeline is **deliberately split into independent stages** so you can inspect the data before writing a report. Each stage reads the previous stage's file:

```
config/study.yaml
  └─▶ records.jsonl       ask        model × lang × repeat  → raw answers
        └─▶ extractions.jsonl   extract    claimed vendor per answer (extractor model)
              └─▶ aggregate.json      aggregate  edges + per-cell distributions + summary
                    └─▶ report.md           report     arxiv-style write-up
                          ⋯ graph PNG/SVG    ← rendered on demand in the web Graph Studio
```

Every run lives in its own **timestamped directory**: `results/<study.id>/<stamp>/`.

| Command | What it does |
|---|---|
| `pnpm study:test` | **Stage 1** — ask → extract → aggregate, chained with a completeness gate |
| `pnpm study:report` | **Stage 2** — turn `aggregate.json` into an arxiv-style `report.md` |
| `pnpm study:run` | Ask pass only (auto-retry rounds + resume) |
| `pnpm study:extract` | Identity-extraction pass only (needs complete records) |
| `pnpm study:aggregate` | Join + summarize only (needs complete records) |
| `pnpm study:mix` | Pool several runs into one merged result (**no API calls**) |

When the aggregate finishes, it prints the headline numbers straight to your terminal:

```
[aggregate] selfRate=85.2% confusion=7.1% unknown=2.4% refused=5.3%
[aggregate]   tencent -> anthropic: 29.2% (321/1100)
[aggregate]   z-ai    -> google:    25.0% (275/1100)
```

<details>
<summary><b>Resume, auto-retry &amp; the completeness gate</b></summary>

<br/>

**Resumable by design.** Everything is JSONL, append-only, and de-duplicated by the resume key `model::lang::repeat`. Re-running fills only what's missing.

- **No `--run`** → creates a fresh timestamped run.
- **`--run <stamp>`** → resumes that run, filling only missing/failed requests.
- **`--run latest`** → resumes the most recent run.

```bash
pnpm study:run --run 20260601T053656      # top up an unfinished run
```

`study:run` has an **outer retry-round loop** (`--max-rounds`, default 5) on top of per-request exponential backoff, so transient failures get re-tried automatically.

**Completeness gate.** `study:extract` and `study:aggregate` refuse to run unless *every* expected `model × lang × repeat` cell has a successful record — they exit non-zero, which halts the chained `study:test` before it can operate on partial data. Pass `--force` to override.

</details>

<details>
<summary><b>Mixing runs — pooling staged data into one result</b></summary>

<br/>

A study is usually gathered in stages (a big run, a follow-up that adds one model, a top-up that adds repeats). `study:mix` pools several runs into **one merged result**. It makes **no API calls** and does **not** auto-aggregate.

```bash
pnpm study:mix --runs 20260531T175027,20260601T012758   # specific runs
pnpm study:mix --all                                     # every native run (skips mix-* dirs)

pnpm study:aggregate --run mix-<stamp>    # then aggregate the mix as usual
pnpm study:report    --run mix-<stamp>
```

The merge unit is **`generationId`** (the API's unique `message.id`), *not* the resume key — because two runs of the same model produce colliding keys, so a naive concat-and-dedupe would silently drop the overlap. After pooling, every surviving answer is re-numbered into a fresh unique key, so the mix behaves like a native run for `aggregate`, `browse`, and `export` with **zero downstream changes**. A `mix.json` sidecar marks the directory and relaxes the rectangular completeness gate (a mix is ragged by design). Cross-stimulus mixing is **warned, not blocked**.

</details>

---

## 🖥️ The web viewer

```bash
pnpm dev      # → http://localhost:3000
```

| Route | What it is |
|---|---|
| **[`/`](http://localhost:3000)** | The Arena hub — cards for every experiment, live stats, and a "surprise me" jump-in. |
| **[`/research`](http://localhost:3000/research)** | The report page — headline metrics, the interactive relationship graph (hover a node to highlight its edges, hover an edge for exact probabilities, filter by language), and summary tables. |
| **[`/research/studio`](http://localhost:3000/research/studio)** | **Graph Studio** — tune spacing / node size / curvature / threshold / palette / labels / background live, drag to reshape edges, hide vendors, then **export PNG/SVG** (WYSIWYG; the exported footer carries the ZenMux badge + repo URL). **This is the only place the graph is rendered.** |
| **[`/research/browse`](http://localhost:3000/research/browse)** | Raw-answer browser — every `records.jsonl` answer grouped by model → language, each shown with its full extraction label. For a `mix` directory, each answer is tagged with its source run. |

> 📌 The relationship graph (PNG/SVG) is **rendered and exported only from the Graph Studio**, never from the CLI. The pipeline stops at `aggregate.json`; everything visual is driven from the browser.

---

## 🗂️ Project structure

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
<summary><b>Architecture notes</b></summary>

<br/>

- **Two halves, one source of truth.** The pipeline (`research/*`, run with `tsx`) and the viewer (`src/app/*`, Next.js 16 / React 19) share `research/lib/types.ts`.
- **Config is pinned per run.** A fresh `study:run` snapshots `config/study.yaml` into the run dir; resume reads the *snapshot*, so editing the live config never corrupts an in-flight run.
- **The extractor is defensive.** A separate model labels each answer; parsing tries strict JSON → first balanced `{…}` → last-resort alias scan, normalizing unexpected labels via `vendorFromText` or falling back to `unknown`.
- **Vendor taxonomy.** `research/lib/vendors.ts` is the canonical registry, with `aliases` (incl. Chinese names like 通义千问 / 文心一言) matched longest-first. Three pseudo-vendors — `self`, `unknown`, `refused` — are analytical buckets, not real makers.
- **Graph rendering is web-only.** `buildGraphSvg` hand-builds the SVG; `/api/export` rasterizes it to PNG via `@resvg/resvg-js`. The studio drives both the live preview and the export from one shared `RenderConfig`, so the export is WYSIWYG.
- **Frontend stack.** Next.js 16 · React 19 · Tailwind v4 (CSS-first, no `tailwind.config.js`) · shadcn/ui (`radix-nova`, base `neutral`, `lucide` icons). The studio/browse pages are RSC + `force-dynamic`, so fresh runs appear on reload without a rebuild.

</details>

---

## Adding a new experiment

The Arena is built to grow. Roughly:

1. **Author a config** — copy `config/study.yaml`, give it a **distinct `study.id`** (run dirs are `results/<study.id>/<stamp>/`), and set the models, languages, repeats, prompt, and extractor.
2. **Run the pipeline** — `pnpm study:run --config config/your-study.yaml` (then `extract` / `aggregate` / `report`, each with `--config` and `--run latest`).
3. **Register it** — add an entry to [`src/lib/experiments.ts`](src/lib/experiments.ts) so it appears on the hub and in the sidebar.

> ⚠️ Don't use `pnpm study:test --config foo.yaml` — `study:test` chains three commands with `&&`, so the extra flag only reaches the *last* one. Use the step-by-step commands with an explicit `--config` on each.

---

## 🤝 Contributing

Issues and PRs are welcome — new experiments, more vendors, viewer polish, or methodology critiques.

- Frontend changes (`src/app/**`, `src/components/**`) follow the conventions in **[`CLAUDE.md`](CLAUDE.md)** (shadcn via the registry, Tailwind v4, RSC-first).
- `pnpm lint` before opening a PR.
- The research pipeline (`research/**`) is plain TypeScript with no test runner — `study:test` *is* the data pipeline, not a unit suite.

---

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/maker-logo/ZenMux.png">
  <source media="(prefers-color-scheme: light)" srcset="public/maker-logo/ZenMux-Light.png">
  <img alt="ZenMux" src="public/maker-logo/ZenMux-Light.png" height="36">
</picture>

<br/><br/>

**Research by [thinkthinking](https://github.com/thinkthinking) · powered by [ZenMux.ai](https://zenmux.ai)**

All model calls route through the ZenMux Anthropic Messages API — one key, every vendor.

<sub>Scaffolded with <a href="https://nextjs.org">Next.js</a> · see the original create-next-app docs at <a href="https://nextjs.org/docs">nextjs.org/docs</a>.</sub>

</div>
