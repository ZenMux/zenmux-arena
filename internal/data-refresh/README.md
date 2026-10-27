# Internal data refresh

Build from the repository root with `pnpm data:refresh:build`.
The resulting `dist/data-refresh/` requires Node **26.12.1**. Its `package.json`,
`.nvmrc` and `.node-version` follow the repository's local development pin.
The generated package reads `.node-version`, independently of the public
application's `engines.node: "24.x"` setting for Vercel.
Install its runtime dependencies with `npm install --omit=dev --ignore-scripts`.

Configure generic connection variables from `.env.example` on the internal host;
never copy real environment files to the public application's deployment.
Run `node --use-env-proxy --env-file /etc/arena-data-refresh.env refresh.mjs --check`, then run
without `--check` to publish all datasets. `node refresh.mjs --help` lists options.

If outbound HTTPS requires a proxy, set `NODE_USE_ENV_PROXY=1` and the appropriate
`HTTPS_PROXY` / `HTTP_PROXY` values in the task environment file. `NO_PROXY` can
exclude destinations that should use a direct connection. Keep `--use-env-proxy`
on the Node command: placing `NODE_USE_ENV_PROXY=1` only in an env file does not
activate proxy support on the tested runtime. Both Node options must precede the script path.
Cron does not load `.zshrc`; shell-only settings do not reach scheduled jobs.

`refresh.cron` supplies a five-minute Linux task example, including local
exclusion and a process timeout. Its paths and log ownership must match your host.
The comparison data producer skips current daily publications; billing jobs keep
their own freshness boundaries. Supabase leases fence competing processes.

See `docs/shared-cache.md` in the repository for recovery, credentials, data
semantics and validation. The runtime does not require the repository or Next.js.
