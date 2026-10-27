# Arena shared live data

Token Economics and Token Deals use Supabase as their persistent snapshot store.
The billing database remains the read-only source. Model configuration and the
reproducible Who Are You research datasets remain in the repository; they are
not disposable live caches.

On a visit, a short process memo absorbs repeated requests, then the server reads
`arena_snapshot_cache`. A current snapshot needs no billing query. An expired
snapshot seeds an incremental query and the result is committed to Supabase.
Next `after()` tracks that work even when the response serves stale data first.
Another process can immediately read the committed snapshot. CLI callers await
the complete query/write/release sequence.

The database refresh lease excludes concurrent workers across instances. Publish
checks lease ownership/expiry and compares data cutoff and generation time
atomically, so an older result cannot roll a snapshot backwards. A failed origin
query preserves the last good data; an empty/degraded payload is never persisted.
Snapshots are historical checkpoints and are not deleted when they expire.
When Supabase is unavailable the server reports `X-Cache-Persistence: unavailable`
and can use its last in-memory checkpoint or query the source. It does not read
or write local JSON. A cold outage may therefore be slower or show a degraded UI.

Economics preserves closed-bucket aggregation (ALL uses daily buckets). Deals
preserves five-minute cutoffs with partial daily/hourly buckets, the existing
PAYG/subscription calculations and overlap replacement. A far-behind Deals ALL
snapshot advances by bounded chunks, saving each chunk even while `stale: true`.
An absent ALL snapshot bootstraps a bounded chunk rather than querying the whole
ledger in one request. `tokendeals:backfill` remains the faster maintenance path
for deliberate full-history recovery or newly added historical deals.

## Configuration

Set `SUPABASE_URL` and server-only `SUPABASE_SECRET_KEY` (legacy
`SUPABASE_SERVICE_ROLE_KEY` also works), plus the existing `TOKEN_ECON_LIVE_DB_*`
configuration in `.env.local` and in the Morphe **function environment**.
`SUPABASE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are used to
verify public isolation. Server URL takes priority over `NEXT_PUBLIC_SUPABASE_URL`.
Public variables are inlined at build time; server variables are read at runtime.
The secret key is never placed in Next's `env` configuration or client modules.

### Vercel without billing database network access

If Vercel can reach Supabase but the billing MySQL/OceanBase endpoint is only
reachable from your internal network, set these server environment variables
in the Vercel project for each deployed environment, then redeploy:

```dotenv
SUPABASE_URL=your-project-url
SUPABASE_SECRET_KEY=your-server-secret-key
ARENA_CACHE_REFRESH_ENABLED=false
```

This disables request-driven billing refreshes for both Economics and Deals,
including the homepage's Deals summary. It reads the shared snapshots without
acquiring refresh leases or opening billing DB connections. Vercel does not
need `TOKEN_ECON_LIVE_DB_*` credentials in this mode. A snapshot past its freshness
boundary is returned with `stale: true` and its original `to` cutoff. If no usable
snapshot exists, Economics returns HTTP 503 and Deals uses its existing degraded
response; the server never falls back to a billing query.

Refresh the snapshots regularly from an environment that can reach both the
billing database and Supabase:

```bash
pnpm tokenecon:refresh
pnpm tokendeals:refresh
pnpm supabase:check --require-data
```

The explicit maintenance commands still refresh and publish data when
`ARENA_CACHE_REFRESH_ENABLED=false`; the flag only controls the request cache.
For missing Deals ALL data, initialize it with `pnpm tokendeals:backfill` first.
Vercel's existing page warm-up cron only reads snapshots in this mode and cannot
replace maintenance from a network that reaches the billing database.

`connect ETIMEDOUT` means a billing connection was not established within the
10-second connection timeout. Raising `TOKEN_DEALS_QUERY_TIMEOUT_MS` or Vercel's
function duration does not make a private endpoint reachable. If request-driven
refreshes are desired, provide a reachable endpoint with appropriate network
access and place the Vercel Functions region close to that endpoint before
re-enabling refreshes.

All three tables have RLS enabled and no grants to `anon`/`authenticated`.
Only the server has data-plane access. The browser uses Arena's existing APIs.
RPCs are `SECURITY INVOKER`, restricted to `service_role`, with a fixed search path.
`arena_cache_archives` grants the service role INSERT/SELECT only.

## Setup and recovery

```bash
pnpm supabase:setup
pnpm supabase:check --require-data
```

Setup applies `supabase/schema.sql` idempotently, using `SUPABASE_ACCESS_TOKEN`
(Management API) or `SUPABASE_DB_URL` with psql. Neither admin credential is needed
by the deployed runtime. Without either, `pnpm supabase:sql` prints the SQL for
the project's SQL Editor.

The JSON migration is complete: four live snapshots and five verified historical
archives are stored in Supabase. Local cache files, import reports and the
one-time import command have been retired. Recovery uses the shared snapshots,
immutable Supabase archives, or a deliberate source backfill.

For a new empty database, run `pnpm tokenecon:refresh` and
`pnpm tokendeals:backfill`, then repeat the readiness check. These commands write
Supabase directly; no local cache directory is created.

## Maintenance and deployment

```bash
pnpm tokenecon:refresh      # deep-overlap incremental refresh to Supabase
pnpm tokendeals:refresh     # independent Deals refresh to Supabase
pnpm tokendeals:backfill    # resumable chunks + an immutable completed archive
pnpm cache:test             # isolated cache lifecycle/concurrency/failure tests
pnpm supabase:test          # SQL assertions; needs a DDL connection, rolls back probes
```

Routine releases run `predeploy.sh` for shared-data readiness. `--refresh` is
optional and reports each module independently. No cache prefetch or copy into
standalone is required. Packaging removes `.cache`, `.env*` and `.npmrc` and
`verify-package.py` checks required assets and absence of local data/credentials.

For a live smoke test, compare `X-Cache-Source`, `X-Cache-Persistence`, `to`, `stale`
and `live`. After refresh, check Supabase's persisted cutoff and restart the
process: the next visit should read that shared checkpoint. HTTP 200 alone does
not establish freshness or successful persistence.

`supabase/tests/cache.sql` runs transactional SQL checks for role grants/RLS,
insert/update, lock exclusion, monotonic writes and stale-owner fencing. Execute
with psql or the Management API; its probes roll back. Immutable Supabase archives
remain available for recovery. Do not restore an older
snapshot over a newer active cutoff; inspect an archive separately or restore
to a new schema version after reviewing the intended data change.
