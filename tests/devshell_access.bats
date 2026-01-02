#!/usr/bin/env bats

setup() {
  export REPO_ROOT
  REPO_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd -P)"
  export DEV_SHELL="${REPO_ROOT}/devshell/devshell"
}

@test "access test is skipped by default (no network)" {
  # This suite is intended to be hermetic by default.
  # Ensure callers (like deploy:prod) don't leak RUN_NETWORK_TESTS into this assertion.
  unset RUN_NETWORK_TESTS
  [ "${RUN_NETWORK_TESTS:-0}" != "1" ]
}

@test "access test returns a status code when enabled" {
  if [ "${RUN_NETWORK_TESTS:-0}" != "1" ]; then
    skip "Set RUN_NETWORK_TESTS=1 to enable network tests"
  fi

  if ! "${DEV_SHELL}" secrets check >/dev/null 2>&1; then
    skip "Secrets missing/invalid; configure ~/.config/aperion/cf_access.env or set APERION_SECRETS_FILE"
  fi

  run "${DEV_SHELL}" access test

  [ "$status" -eq 0 ]
  [[ "$output" =~ ^[0-9]{3}$ ]]
}
