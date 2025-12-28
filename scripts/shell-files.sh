#!/usr/bin/env bash
set -euo pipefail

# Emits a NUL-separated list of shell files for devshell tooling.
# Intentionally scoped to the devshell implementation files so we don't
# impose formatting/linting requirements on unrelated repo scripts.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "${script_dir}/.." && pwd -P)"

# devshell CLI (no extension)
printf '%s\0' "${repo_root}/devshell/devshell"

# devshell libs
find "${repo_root}/devshell/lib" -type f -name '*.sh' -print0

# devshell-related scripts
printf '%s\0' "${repo_root}/scripts/bootstrap-dev.sh"
printf '%s\0' "${repo_root}/scripts/dev-shell.sh"
printf '%s\0' "${repo_root}/scripts/shell-files.sh"
