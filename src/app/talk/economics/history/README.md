# DeepSeek challenge: frozen research window

The window is **2026-06-23 through 2026-08-23 inclusive (UTC)**, represented as
`[2026-06-23T00:00:00.000Z, 2026-08-24T00:00:00.000Z)`: 62 complete days.

```tsx
import { deepSeekChallengeHistory } from "./history"; // from EconomicsPanel.tsx

<LiveLeaderboard presentation historicalData={deepSeekChallengeHistory} />
```

`index.ts` statically imports the JSON artifact. No fetch, Supabase client,
environment variable, or source-reader module is imported by this entry point.
`LiveLeaderboard` branches into a separate historical component; it never mounts
the live polling component. DAILY/TOTAL, Token/Cost, anchor and model selection
remain interactive. Runtime live APIs, reload controls, ALL/72H and live pulses
are absent. Daily tick and hover dates use UTC. The normal live page, which does
not supply `historicalData`, retains its existing behavior.
Campaign status is evaluated at `window.to - 1ms` (the final millisecond of
August 23), while provenance retains the original September 11 generation time.

## Evidence

- Source: `arena_snapshot_cache`, key `token-economics:v1:all`.
- Persisted coverage: `2026-06-23T00:00:00.000Z` through
  `2026-09-11T00:00:00.000Z` exclusive; 80 daily buckets per model.
- Source generation: `2026-09-11T00:26:01.932Z`.
- Frozen selection: 25 models × 62 days = 1,550 existing points, including 23
  models in the two plotted anchor cohorts and two retained unanchored models.
- Every selected timestamp is checked, not merely first/last or array length.
  Missing days, duplicate days, wrong buckets, invalid numbers or insufficient
  outer coverage abort export. Existing source zeros are preserved; no point is
  synthesized or filled.
- Model and anchor totals, latest-day values, peaks and ordering are recomputed
  from the selected daily points. The existing chart builds cumulative curves
  from those points, so no preceding or following usage is included.
- Source and selected payload SHA-256 hashes, extraction time, per-model
  coverage, pricing-metadata limits and method notes are embedded in the JSON.

These checks establish complete **persisted daily-bucket coverage**. They do not
independently audit raw billing records. Pricing/campaign metadata remains as
recorded in the source snapshot; it is not reconstructed day by day. Individual
campaign end dates remain distinct from this observation window. The renderer
retains the original muted post-campaign tails.

## Explicit export and validation

```sh
pnpm exec tsx src/app/talk/economics/history/export.ts
pnpm exec tsx --test src/app/talk/economics/history/history.test.tsx
```

The export reads `.env.local` quietly and performs one bounded **SELECT only**.
It never uses the request-time live API/read-through helpers, acquires leases,
refreshes billing data or changes schema. Output uses exclusive creation (`wx`)
and refuses to overwrite the existing artifact. This JSON is an immutable
research input, not a reintroduced live cache. Do not add the exporter to build,
request rendering, scheduled refresh or deployment hooks.
