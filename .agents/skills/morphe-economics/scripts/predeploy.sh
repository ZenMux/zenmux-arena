#!/bin/bash
# Shared snapshots persist independently of deployments. Default: readiness only.
set -euo pipefail

if [[ "${1:-}" != "" && "${1:-}" != "--refresh" ]]; then
  echo "Usage: predeploy.sh [--refresh]" >&2
  exit 2
fi

pnpm supabase:check --require-data
if [[ "${1:-}" == "--refresh" ]]; then
  for module in tokenecon tokendeals; do
    if pnpm "$module:precompute"; then
      echo "[$module] shared refresh succeeded"
    else
      echo "[$module] REFRESH FAILED: retaining the previous Supabase snapshot" >&2
    fi
  done
  # Re-check usability and print actual persisted cutoffs after both attempts.
  pnpm supabase:check --require-data
fi

echo "Shared data is ready. Build/package code without .cache or .env files."
