#!/usr/bin/env bash
set -euo pipefail

# Root detection must be deterministic and must not depend on git.
# The repo root is defined as the physical directory containing:
# - .aperion-root
# - package.json
# - pnpm-lock.yaml
# - ./dev

# The root is computed from the location of ./dev, not from $PWD.

devshell_detect_repo_root() {
  local entry_file="$1"
  local entry_abs
  entry_abs="$(devshell_abspath_file "$entry_file")" || return 1
  devshell_abspath_dir "$(dirname -- "$entry_abs")"
}

devshell_assert_repo_root_is_valid() {
  local repo_root="$1"

  [[ -f "$repo_root/.aperion-root" ]] || devshell_die "missing root sentinel: $repo_root/.aperion-root"
  [[ -f "$repo_root/package.json" ]] || devshell_die "missing required file: $repo_root/package.json"
  [[ -f "$repo_root/pnpm-lock.yaml" ]] || devshell_die "missing required file: $repo_root/pnpm-lock.yaml"
  [[ -f "$repo_root/dev" ]] || devshell_die "missing required entrypoint file: $repo_root/dev"
}

devshell_assert_invoked_from_repo_root() {
  local repo_root="$1"
  local pwd_physical
  pwd_physical="$(pwd -P)"

  if [[ "$pwd_physical" != "$repo_root" ]]; then
    devshell_die "refusing to run outside repo root\n  expected: $repo_root\n  actual:   $pwd_physical\n\nRemediation:\n  cd \"$repo_root\" && ./dev help"
  fi
}
