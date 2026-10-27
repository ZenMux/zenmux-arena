# Arena shared data

All live billing, model pricing and launch-window comparison data displayed by
Arena is read from Supabase. Public request handlers have no source database
query, management API fetch, refresh lease or publication path. Research runs
and immutable published research artifacts remain reproducible application inputs.

## Public application

Configure only `SUPABASE_URL` and server-only `SUPABASE_SECRET_KEY` (legacy
`SUPABASE_SERVICE_ROLE_KEY` also works) in Vercel/Morphe. The browser calls
Arena's APIs; it never receives the secret key. Public keys cannot directly
read or write the three private data-plane tables.

Node versions are configured separately:

- **Vercel application:** root `package.json` sets `engines.node` to `24.x`.
  This overrides the project's dashboard version setting. Vercel manages minor
  and patch updates automatically; it cannot pin an exact patch version.
- **Local development:** `.nvmrc` and `.node-version` pin **26.12.1**.
  Use `nvm install` / `nvm use` when managing Node with nvm.
- **Internal refresh task:** runs from the complete repository with Node
  **26.12.1**, using the same pins as local development.

As checked on 2026-10-27, [Vercel supports 24.x and 22.x](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
The local exact pin does not change the Vercel runtime selection.

The public path is **short process memo → Supabase snapshot**. Expired snapshots
remain usable with `stale: true`, their original `to` cutoff and their actual
generation time. A Supabase outage can use a process's last good payload with
`X-Cache-Persistence: unavailable`. A cold missing Economics snapshot returns
HTTP 503; Deals retains its degraded response. Neither case queries a source
system. The old request-refresh feature flag is no longer used.

The five publications share `arena_snapshot_cache`:

| Key | Data |
| --- | --- |
| `token-economics:v1:all` | Daily live billing aggregates |
| `token-economics:v1:72h` | Recent live billing aggregates |
| `token-deals:v4:all` | Full discount/subsidy ledger |
| `token-deals:v4:72h` | Recent discount/subsidy ledger |
| `token-economics:v2:all` | Model prices and launch-window comparison |

Version 2 ALL is reserved for the comparison publication; the live API continues
to use version 1. This uses the existing versioned schema and requires no schema
migration. The comparison `to` is its listing retrieval time; its per-model
launch observations have separate, explicitly reported dates.

The homepage, Deals board/ladder, live Economics API, Economics comparison page,
presentation comparison endpoint and pricing calculator all use these snapshots.
Config changes are applied by the internal producer and appear after publication,
without coupling data updates to a public release.

## Internal refresh task

The maintained producer lives in `internal/data-refresh/`. It is excluded from
Next's deployment traces, and MySQL is a development/internal-task dependency.
No internal hostname, database name or credential is stored in tracked config;
all source connection settings come from the task's environment.

On the internal host, use the complete repository with Node 26.12.1 and install
dependencies, including development dependencies:

```bash
pnpm install --frozen-lockfile
```

Configure the repository root's `.env.local` using the root `.env.example`.
Required variables are `BILLING_DB_HOST`,
`BILLING_DB_PORT`, `BILLING_DB_USER`, `BILLING_DB_PASSWORD`, `BILLING_DB_DATABASE`,
`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `ZENMUX_MANAGEMENT_API_KEY`.
Use a source account with SELECT access only. Keep `.env.local` untracked with
mode 600; real environment values override the file.

```bash
pnpm data:refresh --check
pnpm data:refresh
```

`internal/data-refresh/refresh.cron` is a Linux cron example that runs the command
from the repository root. Adjust its PATH, repository/log paths and service user
before installing it. It runs
every five minutes, uses `flock` to skip overlapping local runs, and enforces a
14-minute process budget. Supabase leases also exclude competing hosts and
expire after 15 minutes if a process is stopped.

If the internal host requires an outbound proxy, add `HTTPS_PROXY` / `HTTP_PROXY`
and any `NO_PROXY` exclusions to `.env.local`. Cron does not read `.zshrc`.

Repository commands (`pnpm dev`, `build`, `start`, `data:refresh`, and Supabase /
billing maintenance commands) use `scripts/with-env-proxy.mjs`. It enables
`NODE_USE_ENV_PROXY=1` before starting Node, including when the host omits it,
and loads configuration only from the project root's `.env.local` before
starting the tool. Host/platform environment variables take precedence. The root
`.env.example` is the single configuration template; `.env.local` is optional
when the environment already supplies the required variables.

Comparison publications refresh daily. Economics ALL uses closed daily buckets;
recent Economics and both Deals ranges advance on their existing five-minute
boundaries. Each job reports its actual `to`, `stale`, status and elapsed time.
Failures cause a nonzero exit after the remaining jobs have been attempted.
Logs omit source addresses, SQL and credentials.

Options:

- `--modules comparison,economics,deals`: select producers; defaults to all three.
- `--ranges 72h,all`: select billing ranges; defaults to both.
- `--max-tail-hours 24`: bound ALL catch-up progress; maximum 168 hours.
- `--force`: run even when the existing publication is current.
- `--check`: verify source SELECT access and print shared snapshot availability.

Each scheduled job acquires its lease, re-reads the latest baseline, queries
outside a database transaction, validates the payload, publishes under the
fenced/monotonic RPC and verifies the JSONB round trip. Source failures or
unusable data preserve the previous snapshot. Bounded ALL catch-up commits real
progress while remaining stale; subsequent runs continue from the persisted
cutoff. A failed model-usage request rejects comparison publication instead of
turning an outage into zero usage.

The deep-overlap maintenance and recovery tools are also internal:

```bash
pnpm tokenecon:refresh
pnpm tokendeals:refresh
pnpm tokendeals:backfill
pnpm tokendeals:sync
```

They load `.env.local` when run from this checkout and expect the generic
`BILLING_DB_*` task settings. Use explicit Deals backfill for full-ledger recovery
or newly added historical deals. Roster sync preserves manual visibility, factors
and deal-window choices; review those changes before the next refresh.

## Validation and release

```bash
pnpm cache:test
pnpm data:refresh:test
pnpm supabase:check --require-data
pnpm supabase:test
pnpm build
pnpm deploy:verify
```

The readiness check verifies role isolation/RPC fencing and all five usable
publications. Schema setup and transactional tests require separate DDL access;
normal page reads and scheduled publications do not. `supabase/schema.sql` is
idempotent and `supabase/tests/cache.sql` rolls its probes back.

Public builds neither refresh data nor read local credential files. The standalone
verifier rejects internal source code, MySQL driver files and source-access/write
markers in application bundles. Morphe's package verifier also rejects internal
code, credentials and caches. Keep required public/research assets in the release.

Data readiness and freshness are independent of release success. Check the real
persisted `to`/generation time and re-read from another process after refresh;
HTTP 200 alone does not establish coverage or successful publication.
