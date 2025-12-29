#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# cf:worker:ensure-domain
#
# Wrapper around scripts/ensure-worker-domain.sh that:
# - loads repo dotenv via ./dev (already done before dispatch)
# - keeps network opt-in via RUN_NETWORK_TESTS=1
# - is safe-by-default (scripts/ensure-worker-domain.sh requires --apply to mutate)

if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
  printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable network actions.'
  exit 3
fi

exec bash "${repo_root}/scripts/ensure-worker-domain.sh" "$@"
