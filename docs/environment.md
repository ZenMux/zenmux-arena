# Environment configuration

## One local source: `.env.local`

```bash
cp .env.example .env.local    # First setup only; do not overwrite an existing file.
# Edit .env.local with your credentials.
chmod 600 .env.local
pnpm env:check                # Presence/status only; no credential values or IO.
pnpm env:test                 # Synthetic fixtures only; no model calls or DB access.
```

The shared `scripts/local-env.ts` bootstrap is used by local Next/Vite config,
identity/personality research CLIs, billing maintenance CLIs, Supabase setup and
the explicit historical export. It reads the repository's `.env.local` quietly:

1. Existing process environment (shell exports or CI/runtime injection) wins.
2. `.env.local` only fills names that are not already set in the process.
3. Even an existing blank process value is preserved, per default dotenv behavior.
4. If the local file is absent, injected CI/runtime environment remains intact.

Do not maintain another Arena configuration in `~/.zshrc`, `.env`,
`.env.production*` or `.dev.vars`. Next/Wrangler may still load those files using
their native conventions; remove duplicate application variables to avoid a
second source. Shell exports used by other projects can remain, but they take precedence
when exported into the process. To test or use a changed local value, unset
the conflicting exported name in that shell first. Never `source .env.local` in a shell: it is
a dotenv file, not an executable shell script.

## Canonical variable names

| Group | Variables | Needed by |
| --- | --- | --- |
| Management API | `ZENMUX_MANAGEMENT_API_KEY` | Economics launch-window daily usage, Value Ladder/Map and talk economics data |
| Generation API | `ZENMUX_API_KEY` | Identity/personality model calls, not web rendering or builds |
| Billing origin | `TOKEN_ECON_LIVE_DB_HOST`, `TOKEN_ECON_LIVE_DB_PORT`, `TOKEN_ECON_LIVE_DB_USER`, `TOKEN_ECON_LIVE_DB_PASSWORD`, `TOKEN_ECON_LIVE_DB_DATABASE` | LIVE refresh and Deals roster sync; use a read-only account |
| Shared snapshots | `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Server snapshot reads, publication and leases |
| Role-isolation probes | `SUPABASE_PUBLISHABLE_KEY` | `supabase:check/test`, not normal web runtime |
| Schema administration | `SUPABASE_ACCESS_TOKEN` **or** `SUPABASE_DB_URL` | Explicit setup/tests only; never deploy |

The Management API key is not interchangeable with a generation API key.
`SUPABASE_SERVICE_ROLE_KEY` and the public Supabase URL/publishable names remain
legacy alternatives; prefer the canonical server names. Arena's browser does
not need a direct Supabase client. Never place a secret key in `NEXT_PUBLIC_*`.
Optional window/cadence, query/pool tuning and local tooling variables are
listed in `.env.example`. API base URLs/protocols for the research pipelines
remain in the pinned YAML run config, not duplicate shell variables.

## Deployment is a different boundary

`.env.local` is ignored by Git and excluded from research/static/standalone
packaging. Do not commit it, upload it as an asset or paste its contents into
logs. `.env.example` only documents names/defaults and contains no credentials.

Cloudflare Worker **runtime Secrets/Variables** or Morphe **function env** must
use the same canonical names above. Build-environment variables are not proof
that the deployed Worker has those runtime bindings. Configure the Management
API key, Supabase server credentials and billing origin credentials there;
only copy optional tuning variables you actually use. Never deploy the study
key, schema-administration credentials or local Wrangler authorization tokens.

A missing Management API key does not break the public model-listing request,
but it leaves launch-window usage empty. After configuring runtime secrets,
verify the economics provenance reports `managementConfigured: true` and
`observedModels > 0`; HTTP 200 alone does not establish this.

## Cloudflare local development and secret-free tests

The pinned Wrangler/Vite plugin loads `.env.local` for local bindings. An
existing `.dev.vars` takes precedence over dotenv files, so do not keep a
separate copy there. Generated `dist/server/.dev.vars` is local tooling output,
not an application asset or a deployment secret synchronization mechanism.

For a secret-free smoke run, use a credential-free checkout/build, or temporarily
keep all local/generated dotenv/dev-vars files out of that run and set
`CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false`. Do not run model research or live
refresh commands as regression tests. `env:test`, `cache:test`, `cf:test` and the
mocked economics loader tests do not contact external systems.
