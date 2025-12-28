#!/usr/bin/env bash
set -euo pipefail

# devshell/entry.sh
#
# This file is sourced by ./dev (the ONLY entrypoint).
# It contains the command dispatcher and safety rails.

# shellcheck source=devshell/lib/common.sh
source "${DEV_SHELL_LIB_DIR}/common.sh"
# shellcheck source=devshell/lib/sentinel.sh
source "${DEV_SHELL_LIB_DIR}/sentinel.sh"
# shellcheck source=devshell/lib/markers.sh
source "${DEV_SHELL_LIB_DIR}/markers.sh"

DEV_SHELL_NAME='aperion-chat-private'

print_help() {
  cat <<'HELP'
aperion-chat-private — sovereign dev shell (Workers/Pages-first)

Usage:
  ./dev <command> [args]

Commands:
  help               Show this help
  verify             Run the existing Private verification gate (no behavior change)
  verify:ci          Run the CI-grade verification gate (strict)
  shell              Launch the legacy interactive dev shell (scripts/dev-shell.sh)
  cf:doctor          Run Cloudflare preflight checks (read-only)
  ide:status         Print IDE/environment context status
  secrets:status     Print redacted secret status

Notes:
  - Repo-root-only: run from the directory containing ./dev
  - No secrets are printed; status is set/unset only
HELP
}

assert_common_preconditions() {
  local repo_root="$1"

  devshell_assert_repo_root_is_valid "$repo_root"
  devshell_assert_invoked_from_repo_root "$repo_root"

  devshell_assert_no_marker_collision "$DEV_SHELL_NAME" "$repo_root"
  devshell_export_markers "$DEV_SHELL_NAME" "$repo_root"
}

devshell_dispatch() {
  local repo_root="$1"
  shift

  local cmd="${1:-help}"
  shift || true

  case "$cmd" in
    help|-h|--help)
      print_help
      ;;

    verify)
      "${repo_root}/devshell/commands/verify.sh" "$repo_root" "$@"
      ;;

    verify:ci)
      "${repo_root}/devshell/commands/verify_ci.sh" "$repo_root" "$@"
      ;;

    shell)
      "${repo_root}/devshell/commands/shell.sh" "$repo_root" "$@"
      ;;

    cf:doctor)
      "${repo_root}/devshell/commands/cf_doctor.sh" "$repo_root" "$@"
      ;;

    ide:status)
      "${repo_root}/devshell/commands/ide_status.sh" "$repo_root" "$@"
      ;;

    secrets:status)
      "${repo_root}/devshell/commands/secrets_status.sh" "$repo_root" "$@"
      ;;

    *)
      devshell_die "unknown command: $cmd\n\nTry: ./dev help"
      ;;
  esac
}
