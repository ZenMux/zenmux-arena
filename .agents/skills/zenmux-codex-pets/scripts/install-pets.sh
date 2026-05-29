#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Install bundled ZenMux Codex APP pets.

Usage:
  install-pets.sh [--target DIR] [--source DIR] [--dry-run] [--list]

Options:
  --target DIR  Destination pets directory. Defaults to ${CODEX_HOME:-$HOME/.codex}/pets.
  --source DIR  Source pets directory. Defaults to ../pets relative to this script.
  --dry-run     Show what would be installed without copying files.
  --list        List bundled pet names and exit.
  -h, --help    Show this help.
USAGE
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(cd "$script_dir/.." && pwd)"
source_dir="$skill_dir/pets"
target_dir="${CODEX_HOME:-$HOME/.codex}/pets"
dry_run=0
list_only=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target)
      if [ "$#" -lt 2 ]; then
        echo "error: --target requires a directory" >&2
        exit 2
      fi
      target_dir="$2"
      shift 2
      ;;
    --source)
      if [ "$#" -lt 2 ]; then
        echo "error: --source requires a directory" >&2
        exit 2
      fi
      source_dir="$2"
      shift 2
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    --list)
      list_only=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ ! -d "$source_dir" ]; then
  echo "error: source pets directory not found: $source_dir" >&2
  exit 1
fi

pet_dirs=()
while IFS= read -r pet_dir; do
  pet_dirs+=("$pet_dir")
done < <(find "$source_dir" -mindepth 1 -maxdepth 1 -type d | sort)

if [ "${#pet_dirs[@]}" -eq 0 ]; then
  echo "No bundled pets found under: $source_dir"
  exit 0
fi

if [ "$list_only" -eq 1 ]; then
  echo "Bundled ZenMux Codex APP pets:"
  for pet_dir in "${pet_dirs[@]}"; do
    echo "- $(basename "$pet_dir")"
  done
  exit 0
fi

installed=()
if [ "$dry_run" -eq 0 ]; then
  mkdir -p "$target_dir"
fi

for pet_dir in "${pet_dirs[@]}"; do
  pet_name="$(basename "$pet_dir")"
  dest_dir="$target_dir/$pet_name"
  installed+=("$pet_name")

  if [ "$dry_run" -eq 1 ]; then
    echo "Would install $pet_name -> $dest_dir"
    continue
  fi

  mkdir -p "$dest_dir"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --exclude='.DS_Store' "$pet_dir/" "$dest_dir/"
  else
    find "$pet_dir" -mindepth 1 -maxdepth 1 ! -name '.DS_Store' -exec cp -R {} "$dest_dir/" \;
  fi
done

if [ "$dry_run" -eq 1 ]; then
  echo "Dry run complete. Target would be: $target_dir"
else
  echo "Installed ZenMux Codex APP pets to: $target_dir"
fi
for pet_name in "${installed[@]}"; do
  echo "- $pet_name"
done
echo
echo "Manual install option:"
echo "Copy each folder under $source_dir into ${CODEX_HOME:-$HOME/.codex}/pets, then use the pets in Codex APP."
