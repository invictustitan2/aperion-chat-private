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
