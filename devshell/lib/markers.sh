#!/usr/bin/env bash
set -euo pipefail

devshell_assert_no_marker_collision() {
  local expected_name="$1"
  local expected_root="$2"

  if [[ "${APERION_ACTIVE_DEV_SHELL-}" != "" ]] && [[ "${APERION_ACTIVE_DEV_SHELL}" != "$expected_name" ]]; then
    devshell_die "dev shell collision: APERION_ACTIVE_DEV_SHELL is already set to '${APERION_ACTIVE_DEV_SHELL}', expected '${expected_name}'"
  fi

  if [[ "${APERION_ACTIVE_DEV_SHELL-}" == "$expected_name" ]] && [[ "${APERION_DEV_SHELL_ROOT-}" != "" ]] && [[ "${APERION_DEV_SHELL_ROOT}" != "$expected_root" ]]; then
    devshell_die "dev shell collision: APERION_ACTIVE_DEV_SHELL matches but APERION_DEV_SHELL_ROOT differs\n  expected: $expected_root\n  actual:   ${APERION_DEV_SHELL_ROOT}"
  fi

  if [[ "${APERION_DEV_SHELL_ROOT-}" != "" ]] && [[ "${APERION_ACTIVE_DEV_SHELL-}" != "$expected_name" ]]; then
    devshell_die "dev shell collision: APERION_DEV_SHELL_ROOT is set but APERION_ACTIVE_DEV_SHELL is not '${expected_name}'"
  fi
}

devshell_export_markers() {
  local name="$1"
  local root="$2"

  export APERION_ACTIVE_DEV_SHELL="$name"
  export APERION_DEV_SHELL_ROOT="$root"
}
