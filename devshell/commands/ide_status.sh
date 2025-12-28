#!/usr/bin/env bash
set -euo pipefail

repo_root="$1"
shift || true

cd "$repo_root"

pwd_physical="$(pwd -P)"

remote_containers_set='no'
devcontainer_set='no'
dockerenv_present='no'

if [[ -n "${REMOTE_CONTAINERS-}" ]]; then
  remote_containers_set='yes'
fi
if [[ -n "${DEVCONTAINER-}" ]]; then
  devcontainer_set='yes'
fi
if [[ -f "/.dockerenv" ]]; then
  dockerenv_present='yes'
fi

in_dev_container='no'
container_detected_by=''
if [[ "$remote_containers_set" == 'yes' || "$devcontainer_set" == 'yes' || "$dockerenv_present" == 'yes' ]]; then
  in_dev_container='yes'
  if [[ "$remote_containers_set" == 'yes' ]]; then
    container_detected_by="REMOTE_CONTAINERS"
  fi
  if [[ "$devcontainer_set" == 'yes' ]]; then
    if [[ -n "$container_detected_by" ]]; then
      container_detected_by+=" + "
    fi
    container_detected_by+="DEVCONTAINER"
  fi
  if [[ "$dockerenv_present" == 'yes' ]]; then
    if [[ -n "$container_detected_by" ]]; then
      container_detected_by+=" + "
    fi
    container_detected_by+="/.dockerenv"
  fi
fi

remote_ssh='no'
remote_ssh_detected_by=''
if [[ -n "${SSH_CONNECTION-}" ]]; then
  remote_ssh='yes'
  remote_ssh_detected_by='SSH_CONNECTION'
elif [[ -n "${SSH_CLIENT-}" ]]; then
  remote_ssh='yes'
  remote_ssh_detected_by='SSH_CLIENT'
elif [[ -n "${SSH_TTY-}" ]]; then
  remote_ssh='yes'
  remote_ssh_detected_by='SSH_TTY'
fi

vscode_terminal='no'
if [[ -n "${VSCODE_IPC_HOOK_CLI-}" || -n "${TERM_PROGRAM_VSCODE-}" || "${TERM_PROGRAM-}" == 'vscode' ]]; then
  vscode_terminal='yes'
fi

docker_cli_present='no'
if command -v docker >/dev/null 2>&1; then
  docker_cli_present='yes'
fi

node_present='no'
node_version=''
if command -v node >/dev/null 2>&1; then
  node_present='yes'
  node_version="$(node --version 2>/dev/null || true)"
fi

pnpm_present='no'
pnpm_version=''
if command -v pnpm >/dev/null 2>&1; then
  pnpm_present='yes'
  pnpm_version="$(pnpm --version 2>/dev/null || true)"
fi

wrangler_present='no'
wrangler_version=''
if command -v wrangler >/dev/null 2>&1; then
  wrangler_present='yes'
  wrangler_version="$(wrangler --version 2>/dev/null || true)"
elif [[ "$pnpm_present" == 'yes' ]]; then
  # Best-effort: if installed as a dependency, pnpm exec can run it.
  if pnpm exec wrangler --version >/dev/null 2>&1; then
    wrangler_present='yes'
    wrangler_version="$(pnpm exec wrangler --version 2>/dev/null || true)"
  fi
fi

ops_ready='yes'
missing=()
if [[ "$docker_cli_present" != 'yes' ]]; then missing+=(docker); ops_ready='no'; fi
if [[ "$node_present" != 'yes' ]]; then missing+=(node); ops_ready='no'; fi
if [[ "$pnpm_present" != 'yes' ]]; then missing+=(pnpm); ops_ready='no'; fi
if [[ "$wrangler_present" != 'yes' ]]; then missing+=(wrangler); ops_ready='no'; fi

printf '== IDE/Context status ==\n'
printf 'Dev container: %s%s\n' "$in_dev_container" "${container_detected_by:+ (${container_detected_by})}"
printf 'Remote-SSH:   %s%s\n' "$remote_ssh" "${remote_ssh_detected_by:+ (${remote_ssh_detected_by})}"
printf 'VS Code term: %s\n' "$vscode_terminal"
printf 'Workspace:    %s\n' "$pwd_physical"
printf '\n'
printf 'Tools:\n'
printf '  docker:   %s\n' "$docker_cli_present"
printf '  node:     %s%s\n' "$node_present" "${node_version:+ (${node_version})}"
printf '  pnpm:     %s%s\n' "$pnpm_present" "${pnpm_version:+ (${pnpm_version})}"
printf '  wrangler: %s%s\n' "$wrangler_present" "${wrangler_version:+ (${wrangler_version})}"
printf '\n'
printf 'OPS_READY: %s\n' "$ops_ready"
if [[ "$ops_ready" != 'yes' ]]; then
  printf 'Missing: %s\n' "${missing[*]}"
  printf 'Recommendation: run from Remote-SSH host layer with Docker + install required tools.\n'
fi
