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

# Pool several runs gathered in stages into one merged result (no API calls):
pnpm study:mix --runs <stampA,stampB,...>   # or --all to pool every native run
pnpm study:aggregate --run mix-<stamp>      # then aggregate/report the mix as usual

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
- `study:mix`: `--runs <stamp,stamp,…>` (comma-separated source stamps) **or** `--all` (every native run, skipping prior `mix-*` dirs). Writes a new `mix-<stamp>/` dir; never resumes/overwrites.

## Use the installed skills — don't hand-roll what a skill owns

This repo vendors a set of agent skills (`.claude/skills/` → symlinks into `.agents/skills/`, pinned in `skills-lock.json`). They are not optional reading — for the matching task, **invoke the skill first** rather than writing UI/animation/Next.js code from memory. The skill carries the current, version-correct conventions; your training data may be stale.

| When you are about to… | Invoke | Why |
|---|---|---|
| Add / change a **shadcn component** (anything under `src/components/ui/`, or `shadcn add`) | `/shadcn` | This project has `components.json` (style `radix-nova`, base `neutral`, `radix-ui` + `lucide`). The skill knows the registry/MCP, correct `add` flow, and how to compose/debug — never copy-paste a component by hand. |
| **Design or beautify** any page/component (`/research`, `/research/studio`, root `page.tsx`, the OG image) | `/ui-ux-pro-max` | Color systems, font pairing, layout, spacing, interaction states, accessibility for the exact stack (Next.js + Tailwind + shadcn). Use it to *plan* before building and to *review* after. |
| Build a **distinctive new surface** from scratch (landing/hero, a poster, a fresh page) | `/frontend-design` | Production-grade, non-generic visual design — pairs well with `/ui-ux-pro-max`. |
| **Audit accessibility / UX** of UI you just wrote | `/web-design-guidelines` | Checks against the Web Interface Guidelines (a11y, semantics, states). |
| Touch **Next.js conventions** (RSC vs client boundary, `force-dynamic`, metadata, route handlers, `next/image`) | `/next-best-practices` | The viewer is Next.js 16 / React 19; the studio/browse pages lean on RSC + `force-dynamic`. |
| **Optimize React/Next perf** (re-renders, data fetching, bundle, server-serialization like browse's "only selected model") | `/vercel-react-best-practices` | Performance patterns specific to this stack. |
| Build any **animation / motion / video** | `/remotion-best-practices` | Remotion + React motion conventions. (No Remotion in the repo yet — reach for this if you add any.) |

Rule of thumb: **frontend work → skill first.** A change to `src/app/**` or `src/components/**` should almost always start by consulting `/shadcn` and/or `/ui-ux-pro-max`. The research pipeline (`research/**`) has no skill — that's plain TypeScript you own directly. There are also ZenMux-internal skills (`zenmux-*`) for setup/usage/feedback; use them when the task is about ZenMux tooling itself, not this study.

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

**Config is pinned per run.** On a fresh run, `study:run` snapshots `config/study.yaml` into the run dir as `study.yaml`; all four scripts (`run`/`extract`/`aggregate`/`report`) then load config **from that snapshot** on resume, not from the live `config/study.yaml`. So editing the live config never retroactively changes an in-flight run's model/lang/repeat set (which would corrupt the completeness gate, since the resume key doesn't encode the prompt). The scripts discover `study.id` via `bootstrapStudyId` (a lightweight parse with no API-key gate), locate the run dir, then `loadRunConfig` reads-or-creates the snapshot. Older runs that predate snapshots get back-filled silently from the current config on first touch. To use a *new* config, start a fresh run (no `--run`).

### Mixing runs (`research/lib/mix.ts` + `research/scripts/mix.ts`) — pooling staged runs

A study is often gathered in stages (a big run, a follow-up that adds one model, a top-up that adds repeats). `study:mix` pools several runs into one merged result so you can read a single final aggregate. It makes **no API calls** and does **not** auto-aggregate — you run `study:aggregate --run mix-<stamp>` afterward (deliberately manual, like the rest of the pipeline).

