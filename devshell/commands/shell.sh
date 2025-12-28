#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

if [[ -x "./scripts/dev-shell.sh" ]]; then
  exec ./scripts/dev-shell.sh "$@"
fi

echo "shell: scripts/dev-shell.sh not found or not executable" >&2
exit 1
