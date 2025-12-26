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
