# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

ZenMux Arena is a Next.js 16 / React 19 research site with three products:

- **Token Economics** (`/token-economics`): live token usage with anchor-normalized pricing, plus model-listing and launch-window comparisons.
- **Token Deals** (`/token-deals`, `/token-deals/ladder`): a public ledger of model discounts and subsidies, with separate PAYG and subscription accounting.
- **Who Are You?** (`/who-are-you`): a research harness and viewer for cross-vendor identity confusion. It asks frontier models the same question in 10 languages, extracts the claimed vendor, and aggregates the results. Generation calls go through ZenMux's Anthropic Messages endpoint (`https://zenmux.ai/api/anthropic`) using `@anthropic-ai/sdk`.

The live billing dashboards persist their shared snapshots in **Supabase**. Local
JSON caches and the one-time migration tooling have been retired. The Who Are
You run files, published research artifacts, and human-maintained model/deal
configuration are still application inputs; they are not disposable live caches.

The relationship graph is rendered and exported only from the browser studio
(`/who-are-you`, also `/who-are-you/studio`, via `/api/export`). There is no CLI
render step. Legacy `/research` URLs rewrite to `/who-are-you`.

## Commands

```bash
# Development and validation
pnpm dev                  # localhost:3000; /, /token-economics, /token-deals, /who-are-you
pnpm build                # Next.js standalone production output
pnpm start                # local Next production server
pnpm lint
pnpm exec tsc --noEmit
pnpm cache:test           # isolated Node tests for shared-cache behavior (no external IO)

# Supabase data plane
pnpm supabase:check --require-data  # schema/RPC access, role isolation, four usable snapshots
pnpm supabase:setup        # idempotent schema setup; requires DDL credentials
pnpm supabase:sql          # print schema for the SQL Editor
pnpm supabase:test         # transactional database assertions; probes roll back
pnpm tokenecon:refresh     # incremental maintenance refresh directly into Supabase
pnpm tokendeals:refresh    # independent Deals snapshot refresh directly into Supabase
pnpm tokendeals:backfill   # resumable full-ledger chunks + immutable Supabase archive
pnpm tokendeals:sync       # sync the curated deal roster from the billing DB
pnpm tokenecon            # optional reproducible pricing/usage research artifact

# Who Are You research pipeline (requires ZENMUX_API_KEY)
pnpm study:test           # run → extract → aggregate, with completeness gate
pnpm study:report         # aggregate.json → report.md
pnpm study:run            # ask only; auto-retry + resume
pnpm study:extract        # extraction only; needs complete records
pnpm study:aggregate      # join + summarize only; needs complete records
pnpm study:mix --runs <stampA,stampB,...>  # or --all; no API calls
pnpm study:aggregate --run mix-<stamp>
```

`pnpm` is the package manager. **`study:test` makes model calls; it is not a unit
test suite.** Use `cache:test` for cache regression tests. Supabase maintenance
commands load `.env.local`; deployed servers use the function environment.
The Morphe artifact starts with `node server.js` from the standalone root.

### Who Are You script flags
- `--config <path>` — config file (default `config/study.yaml`)
- `--run <stamp|latest>` — resume an existing run directory; `study:run` without it creates a fresh timestamped run, the others default to `latest`
- `study:run` only: `--model-concurrency <n>`, `--batch-size <n>`, `--max-rounds <n>` (default 5)
- `study:extract`/`study:aggregate`: `--force` to bypass the completeness gate; `study:extract --re-extract` to redo all extractions
- `study:mix`: `--runs <stamp,stamp,…>` (comma-separated source stamps) **or** `--all` (every native run, skipping prior `mix-*` dirs). Writes a new `mix-<stamp>/` dir; never resumes/overwrites.

## Commit conventions

