#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

exec "${repo_root}/scripts/vscode-log-capture.sh" stop "$@"
