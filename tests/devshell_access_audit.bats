#!/usr/bin/env bats

setup() {
  export REPO_ROOT
  REPO_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd -P)"
  export DEV="${REPO_ROOT}/dev"
}

@test "cf:access:audit fails clearly without required env vars" {
  unset CLOUDFLARE_API_TOKEN
  unset CLOUDFLARE_ACCOUNT_ID

  run env DEV_LOAD_DOTENV=0 "${DEV}" cf:access:audit

  [ "$status" -ne 0 ]
  [[ "$output" == *"CLOUDFLARE_API_TOKEN"* ]]
  [[ "$output" == *"CLOUDFLARE_ACCOUNT_ID"* ]]

  # Must not print secrets or header names.
  [[ "$output" != *"Bearer "* ]]
  [[ "$output" != *"CF-Access-Client-Id:"* ]]
  [[ "$output" != *"CF-Access-Client-Secret:"* ]]
}

@test "access:probe skips without RUN_NETWORK_TESTS" {
  unset RUN_NETWORK_TESTS

  run "${DEV}" access:probe

  [ "$status" -ne 0 ]
  [[ "$output" == *"SKIP"* ]]

  [[ "$output" != *"Bearer "* ]]
  [[ "$output" != *"CF-Access-Client-Id:"* ]]
  [[ "$output" != *"CF-Access-Client-Secret:"* ]]
}
