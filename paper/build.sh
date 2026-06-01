#!/usr/bin/env bash
# Build the "Who Are You?" report end-to-end:
#   1. regenerate all data-derived figures + tables from the mix aggregate
#   2. compile main.tex with XeLaTeX (twice, to resolve cross-references)
#
# BasicTeX installs xelatex under /Library/TeX/texbin, which is not always on PATH.
# We prepend it here so the script works from a fresh shell.
#
# Usage:  bash paper/build.sh        (run from the repo root OR from paper/)
set -euo pipefail

export PATH="/Library/TeX/texbin:$PATH"

# Resolve the directory this script lives in, so it works from anywhere.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> [1/2] Regenerating figures + tables from aggregate.json"
( cd "$REPO_ROOT" && npx tsx paper/scripts/build_all.ts )

echo "==> [2/2] Compiling main.tex with XeLaTeX (pass 1/2)"
( cd "$SCRIPT_DIR" && xelatex -interaction=nonstopmode -halt-on-error main.tex >/dev/null )
echo "==> Compiling main.tex with XeLaTeX (pass 2/2, resolving refs)"
( cd "$SCRIPT_DIR" && xelatex -interaction=nonstopmode -halt-on-error main.tex >/dev/null )

echo "==> Done. Output: $SCRIPT_DIR/main.pdf"
if command -v pdfinfo >/dev/null 2>&1; then
  pdfinfo "$SCRIPT_DIR/main.pdf" | grep -E "Pages|File size" || true
fi
