#!/usr/bin/env bats

setup() {
  export REPO_ROOT
  REPO_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd -P)"
  export DEV="${REPO_ROOT}/dev"
}

@test "cf:worker:deploy skips without RUN_NETWORK_TESTS and prints WRANGLER.ENV.*" {
  unset RUN_NETWORK_TESTS

  run "${DEV}" cf:worker:deploy

  [ "$status" -eq 0 ]
  [[ "$output" == *"WRANGLER.ENV.EFFECTIVE:"* ]]
  [[ "$output" == *"WRANGLER.ENV.VALID:"* ]]
  [[ "$output" == *"WRANGLER.ENV.AVAILABLE: preview,test"* ]]
  [[ "$output" == *"SKIP:"* ]]
}

@test "cf:worker:deploy rejects invalid env immediately" {
  unset RUN_NETWORK_TESTS

  run "${DEV}" cf:worker:deploy --env notreal

  [ "$status" -ne 0 ]
  [[ "$output" == *"WRANGLER.ENV.EFFECTIVE: notreal"* ]]
  [[ "$output" == *"WRANGLER.ENV.VALID: no"* ]]
  [[ "$output" == *"WRANGLER.ENV.AVAILABLE: preview,test"* ]]
}
