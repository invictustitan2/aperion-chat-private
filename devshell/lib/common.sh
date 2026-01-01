#!/usr/bin/env bash
set -euo pipefail

devshell_now_iso_utc() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

devshell_die() {
  printf 'ERROR: %b\n' "$*" >&2
  return 1
}

devshell_note() {
  printf '%s\n' "$*"
}

devshell_warn() {
  printf 'WARN: %s\n' "$*" >&2
}

devshell_has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

devshell_require_cmd() {
  devshell_has_cmd "$1" || devshell_die "missing required command: $1"
}

devshell_trim() {
  sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

devshell_abspath_dir() {
  local dir="$1"
  (cd "$dir" >/dev/null 2>&1 && pwd -P) || return 1
}

devshell_abspath_file() {
  local path="$1"
  local dir
  dir="$(dirname -- "$path")"
  dir="$(devshell_abspath_dir "$dir")" || return 1
  printf '%s/%s\n' "$dir" "$(basename -- "$path")"
}

devshell__dotenv_strip_quotes() {
  local value="$1"

  # Strip matching surrounding quotes best-effort.
  if [[ "$value" == '"'*'"' ]]; then
    value="${value#\"}"
    value="${value%\"}"
  elif [[ "$value" == "'"*"'" ]]; then
    value="${value#\'}"
    value="${value%\'}"
  fi

  printf '%s' "$value"
}

devshell_export_dotenv_file() {
  local file="$1"

  [[ -f "$file" ]] || return 0

  # Parse KEY=VALUE lines safely (do NOT source arbitrary shell).
  # Accept optional leading `export `, ignore comments/blank lines.
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -n "$line" ]] || continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue

    line="${line#export }"
    [[ "$line" == *'='* ]] || continue

    local key="${line%%=*}"
    local value="${line#*=}"

    # Trim whitespace in key.
    key="$(printf '%s' "$key" | devshell_trim)"
    [[ -n "$key" ]] || continue

    value="$(devshell__dotenv_strip_quotes "$value")"

    # Only accept sane variable names.
    if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      export "$key=$value"
    fi
  done <"$file"
}

devshell_load_repo_dotenv() {
  local repo_root="$1"

  # Load in a predictable order: .dev.vars first, then .env.
  # This matches typical expectations: .env can override .dev.vars.
  devshell_export_dotenv_file "${repo_root}/.dev.vars"
  devshell_export_dotenv_file "${repo_root}/.env"
}

devshell_wrangler_detect_default_env() {
  local wrangler_toml="$1"

  if [[ -f "$wrangler_toml" ]] && grep -Eq '^[[:space:]]*\[env\.production\][[:space:]]*$' "$wrangler_toml"; then
    printf '%s' 'production'
    return 0
  fi

  # No explicit default. Returning empty means: do not pass --env.
  printf '%s' ''
}

devshell_wrangler_list_envs() {
  local wrangler_toml="$1"

  [[ -f "$wrangler_toml" ]] || {
    printf '%s' ''
    return 0
  }

  # Extract env names from section headers like:
  #   [env.test]
  #   [env.test.vars]
  #   [env.preview]
  # Deterministic output: sorted, unique, comma-separated.
  local envs
  envs="$(
    awk '
      match($0, /^\[env\.([A-Za-z0-9_-]+)(\]|\.)/, m) { print m[1] }
    ' "$wrangler_toml" | sort -u
  )"

  if [[ -z "$envs" ]]; then
    printf '%s' ''
    return 0
  fi

  printf '%s' "$envs" | paste -sd, -
}

devshell_wrangler_env_is_valid() {
  local wrangler_toml="$1"
  local name="${2:-}"

  # Empty means "no --env" (top-level config) which is always valid.
  if [[ -z "$name" ]]; then
    printf '%s' 'yes'
    return 0
  fi

  local envs_csv
  envs_csv="$(devshell_wrangler_list_envs "$wrangler_toml")"

  if [[ -z "$envs_csv" ]]; then
    printf '%s' 'no'
    return 0
  fi

  local IFS=','
  local env
  for env in $envs_csv; do
    if [[ "$env" == "$name" ]]; then
      printf '%s' 'yes'
      return 0
    fi
  done

  printf '%s' 'no'
}

devshell_wrangler_effective_env() {
  local wrangler_toml="$1"
  local cli_env="${2:-}"

  if [[ -n "$cli_env" ]]; then
    printf '%s' "$cli_env"
    return 0
  fi

  if [[ -n "${APERION_WRANGLER_ENV:-}" ]]; then
    printf '%s' "${APERION_WRANGLER_ENV}"
    return 0
  fi

  devshell_wrangler_detect_default_env "$wrangler_toml"
}

devshell_wrangler_env_display() {
  local effective_env="${1:-}"
  if [[ -n "$effective_env" ]]; then
    printf '%s' "$effective_env"
  else
    printf '%s' 'none'
  fi
}

devshell_wrangler_env_available_display() {
  local envs_csv="${1:-}"
  if [[ -n "$envs_csv" ]]; then
    printf '%s' "$envs_csv"
  else
    printf '%s' 'none'
  fi
}

devshell_wrangler_env_report() {
  local wrangler_toml="$1"
  local effective_env="${2:-}"

  local envs_csv valid
  envs_csv="$(devshell_wrangler_list_envs "$wrangler_toml")"
  valid="$(devshell_wrangler_env_is_valid "$wrangler_toml" "$effective_env")"

  printf 'WRANGLER.ENV.EFFECTIVE: %s\n' "$(devshell_wrangler_env_display "$effective_env")"
  printf 'WRANGLER.ENV.VALID: %s\n' "$valid"
  printf 'WRANGLER.ENV.AVAILABLE: %s\n' "$(devshell_wrangler_env_available_display "$envs_csv")"
}
