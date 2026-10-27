#!/bin/bash
# Public releases consume already-published data; producers run independently.
set -euo pipefail
if [[ $# -ne 0 ]]; then
  echo "Usage: predeploy.sh (run the internal producer separately to refresh data)" >&2
  exit 2
fi
pnpm supabase:check --require-data
echo "Shared data is ready. Build/package the public read-only application."
