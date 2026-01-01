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
  deploy:prod         Orchestrate receipt-first prod deploy (safe)
  deploy:validate     Quick network-gated prod validator (safe)
  shell              Launch the legacy interactive dev shell (scripts/dev-shell.sh)
  cf:doctor          Run Cloudflare preflight checks (read-only)
  cf:worker:audit    Audit DNS + Worker binding for api.aperion.cc (safe; no secrets)
  cf:worker:smoke    Probe prod endpoints via service token (safe; no secrets)
  cf:worker:deploy   Deploy API Worker (env-aware; safe summary)
  cf:worker:secrets:list  List Worker secret names + required presence (safe; no secrets)
  cf:worker:secrets:apply Interactively set required Worker secrets (safe; no secrets)
  cf:worker:ensure-domain Ensure Worker custom domain is prepareable (dry-run by default)
  cf:pages:deploy    Deploy Cloudflare Pages (build-var safe)
  cf:access:bootstrap Bootstrap Access IDs (safe; no secrets)
  cf:access:audit    Audit Cloudflare Access apps/policies (safe; no secrets)
  ide:status         Print IDE/environment context status
  secrets:status     Print redacted secret status
  secrets:where      Show where secrets are sourced (safe)
  secrets:set        Interactively set repo-local secrets (safe)
  secrets:wizard     Interactive secrets configurator (safe)
  secrets:doctor     Diagnose secret overrides (safe)
  access:debug       Debug Access service-token redirects (safe)
  access:probe       Probe api.aperion.cc with/without service token headers (safe)
  vscode:logs:start  Start VS Code log capture into receipts/
  vscode:logs:stop   Stop VS Code log capture
  vscode:logs:status Show VS Code log capture status

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

    deploy:prod)
      "${repo_root}/devshell/commands/deploy_prod.sh" "$repo_root" "$@"
      ;;

    deploy:validate)
      "${repo_root}/devshell/commands/deploy_validate.sh" "$repo_root" "$@"
      ;;

    shell)
      "${repo_root}/devshell/commands/shell.sh" "$repo_root" "$@"
      ;;

    cf:doctor)
      "${repo_root}/devshell/commands/cf_doctor.sh" "$repo_root" "$@"
      ;;

    cf:worker:audit)
      "${repo_root}/devshell/commands/cf_worker_audit.sh" "$repo_root" "$@"
      ;;

    cf:worker:smoke)
      "${repo_root}/devshell/commands/cf_worker_smoke.sh" "$repo_root" "$@"
      ;;

    cf:worker:deploy)
      "${repo_root}/devshell/commands/cf_worker_deploy.sh" "$repo_root" "$@"
      ;;

    cf:worker:secrets:list)
      "${repo_root}/devshell/commands/cf_worker_secrets_list.sh" "$repo_root" "$@"
      ;;

    cf:worker:secrets:apply)
      "${repo_root}/devshell/commands/cf_worker_secrets_apply.sh" "$repo_root" "$@"
      ;;

    cf:worker:ensure-domain)
      "${repo_root}/devshell/commands/cf_worker_ensure_domain.sh" "$repo_root" "$@"
      ;;

    cf:pages:deploy)
      "${repo_root}/devshell/commands/cf_pages_deploy.sh" "$repo_root" "$@"
      ;;

    cf:access:bootstrap)
      "${repo_root}/devshell/commands/cf_access_bootstrap.sh" "$repo_root" "$@"
      ;;

    cf:access:audit)
      "${repo_root}/devshell/commands/cf_access_audit.sh" "$repo_root" "$@"
      ;;

    ide:status)
      "${repo_root}/devshell/commands/ide_status.sh" "$repo_root" "$@"
      ;;

    secrets:status)
      "${repo_root}/devshell/commands/secrets_status.sh" "$repo_root" "$@"
      ;;

    secrets:where)
      "${repo_root}/devshell/commands/secrets_where.sh" "$repo_root" "$@"
      ;;

    secrets:set)
      "${repo_root}/devshell/commands/secrets_set.sh" "$repo_root" "$@"
      ;;

    secrets:wizard)
      "${repo_root}/devshell/commands/secrets_wizard.sh" "$repo_root" "$@"
      ;;

    secrets:doctor)
      "${repo_root}/devshell/commands/secrets_doctor.sh" "$repo_root" "$@"
      ;;

    access:debug)
      "${repo_root}/devshell/commands/access_debug.sh" "$repo_root" "$@"
      ;;

    access:probe)
      "${repo_root}/devshell/commands/access_probe.sh" "$repo_root" "$@"
      ;;

    vscode:logs:start)
      "${repo_root}/devshell/commands/vscode_logs_start.sh" "$repo_root" "$@"
      ;;

    vscode:logs:stop)
      "${repo_root}/devshell/commands/vscode_logs_stop.sh" "$repo_root" "$@"
      ;;

    vscode:logs:status)
      "${repo_root}/devshell/commands/vscode_logs_status.sh" "$repo_root" "$@"
      ;;

    *)
      devshell_die "unknown command: $cmd\n\nTry: ./dev help"
      ;;
  esac
}