- **The merge unit is `generationId` (the API's `message.id`), NOT the resume key.** The resume key `model::lang::repeat` deliberately excludes the run + prompt, so two runs of the *same* model produce **colliding keys** — a naive concat+dedupe-by-key would silently drop the overlap (e.g. two `minimax-m3` runs share 300 keys). Mix instead pools answered records by `generationId` (globally unique, verified non-null), pools extractions by `sourceGenerationId`, and joins record↔extraction on `generationId === sourceGenerationId`. Dedup extractions by `sourceGenerationId` (the *answer* labeled), never `extractorGenerationId`, or a re-extraction double-counts.
- **Lockstep re-numbering is what makes a mix behave like a native run.** After pooling, every surviving answer gets a FRESH unique resume key by re-numbering `repeat` per `(model, lang)`; records and their extractions are re-keyed together. The merged dir thus has globally-unique keys again, so `aggregate`, the web `browse` join, and the studio `export` — all of which still join by key — work on a mix **unchanged**. Each row keeps its original key + source run in `mixSource` (provenance), and its original `generationId` untouched.
- **A `mix.json` sidecar marks the dir as a mix.** `study:aggregate` keys off its presence to **skip the rectangular `model×lang×repeat` completeness gate** (a mix is ragged — per-model sample counts differ — so `enumerateTasks` would invent never-asked keys). The per-answer "every answered record has a clean extraction" gate still applies. The manifest also records per-source contributions and `promptVariants` per language.
- **Cross-prompt mixing is warned, not blocked.** If pooled runs used different stimuli for the same language (e.g. bare "Who are you?" vs. the probed variant), `mix` logs a warning per language and records every variant in `mix.json` — but proceeds. Pooling across stimulus families is a real methodology choice; the merged config's `languages[].prompt` holds the *most common* variant as representative.
- **Output is a new `mix-<stamp>/` dir** (timestamped, never overwritten, auto-discovered by studio/browse). `--all` pools every native run and skips existing `mix-*` dirs so a mix is never re-pooled into another mix.

### Key invariants — understand these before changing the pipeline

- **The resume key** is `${modelId}::${langCode}::${repeat}` (`makeKey` in `research/lib/ask.ts`). It ties a record to its extraction across passes and drives idempotent resume/dedup. Don't change its shape without updating `store.ts` dedup/completeness logic.
- **Everything is JSONL + append-only + resumable** (`research/lib/store.ts`). Records/extractions are de-duplicated last-write-wins by key; only successful records (non-empty `response`, no `error`) count as "done." Re-running fills only what's missing. `study:run` has an outer round loop (`--max-rounds`) on top of per-request exponential backoff.
- **Completeness gate**: `study:extract` and `study:aggregate` refuse to run unless *every* expected `model×lang×repeat` key has a successful record (`checkCompleteness`). They exit non-zero, which halts the chained `study:test` before it can operate on partial data. `--force` overrides. When editing these scripts, preserve the non-zero exit on incomplete data.
- **`ask`/`extract` never throw** — failures are returned as records/results with an `error`/`parseError` field set, so one bad call can't abort a batch.
- **Merged ("mix") runs join by `generationId`, then re-number keys** so they pass as native runs downstream (see "Mixing runs" above). When touching dedup/join/gate logic, remember a `mix-*` dir is identified by its `mix.json` sidecar and is intentionally exempt from the rectangular completeness gate.

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
`buildGraphSvg` (in `svg.ts`) hand-builds the SVG (no chart lib); the `/api/export` route rasterizes it → PNG via `@resvg/resvg-js` at N× scale, or returns the raw SVG. **This is the only renderer** — there is no `study:render` CLI anymore. The studio (`/research/studio`) drives both the live preview (`RelationshipGraph.tsx`) and the export with one shared `RenderConfig`, so the export is WYSIWYG.
- **`RenderConfig` + `DEFAULT_RENDER` + `EdgeCurves` live in `geometry.ts`** (not `types.ts`) — they're the contract between `StudioClient.tsx` (state), `svg.ts` (Node render), and `/api/export` (`{ ...DEFAULT_RENDER, ...body.config }`). Change the shape in one place and all three must agree. Per-edge drag reshapes travel as a `curves` map keyed by `edgeKey`.
- CJK glyphs need `research/assets/NotoSansSC-Regular.otf`; if missing, the export warns and Chinese text may not appear.
- Logos are inlined into the exported SVG as base64 data URIs (`logoDataUri`); the interactive web graph uses `logoWebPath` URLs instead.
- The exported image footer carries the attribution badge + repo URL from `research/lib/branding.ts` — **pure constants, no imports**, shared verbatim with the on-screen `StudyBadge.tsx` so footer and image never drift. `report.ts` embeds `./graph.png` in `report.md`, but the pipeline never produces that file — it's the studio export you drop alongside the report.

### Frontend stack (the viewer half)
- **Next.js 16 + React 19 + Tailwind v4 + shadcn/ui.** Tailwind v4 is configured via `@tailwindcss/postcss` and CSS-first config in `src/app/globals.css` (no `tailwind.config.js`); `components.json` style is `radix-nova`, base color `neutral`, icons `lucide-react`, primitives `radix-ui`. **Add/modify components through `/shadcn`, not by hand** (see the skills table above).
- `cn()` in `src/lib/utils.ts` (`clsx` + `tailwind-merge`) is the standard className combiner — use it everywhere.
- **RSC-first.** Studio and browse pages are server components that read the filesystem (`results/**`, `public/research/**`) and are `force-dynamic` so freshly-generated runs show up on reload without a rebuild. Push only what the client needs across the boundary — browse deliberately serializes *only the selected model's* answers (see `browse/data.ts`, mtime-cached). Consult `/next-best-practices` before moving the server/client boundary.
- Wordmark asset naming is **counterintuitive**: `ZenMux-Light.png` is the *dark* wordmark (for light backgrounds) and `ZenMux.png` is the *white* one — see the comment in `src/app/page.tsx` before swapping them.

### Pages (`src/app/research/`)
- `/research` — the report page (headline stats, interactive graph, summary tables, `StudyBadge` footer).
- `/research/studio` — interactive graph workbench + image export (the render+export path above).
- `/research/browse` — raw-answer browser: server component that joins `records.jsonl` + `extractions.jsonl` by key (see `browse/data.ts`, mtime-cached), grouped by model → language, each answer shown with its full extraction label. Only the selected model's answers are serialized to the client; model/run selection is URL-driven.

### Config
`config/study.yaml` is parsed and validated by `research/lib/config.ts` into the `StudyConfig` type — it fills defaults and **fails fast** on a bad `vendor`, missing fields, or unset API-key env var. `prompts.ts` has `DEFAULT_LANGUAGES` as a documented reference, but **the YAML wins at runtime**; keep them in sync.

### Path aliases (`tsconfig.json`)
`@/*` → `src/*`, `@research/*` → `research/*`. The Next.js page imports types via `@research/lib/types`.
