#!/usr/bin/env bats

setup() {
  export REPO_ROOT
  REPO_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd -P)"
  export DEV="${REPO_ROOT}/dev"
}

@test "pwa:probe skips cleanly without RUN_NETWORK_TESTS" {
  unset RUN_NETWORK_TESTS

  run "${DEV}" pwa:probe

  [ "$status" -eq 0 ]
  [[ "$output" == *"SKIP:"* ]]

  [[ "$output" != *"Bearer "* ]]
  [[ "$output" != *"CF-Access-"* ]]
}
