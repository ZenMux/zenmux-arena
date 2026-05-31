# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A research harness + Next.js viewer for the study **"Who Are You? — Cross-Vendor Identity Confusion in Frontier LLMs."** It asks the same question ("Who are you?") to many vendors' frontier models, in 10 languages, N times each, then uses an extractor model to label which vendor each answer *claims* to be, and aggregates the cross-vendor confusion into a graph + report. All model calls go through **ZenMux's Anthropic Messages endpoint** (`https://zenmux.ai/api/anthropic`) via the `@anthropic-ai/sdk` client.

The relationship graph is **rendered and exported only from the web viewer** (the graph studio at `/research/studio`, via the `/api/export` route) — there is no CLI render step. The pipeline stops at `aggregate.json`; everything visual (graph PNG/SVG, image export) is driven by manual interaction in the browser.

## Commands

```bash
export ZENMUX_API_KEY=sk-...   # required by loadConfig; scripts abort without it

# Data pipeline (deliberately separate so you inspect data before writing the report):
pnpm study:test       # run → extract → aggregate (chained, with completeness gate)
pnpm study:report     # aggregate.json → report.md

# Individual steps:
pnpm study:run        # ask pass only (auto-retry rounds + resume)
pnpm study:extract    # identity-extraction pass only (needs complete records)
pnpm study:aggregate  # join + summarize only (needs complete records)

# Web viewer (also where the graph is rendered + exported as PNG/SVG):
pnpm dev              # http://localhost:3000/research  ·  /research/studio  ·  /research/browse
pnpm build && pnpm start
pnpm lint             # eslint (flat config, eslint-config-next)
```

There is **no test runner** — `study:test` is the data pipeline, not a unit-test suite. `pnpm` is the package manager (README uses it throughout). The graph is **not** rendered from the CLI; open the studio and export from there.

### Common script flags
- `--config <path>` — config file (default `config/study.yaml`)
- `--run <stamp|latest>` — resume an existing run directory; `study:run` without it creates a fresh timestamped run, the others default to `latest`
- `study:run` only: `--model-concurrency <n>`, `--batch-size <n>`, `--max-rounds <n>` (default 5)
- `study:extract`/`study:aggregate`: `--force` to bypass the completeness gate; `study:extract --re-extract` to redo all extractions

## Architecture

Two halves sharing `research/lib/types.ts` as the single source of truth:

1. **Pipeline** (`research/scripts/*` thin CLIs over `research/lib/*`), run with `tsx`.
2. **Viewer** (`src/app/research/`), a Next.js 16 / React 19 app reading the published JSON.

### Data flow (each stage reads the previous stage's file)
```
config/study.yaml
  → records.jsonl       (ask:       model × lang × repeat answers)
  → extractions.jsonl   (extract:   claimed vendor per answer, via extractor model)
  → aggregate.json      (aggregate: edges + per-cell distributions + summary)
  → report.md           (report)
  · graph PNG/SVG        ← rendered on demand in the web viewer (studio + /api/export)
```
Every run lives in its own timestamped dir: `results/<study.id>/<stamp>/` (e.g. `results/who-are-you/20260529T070756/`). `aggregate` and `report` also **publish** copies to `public/research/` (`aggregate.json`, `report.md`) — that's what the web page reads. The graph image (`graph.png` for the OG image, plus any manual exports) comes from the studio's export route, not the pipeline.

### Key invariants — understand these before changing the pipeline

- **The resume key** is `${modelId}::${langCode}::${repeat}` (`makeKey` in `research/lib/ask.ts`). It ties a record to its extraction across passes and drives idempotent resume/dedup. Don't change its shape without updating `store.ts` dedup/completeness logic.
- **Everything is JSONL + append-only + resumable** (`research/lib/store.ts`). Records/extractions are de-duplicated last-write-wins by key; only successful records (non-empty `response`, no `error`) count as "done." Re-running fills only what's missing. `study:run` has an outer round loop (`--max-rounds`) on top of per-request exponential backoff.
- **Completeness gate**: `study:extract` and `study:aggregate` refuse to run unless *every* expected `model×lang×repeat` key has a successful record (`checkCompleteness`). They exit non-zero, which halts the chained `study:test` before it can operate on partial data. `--force` overrides. When editing these scripts, preserve the non-zero exit on incomplete data.
- **`ask`/`extract` never throw** — failures are returned as records/results with an `error`/`parseError` field set, so one bad call can't abort a batch.

