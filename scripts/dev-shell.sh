#!/usr/bin/env bash
set -euo pipefail

# Thin wrapper for backwards compatibility.
# Canonical dev shell entrypoint is: devshell/devshell

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "${script_dir}/.." && pwd -P)"

exec "${repo_root}/devshell/devshell" enter "$@"
