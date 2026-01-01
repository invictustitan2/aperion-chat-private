#!/usr/bin/env bats

setup() {
  export REPO_ROOT
  REPO_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd -P)"
  export DEV="${REPO_ROOT}/dev"
}

@test "ws:proof skips without RUN_NETWORK_TESTS" {
  unset RUN_NETWORK_TESTS

  run "${DEV}" ws:proof --surface api

  [ "$status" -ne 0 ]
  [[ "$output" == *"SKIP"* ]]

  [[ "$output" != *"CF-Access-Client-Id"* ]]
  [[ "$output" != *"CF-Access-Client-Secret"* ]]
}

@test "ws:proof does not rely on executable bit" {
  # Simulate missing +x bit (the dispatcher should still run via bash).
  chmod -x "${REPO_ROOT}/devshell/commands/ws_proof.sh"

  unset RUN_NETWORK_TESTS
  run "${DEV}" ws:proof --surface api

  # Restore for subsequent tests.
  chmod +x "${REPO_ROOT}/devshell/commands/ws_proof.sh"

  [ "$status" -ne 0 ]
  [[ "$output" == *"SKIP"* ]]
  [[ "$output" != *"Permission denied"* ]]
}

@test "ws:proof headless blocks without service token env" {
  export RUN_NETWORK_TESTS=1
  unset DISPLAY
  unset WAYLAND_DISPLAY
  unset CF_ACCESS_SERVICE_TOKEN_ID
  unset CF_ACCESS_SERVICE_TOKEN_SECRET

  run "${DEV}" ws:proof --surface api --mode headless

  [ "$status" -eq 2 ]
  [[ "$output" == *"BLOCKED: ws:proof --mode headless requires CF_ACCESS_SERVICE_TOKEN_ID"* ]]

  [[ "$output" != *"CF-Access-Client-Id"* ]]
  [[ "$output" != *"CF-Access-Client-Secret"* ]]
}

@test "ws:proof blocks without a GUI display" {
  export RUN_NETWORK_TESTS=1
  unset DISPLAY
  unset WAYLAND_DISPLAY

  run "${DEV}" ws:proof --surface browser

  [ "$status" -eq 2 ]
  [[ "$output" == *"BLOCKED: ws:proof requires a GUI display"* ]]
}
