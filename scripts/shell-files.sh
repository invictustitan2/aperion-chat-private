#!/usr/bin/env bash
set -euo pipefail

# Emits a NUL-separated list of shell files for devshell tooling.
# Intentionally scoped to the devshell implementation files so we don't
# impose formatting/linting requirements on unrelated repo scripts.

usage() {
  cat <<'HELP'
Usage:
	./scripts/shell-files.sh [shfmt|shellcheck] [--lines]

Default output is NUL-separated (safe for xargs -0).

Options:
	--lines   Print one path per line (for humans/debugging only)

Notes:
	Tool name args are accepted for readability but do not change output.
HELP
}

mode="nul"
for arg in "$@"; do
  case "$arg" in
  --lines)
    mode="lines"
    ;;
  -h | --help)
    usage
    exit 0
    ;;
  shfmt | shellcheck)
    # accepted but intentionally unused
    ;;
  *)
    echo "ERROR: unknown arg: ${arg}" >&2
    usage >&2
    exit 2
    ;;
  esac
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "${script_dir}/.." && pwd -P)"

if [[ "$mode" == "lines" ]]; then
  printf '%s\n' "${repo_root}/devshell/devshell"
  find "${repo_root}/devshell/lib" -type f -name '*.sh' -print
  printf '%s\n' "${repo_root}/scripts/bootstrap-dev.sh"
  printf '%s\n' "${repo_root}/scripts/dev-shell.sh"
  printf '%s\n' "${repo_root}/scripts/shell-files.sh"
  exit 0
fi

# devshell CLI (no extension)
printf '%s\0' "${repo_root}/devshell/devshell"

# devshell libs
find "${repo_root}/devshell/lib" -type f -name '*.sh' -print0

# devshell-related scripts
printf '%s\0' "${repo_root}/scripts/bootstrap-dev.sh"
printf '%s\0' "${repo_root}/scripts/dev-shell.sh"
printf '%s\0' "${repo_root}/scripts/shell-files.sh"
