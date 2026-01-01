#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

# cf:worker:deploy
#
# Deploys the API Worker deterministically (env-aware) with safety rails.
#
# Hard rules:
# - Never print secrets.
# - Network must be opt-in (RUN_NETWORK_TESTS=1) because this hits Cloudflare.
#
# Behavior:
# - Always print WRANGLER.ENV.* (effective/valid/available).
# - If env invalid -> fail fast (no build, no wrangler).
# - If RUN_NETWORK_TESTS!=1 -> SKIP and exit 0.

# shellcheck source=devshell/lib/common.sh
source "${repo_root}/devshell/lib/common.sh"

cli_env=''
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --env)
      shift || true
      cli_env="${1:-}"
      if [[ -z "$cli_env" ]]; then
        printf '%s\n' 'ERROR: --env requires a value' >&2
        exit 2
      fi
      shift || true
      ;;
    --env=*)
      cli_env="${1#--env=}"
      if [[ -z "$cli_env" ]]; then
        printf '%s\n' 'ERROR: --env requires a value' >&2
        exit 2
      fi
      shift || true
      ;;
    *)
      printf 'ERROR: unknown arg: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

worker_dir="${repo_root}/apps/api-worker"
wrangler_toml="${worker_dir}/wrangler.toml"

effective_env="$(devshell_wrangler_effective_env "$wrangler_toml" "$cli_env")"
devshell_wrangler_env_report "$wrangler_toml" "$effective_env"

env_valid="$(devshell_wrangler_env_is_valid "$wrangler_toml" "$effective_env")"
if [[ "$env_valid" != 'yes' ]]; then
  printf '%s\n' 'ERROR: invalid Wrangler env for apps/api-worker.' >&2
  printf '%s\n' "NEXT: choose one of: $(devshell_wrangler_env_available_display "$(devshell_wrangler_list_envs "$wrangler_toml")")" >&2
  exit 2
fi

if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
  printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable Cloudflare deploy.'
  exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
  printf '%s\n' 'ERROR: missing required command: pnpm' >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  printf '%s\n' 'ERROR: missing required command: npx' >&2
  exit 1
fi

pnpm -s --filter @aperion/api-worker build >/dev/null

cd "$worker_dir"

env_args=()
if [[ -n "$effective_env" ]]; then
  env_args+=(--env "$effective_env")
fi

# Capture output so we can print a stable summary only.
set +e
wrangler_out="$(npx wrangler deploy "${env_args[@]}" 2>&1)"
wrangler_status=$?
set -e

if [[ "$wrangler_status" -ne 0 ]]; then
  printf '%s\n' 'WORKER.DEPLOY.OK: no'
  # Best-effort: surface one actionable line without dumping full logs.
  err_line="$(printf '%s\n' "$wrangler_out" | grep -E -m 1 '(ERROR|Error|\[ERROR\]|✘)' || true)"
  if [[ -n "$err_line" ]]; then
    printf 'WORKER.DEPLOY.ERROR: %s\n' "$err_line"
  fi
  printf '%s\n' 'NEXT: re-run with raw wrangler for full logs:'
  if [[ -n "$effective_env" ]]; then
    printf '  cd apps/api-worker && npx wrangler deploy --env %s\n' "$effective_env"
  else
    printf '%s\n' '  cd apps/api-worker && npx wrangler deploy'
  fi
  exit "$wrangler_status"
fi

printf '%s\n' 'WORKER.DEPLOY.OK: yes'

# Wrangler commonly prints a UUID-ish "Version ID". Extract if present.
version_id="$(printf '%s\n' "$wrangler_out" | grep -Eo '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' | head -n 1 || true)"
if [[ -n "$version_id" ]]; then
  printf 'WORKER.DEPLOY.VERSION_ID: %s\n' "$version_id"
fi
