#!/usr/bin/env bash
# Build the ENGLISH edition of the "Who Are You?" report end-to-end:
#   1. regenerate all English figures + tables from the mix aggregate (PAPER_LANG=en)
#   2. compile main_en.tex (twice, to resolve cross-references)
#
# The English paper uses the standard `article` class, so it compiles with either
# pdflatex or xelatex. We default to xelatex (already installed for the Chinese
# build); set TEX_ENGINE=pdflatex to use pdfLaTeX instead.
#
# Usage:  bash paper/build_en.sh        (run from the repo root OR from paper/)
set -euo pipefail

export PATH="/Library/TeX/texbin:$PATH"
TEX_ENGINE="${TEX_ENGINE:-xelatex}"

# Resolve the directory this script lives in, so it works from anywhere.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> [1/2] Regenerating ENGLISH figures + tables from aggregate.json"
( cd "$REPO_ROOT" && PAPER_LANG=en npx tsx paper/scripts/build_all.ts )

echo "==> [2/2] Compiling main_en.tex with $TEX_ENGINE (pass 1/2)"
( cd "$SCRIPT_DIR" && "$TEX_ENGINE" -interaction=nonstopmode -halt-on-error main_en.tex >/dev/null )
echo "==> Compiling main_en.tex with $TEX_ENGINE (pass 2/2, resolving refs)"
( cd "$SCRIPT_DIR" && "$TEX_ENGINE" -interaction=nonstopmode -halt-on-error main_en.tex >/dev/null )

echo "==> Done. Output: $SCRIPT_DIR/main_en.pdf"
if command -v pdfinfo >/dev/null 2>&1; then
  pdfinfo "$SCRIPT_DIR/main_en.pdf" | grep -E "Pages|File size" || true
fi