### Vendor taxonomy (`research/lib/vendors.ts`)
- `VENDORS` is the canonical registry: each real vendor has a `name`, a `logo` filename under `public/maker-logo/`, and `aliases` (lowercased substrings, incl. Chinese names like 通义千问/文心一言) used to map free-text back to a canonical id.
- Three **pseudo-vendors** are analytical buckets, not real vendors: `self` (claimed its own vendor — derived in aggregation, never emitted by the extractor), `unknown` (answered but no identity), `refused`.
- `vendorFromText` matches aliases **longest-first** so specific names win over short generic ones — keep that ordering when adding aliases.
- Adding a vendor means: add to the `VendorId` union in `types.ts`, the `VENDORS` map, and drop a logo PNG in `public/maker-logo/`.

### Concurrency model (`research/lib/limiter.ts`, configured in `config/study.yaml` `api:`)
- Ask pass: all models run in parallel capped at `modelConcurrency`; within a model, languages run **sequentially**; within a language, `repeats` run in **batches** of `batchSize`.
- Extract pass: global concurrency = `batchSize × modelConcurrency`.
- The Anthropic client is built with `maxRetries: 0` (`client.ts`) — retry/backoff is owned by `withRetry` in `limiter.ts` for unified logging, full-jitter exponential backoff, and `Retry-After` handling.

### Extractor (`research/lib/extract.ts` + `prompts.ts`)
A separate model (config `extractor.model`, e.g. `deepseek/deepseek-v4-pro`) labels each answer. It's prompted for JSON matching `EXTRACTION_SCHEMA`, but parsing is **defensive**: try strict JSON → first balanced `{...}` → last-resort alias scan of the raw text. Unexpected vendor labels are normalized via `vendorFromText` or fall to `unknown`. Never assume the extractor returns clean JSON.

### Graph rendering (`research/lib/svg.ts`, `geometry.ts`) — web-only
`buildGraphSvg` (in `svg.ts`) hand-builds the SVG (no chart lib); the `/api/export` route rasterizes it → PNG via `@resvg/resvg-js` at N× scale, or returns the raw SVG. **This is the only renderer** — there is no `study:render` CLI anymore. The studio (`/research/studio`) drives both the live preview (`RelationshipGraph.tsx`) and the export with one shared `RenderConfig`, so the export is WYSIWYG. CJK glyphs need `research/assets/NotoSansSC-Regular.otf`; if missing, the export warns and Chinese text may not appear. Logos are inlined into the exported SVG as base64 data URIs (`logoDataUri`); the interactive web graph uses `logoWebPath` URLs instead. The exported image footer carries the attribution badge + repo URL from `research/lib/branding.ts` (shared with the on-screen `StudyBadge`).

### Pages (`src/app/research/`)
- `/research` — the report page (headline stats, interactive graph, summary tables, `StudyBadge` footer).
- `/research/studio` — interactive graph workbench + image export (the render+export path above).
- `/research/browse` — raw-answer browser: server component that joins `records.jsonl` + `extractions.jsonl` by key (see `browse/data.ts`, mtime-cached), grouped by model → language, each answer shown with its full extraction label. Only the selected model's answers are serialized to the client; model/run selection is URL-driven.

### Config
`config/study.yaml` is parsed and validated by `research/lib/config.ts` into the `StudyConfig` type — it fills defaults and **fails fast** on a bad `vendor`, missing fields, or unset API-key env var. `prompts.ts` has `DEFAULT_LANGUAGES` as a documented reference, but **the YAML wins at runtime**; keep them in sync.

### Path aliases (`tsconfig.json`)
`@/*` → `src/*`, `@research/*` → `research/*`. The Next.js page imports types via `@research/lib/types`.