- Commit messages must be written in English, even when the user discusses the change in Chinese. Keep Chinese for chat summaries or commit bodies only when it adds necessary context.
- Use Conventional Commits for the subject line: `<type>(optional-scope): <summary>`.
- Prefer these types: `feat` for user-facing capability/model additions, `fix` for bug fixes, `docs` for documentation/paper-only changes, `refactor` for behavior-preserving code cleanup, `style` for visual-only UI polish, `chore` for repo/config maintenance, and `test` for validation tooling.
- Keep the subject concise, imperative, and specific. Example: `feat(token-economics): add Hy3 model`.
- Before committing, inspect the staged diff, make sure unrelated user changes are not accidentally included, and run the lightest relevant validation (`pnpm lint`, `npx tsc --noEmit`, or a narrower command when appropriate).

## Use the installed skills — don't hand-roll what a skill owns

This repo vendors agent skills in `.agents/skills/`, with installation metadata in `skills-lock.json`. They are not optional reading — for the matching task, **invoke the skill first** rather than writing UI/animation/Next.js code from memory. The skill carries the current, version-correct conventions; your training data may be stale.

| When you are about to… | Invoke | Why |
|---|---|---|
| Add / change a **shadcn component** (anything under `src/components/ui/`, or `shadcn add`) | `/shadcn` | This project has `components.json` (style `radix-nova`, base `neutral`, `radix-ui` + `lucide`). The skill knows the registry/MCP, correct `add` flow, and how to compose/debug — never copy-paste a component by hand. |
| **Design or beautify** any page/component (`/who-are-you`, `/token-economics`, `/token-deals`, root `page.tsx`, the OG image) | `/ui-ux-pro-max` | Color systems, font pairing, layout, spacing, interaction states, accessibility for the exact stack (Next.js + Tailwind + shadcn). Use it to *plan* before building and to *review* after. |
| Build a **distinctive new surface** from scratch (landing/hero, a poster, a fresh page) | `/frontend-design` | Production-grade, non-generic visual design — pairs well with `/ui-ux-pro-max`. |
| **Audit accessibility / UX** of UI you just wrote | `/web-design-guidelines` | Checks against the Web Interface Guidelines (a11y, semantics, states). |
| Touch **Next.js conventions** (RSC vs client boundary, `force-dynamic`, metadata, route handlers, `next/image`) | `/next-best-practices` | The viewer is Next.js 16 / React 19; the studio/browse pages lean on RSC + `force-dynamic`. |
| **Optimize React/Next perf** (re-renders, data fetching, bundle, server-serialization like browse's "only selected model") | `/vercel-react-best-practices` | Performance patterns specific to this stack. |
| Work on **Supabase clients, snapshots, or access** | `/supabase` | Use the current SDK/docs and verify real reads/writes; credentials remain server-only. |
| Change **Postgres schema, SQL, indexes, grants, or RLS** | `/supabase-postgres-best-practices` | Preserve least-privilege grants, RLS, atomic publication and lease fencing. |
| **Deploy Arena to Morphe** | `/morphe-economics` | Check shared-data readiness, build/package code without local caches, and verify the live APIs. |
| Build any **animation / motion / video** | `/remotion-best-practices` | Remotion + React motion conventions. (No Remotion in the repo yet — reach for this if you add any.) |

Rule of thumb: **frontend work → skill first.** A change to `src/app/**` or `src/components/**` should almost always start by consulting `/shadcn` and/or `/ui-ux-pro-max`. The identity-study pipeline (`research/lib/**`) is plain TypeScript; the live-data modules under `research/cache/**` and `research/token-*/**` must follow the Supabase/SQL guidance when applicable. There are also ZenMux-internal skills (`zenmux-*`) for setup/usage/feedback; use them when the task is about ZenMux tooling itself, not this study.

## Architecture

### Live billing data: Supabase is the persistent store

- `research/cache/supabase.ts`: server/CLI client, snapshot reads, leases and writes.
- `research/cache/read-through.ts`: short process memo, single-flight refresh, Supabase read-through, stale fallback and request lifecycle tracking.
- `research/cache/payload.ts`: scope/version/range keys, payload validation, expiry boundaries and archive hashes.
- `research/cache/archive.ts`: immutable Supabase backfill checkpoints with read-back verification.
- `research/token-economics/live-query.ts` and `research/token-deals/query.ts`: independent billing queries and incremental aggregation.
- `/api/token-economics/live` and `/api/token-deals/live`: compressed JSON responses with `X-Cache-Source`, `X-Cache-Persistence`, `stale`, and the actual `to` cutoff.
- `src/app/token-deals/initial-deals.ts`: server first-paint loader, shared by the homepage's Deals summary and the Deals board/ladder. These pages render per request; the homepage streams the Deals row under Suspense so its hero/navigation do not wait for Supabase. Do not freeze their snapshot at build time.

Flow: **short memory memo → Supabase snapshot → expired/missing snapshot triggers
read-only billing queries → fenced Supabase commit**. No request reads or writes
`.cache` files. Next `after()` is passed as `waitUntil` so stale responses do not
abandon the query, publication or lease release. CLI callers await completion.

The tables are defined in `supabase/schema.sql`:

| Table | Purpose |
|---|---|
| `arena_snapshot_cache` | Current `token-economics` / `token-deals` snapshots, each with `all` and `72h` variants |
| `arena_cache_leases` | Cross-instance refresh exclusion and owner/expiry fencing |
| `arena_cache_archives` | Verified historical records and immutable maintenance checkpoints |

Preserve these invariants:

- Publication holds a valid lease and atomically compares `(data_through, refreshed_at)`; older work cannot overwrite newer data. Keep query work outside database transactions.
- Failed or unusable/empty origin results must not overwrite good snapshots. A successfully aggregated catch-up chunk can be persisted while still marked `stale`; its `to` is real progress.
- Use `to` to describe coverage. Do not treat an HTTP 200, recent response time, or successful deployment as proof of fresh persisted data.
- Economics uses closed buckets; ALL is daily. Deals advances at five-minute boundaries while retaining partial daily/hourly buckets. Preserve overlap replacement, deal windows, and the exact PAYG/subscription monetary split.
- Deals ALL catches up in bounded request-time chunks. Deliberate full recovery uses `tokendeals:backfill`; do not issue an unbounded historical query on every visit.
- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (legacy `SUPABASE_SERVICE_ROLE_KEY` also works) are runtime server variables. `NEXT_PUBLIC_*` is build-time public configuration and must never hold the secret key.
- All three tables enable RLS and deny direct `anon`/`authenticated` access. Server RPCs are `SECURITY INVOKER` and restricted to `service_role`; archive writes are INSERT-only. Do not solve access problems by opening client write policies.
- DDL setup/tests need `SUPABASE_ACCESS_TOKEN` or `SUPABASE_DB_URL`. Runtime requests do not need those admin credentials. Never print credentials or package `.env*` / `.npmrc`.

For setup, maintenance and failure handling, see [docs/shared-cache.md](docs/shared-cache.md).

### Other application inputs

Human-curated `config/token-deals.json` defines deal periods, provider factors,
and visibility. `tokendeals:sync` merges new facts without overwriting manual
choices. Runtime pricing display uses the public models API; monetary totals
come from billing aggregation. Economics' non-live comparison tabs still use
model-listing data and launch-window usage in `research/token-economics/{scrape,usage,compute}.ts`;
the launch-window fetch has its own 24-hour Next Data Cache; `vercel.json` declares
an optional daily warm-up for Vercel deployments.
These active inputs are separate from the retired local billing snapshots.

### Deployment

Use `.agents/skills/morphe-economics/SKILL.md`. The default predeploy step checks
Supabase readiness; `--refresh` explicitly refreshes both modules independently.
Data already in Supabase survives new deployments. Do not recreate migration
scripts, local cache files, or prebuild baseline-copy steps.

Keep `output: "standalone"`, required `public/` assets, research data and model/deal
configs. The homepage also needs `config/token-deals.json` in its trace. Keep the
cache/credential exclusions and package verifier; they prevent accidental files
from shipping. Builds should not query Supabase or billing databases for the
homepage/Deals pages. Deploy verification uses GETs and reports data freshness
separately from release success.

### Who Are You pipeline and viewer

`research/lib/types.ts` is the shared contract between the identity-study CLIs
(`research/scripts/*` over `research/lib/*`) and `src/app/who-are-you/`. Research
run JSONL/JSON files are retained for reproducibility and raw-answer browsing.

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
`buildGraphSvg` (in `svg.ts`) hand-builds the SVG (no chart lib); the `/api/export` route rasterizes it → PNG via `@resvg/resvg-js` at N× scale, or returns the raw SVG. **This is the only renderer** — there is no `study:render` CLI anymore. The studio (`/who-are-you/studio`) drives both the live preview (`RelationshipGraph.tsx`) and the export with one shared `RenderConfig`, so the export is WYSIWYG.
- **`RenderConfig` + `DEFAULT_RENDER` + `EdgeCurves` live in `geometry.ts`** (not `types.ts`) — they're the contract between `StudioClient.tsx` (state), `svg.ts` (Node render), and `/api/export` (`{ ...DEFAULT_RENDER, ...body.config }`). Change the shape in one place and all three must agree. Per-edge drag reshapes travel as a `curves` map keyed by `edgeKey`.
- CJK glyphs need `research/assets/NotoSansSC-Regular.otf`; if missing, the export warns and Chinese text may not appear.
- Logos are inlined into the exported SVG as base64 data URIs (`logoDataUri`); the interactive web graph uses `logoWebPath` URLs instead.
- The exported image footer carries the attribution badge + repo URL from `research/lib/branding.ts` — **pure constants, no imports**, shared verbatim with the on-screen `StudyBadge.tsx` so footer and image never drift. `report.ts` embeds `./graph.png` in `report.md`, but the pipeline never produces that file — it's the studio export you drop alongside the report.

### Frontend stack
- **Next.js 16 + React 19 + Tailwind v4 + shadcn/ui.** Tailwind v4 is configured via `@tailwindcss/postcss` and CSS-first config in `src/app/globals.css` (no `tailwind.config.js`); `components.json` style is `radix-nova`, base color `neutral`, icons `lucide-react`, primitives `radix-ui`. **Add/modify components through `/shadcn`, not by hand** (see the skills table above).
- `cn()` in `src/lib/utils.ts` (`clsx` + `tailwind-merge`) is the standard className combiner — use it everywhere.
- **RSC-first.** Studio and browse pages are server components that read the filesystem (`results/**`, `public/research/**`) and are `force-dynamic` so freshly-generated runs show up on reload without a rebuild. Push only what the client needs across the boundary — browse deliberately serializes *only the selected model's* answers (see `browse/data.ts`, mtime-cached). Consult `/next-best-practices` before moving the server/client boundary.
- Wordmark asset naming is **counterintuitive**: `ZenMux-Light.png` is the *dark* wordmark (for light backgrounds) and `ZenMux.png` is the *white* one — see the comment in `src/app/page.tsx` before swapping them.

### Pages

- `/`: experiment/tool hub; the Deals summary uses the shared Supabase loader.
- `/token-economics`: live usage charts and model price/usage comparisons.
- `/token-deals`: discount board; `/token-deals/ladder`: rankings and trends.
- `/who-are-you` and `/who-are-you/studio`: the same interactive graph workbench and PNG/SVG export surface.
- `/who-are-you/data`: run-selectable aggregate Data Explorer.
- `/who-are-you/browse`: raw answers joined with extractions by key; only the selected model is serialized to the client.
- `/tools/discount-to-deepseek`: pricing calculator. Registries in `src/lib/experiments.ts` and `src/lib/tools.ts` feed shared navigation.
- `/research` and `/research/:path*` remain compatibility rewrites to the Who Are You routes.

### Config
`config/study.yaml` is parsed and validated by `research/lib/config.ts` into the `StudyConfig` type — it fills defaults and **fails fast** on a bad `vendor`, missing fields, or unset API-key env var. `prompts.ts` has `DEFAULT_LANGUAGES` as a documented reference, but **the YAML wins at runtime**; keep them in sync.

### Path aliases (`tsconfig.json`)
`@/*` → `src/*`, `@research/*` → `research/*`. The Next.js page imports types via `@research/lib/types`.
