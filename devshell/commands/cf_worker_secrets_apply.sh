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

# cf:worker:secrets:apply
#
# Interactively applies required Worker secrets to apps/api-worker using
# `wrangler secret put <KEY>` via stdin.
#
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

# Hard rules:
# - Never print secret values.
# - Never put secret values into argv.
# - Network must be opt-in (RUN_NETWORK_TESTS=1).
# - Must refuse to run without a TTY.

if [[ "${RUN_NETWORK_TESTS:-0}" != "1" ]]; then
  printf '%s\n' 'SKIP: Set RUN_NETWORK_TESTS=1 to enable network probes.'
  exit 3
fi

# Refuse if not interactive (prevents accidental secret prompts in CI/logs).
if [[ ! -t 0 || ! -t 1 ]]; then
  printf '%s\n' 'REFUSE: cf:worker:secrets:apply requires a TTY (interactive terminal).' >&2
  exit 2
fi

# Load repo-local dotenv again (safe parser); ensures .dev.vars/.env are available.
devshell_load_repo_dotenv "$repo_root" || true

worker_name=''
if [[ -f "$wrangler_toml" ]]; then
  worker_name="$(awk -F= '/^name[[:space:]]*=/{gsub(/["[:space:]]/,"",$2); print $2; exit}' "$wrangler_toml" || true)"
fi
if [[ -z "$worker_name" ]]; then
  worker_name='aperion-api-worker'
fi

cd "$worker_dir"

env_args=()
env_flag_args=()
if [[ -n "$effective_env" ]]; then
  env_args+=(--env "$effective_env")
  env_flag_args+=(--env "$effective_env")
fi

required_keys=(
  'APERION_AUTH_MODE'
  'CF_ACCESS_TEAM_DOMAIN'
  'CF_ACCESS_AUD'
)

all_values_present='yes'
for key in "${required_keys[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    all_values_present='no'
    break
  fi
done

prompt_yes_no() {
  local prompt="$1"
  local default_yes="$2" # 'yes' or 'no'
  local ans

  while true; do
    if [[ "$default_yes" == 'yes' ]]; then
      printf '%s [Y/n]: ' "$prompt" >&2
    else
      printf '%s [y/N]: ' "$prompt" >&2
    fi

    IFS= read -r ans
    ans="${ans:-}"

    if [[ -z "$ans" ]]; then
      if [[ "$default_yes" == 'yes' ]]; then
        printf '%s' 'yes'
      else
        printf '%s' 'no'
      fi
      return 0
    fi

    case "${ans}" in
      y|Y|yes|YES)
        printf '%s' 'yes'
        return 0
        ;;
      n|N|no|NO)
        printf '%s' 'no'
        return 0
        ;;
      *)
        printf '%s\n' 'Please answer y/n.' >&2
        ;;
    esac
  done
}

read_secret_value() {
  local key="$1"
  local existing="${!key:-}"

  if [[ -n "$existing" ]]; then
    printf '%s' "$existing"
    return 0
  fi

  # Secret not present in env; prompt user without echo.
  printf '%s' "Enter value for ${key} (input hidden): " >&2
  local value
  IFS= read -r -s value
  printf '\n' >&2
  printf '%s' "$value"
}

# Print a tiny header (no secret values).
printf 'WORKER.NAME: %s\n' "$worker_name"

if [[ "$all_values_present" == 'yes' ]]; then
  printf '%s\n' 'MODE: auto'
  for key in "${required_keys[@]}"; do
    value="${!key}"
    printf '%s' "$value" | npx wrangler secret put "$key" --name "$worker_name" "${env_args[@]}" >/dev/null
    printf 'APPLIED.%s: yes\n' "$key"
  done

  "${repo_root}/devshell/commands/cf_worker_secrets_list.sh" "$repo_root" "${env_flag_args[@]}"
  exit 0
fi

printf '%s\n' 'MODE: interactive'

for key in "${required_keys[@]}"; do
  choice="$(prompt_yes_no "Set Worker secret ${key}?" 'yes')"
  if [[ "$choice" != 'yes' ]]; then
    printf 'SKIP.%s: yes\n' "$key"
    continue
  fi

  value="$(read_secret_value "$key")"
  if [[ -z "$value" ]]; then
    printf 'SKIP.%s: yes\n' "$key"
    continue
  fi

  # Apply via stdin (never appears in argv).
  printf '%s' "$value" | npx wrangler secret put "$key" --name "$worker_name" "${env_args[@]}" >/dev/null
  printf 'APPLIED.%s: yes\n' "$key"

done

# Re-print presence-only report by delegating to secrets:list.
"${repo_root}/devshell/commands/cf_worker_secrets_list.sh" "$repo_root" "${env_flag_args[@]}"
