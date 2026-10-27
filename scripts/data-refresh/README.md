# Internal data refresh

Run from the complete repository with Node **26.12.1** and dependencies installed
using `pnpm install --frozen-lockfile`, including development dependencies.
The task uses the same runtime as local development, independently of the public
application's `engines.node: "24.x"` setting for Vercel.

Fill the repository root's `.env.local` using the root `.env.example` on the internal host;
never copy real environment files to the public application's deployment.
Run `pnpm data:refresh --check`, then `pnpm data:refresh` to publish all datasets.
`pnpm data:refresh --help` lists options. No separate build or deployment package is required.

If outbound HTTPS requires a proxy, set the appropriate `HTTPS_PROXY` / `HTTP_PROXY`
values in `.env.local`. `NO_PROXY` can exclude destinations that should use a direct
connection. The repository command enables proxy support before starting Node.
Cron does not load `.zshrc`; shell-only settings do not reach scheduled jobs.

`refresh.cron` supplies a five-minute Linux task example, including local
exclusion and a process timeout. Its paths and log ownership must match your host.
The comparison data producer skips current daily publications; billing jobs keep
their own freshness boundaries. Supabase leases fence competing processes.

See `docs/shared-cache.md` in the repository for recovery, credentials, data
semantics and validation.
