#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

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

# cf:worker:secrets:list
#
# Lists Cloudflare Worker secret NAMES (never values) for apps/api-worker.
#
# Hard rules:
# - Never print secrets.
# - Network must be opt-in (RUN_NETWORK_TESTS=1).

if ! command -v npx >/dev/null 2>&1; then
  printf '%s\n' 'ERROR: missing required command: npx' >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' 'ERROR: missing required command: jq' >&2
  exit 1
fi

worker_dir="${repo_root}/apps/api-worker"
wrangler_toml="${worker_dir}/wrangler.toml"

effective_env="$(devshell_wrangler_effective_env "$wrangler_toml" "$cli_env")"
devshell_wrangler_env_report "$wrangler_toml" "$effective_env"

env_valid="$(devshell_wrangler_env_is_valid "$wrangler_toml" "$effective_env")"

if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
  printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable network probes.'
  exit 3
fi

if [[ "$env_valid" != 'yes' ]]; then
  printf '%s\n' 'ERROR: invalid Wrangler env for apps/api-worker.' >&2
  printf '%s\n' "NEXT: choose one of: $(devshell_wrangler_env_available_display "$(devshell_wrangler_list_envs "$wrangler_toml")")" >&2
  exit 2
fi

worker_name=''
if [[ -f "$wrangler_toml" ]]; then
  # Best-effort: first top-level `name = "..."`.
  worker_name="$(awk -F= '/^name[[:space:]]*=/{gsub(/["[:space:]]/,"",$2); print $2; exit}' "$wrangler_toml" || true)"
fi

if [[ -z "$worker_name" ]]; then
  worker_name='aperion-api-worker'
fi

cd "$worker_dir"

# `wrangler secret list --format json` returns secret names only.
env_args=()
if [[ -n "$effective_env" ]]; then
  env_args+=(--env "$effective_env")
fi

secrets_raw="$(npx wrangler secret list --name "$worker_name" --format json "${env_args[@]}")"
secrets_names="$(printf '%s' "$secrets_raw" | jq -r '.[].name' | grep -E '^[A-Za-z_][A-Za-z0-9_]*$' || true)"

required_keys=(
  'APERION_AUTH_MODE'
  'CF_ACCESS_TEAM_DOMAIN'
  'CF_ACCESS_AUD'
)

printf 'WORKER.NAME: %s\n' "$worker_name"

count="$(printf '%s\n' "$secrets_names" | grep -c '.' || true)"
printf 'SECRETS.COUNT: %s\n' "${count:-0}"

idx=0
while IFS= read -r name; do
  [[ -n "$name" ]] || continue
  printf 'SECRETS.NAMES.%s: %s\n' "$idx" "$name"
  idx=$((idx + 1))
done <<<"$secrets_names"

all_present='yes'
for key in "${required_keys[@]}"; do
  present='no'
  if printf '%s\n' "$secrets_names" | grep -Fxq "$key"; then
    present='yes'
  else
    all_present='no'
  fi
  printf 'REQUIRED_PRESENT.%s: %s\n' "$key" "$present"
done

printf 'REQUIRED_PRESENT: %s\n' "$all_present"

if [[ "$all_present" != 'yes' ]]; then
  printf '\nNEXT:\n'
  printf '%s\n' '  RUN_NETWORK_TESTS=1 ./dev cf:worker:secrets:apply'
  printf '%s\n' '  # Or manual (safe template; uses stdin, not argv):'
  printf '%s\n' '  cd apps/api-worker'
  printf '%s\n' '  printf "%s" "$APERION_AUTH_MODE" | npx wrangler secret put APERION_AUTH_MODE'
  printf '%s\n' '  printf "%s" "$CF_ACCESS_TEAM_DOMAIN" | npx wrangler secret put CF_ACCESS_TEAM_DOMAIN'
  printf '%s\n' '  printf "%s" "$CF_ACCESS_AUD" | npx wrangler secret put CF_ACCESS_AUD'
fi
