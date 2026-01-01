#!/usr/bin/env bats

setup() {
  export REPO_ROOT
  REPO_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd -P)"
  export DEV="${REPO_ROOT}/dev"
}

@test "deploy:validate skips cleanly without RUN_NETWORK_TESTS and prints schema" {
  unset RUN_NETWORK_TESTS

  run "${DEV}" deploy:validate

  [ "$status" -eq 0 ]
  [[ "$output" == *"VALIDATE.VERSION: 1"* ]]
  [[ "$output" == *"SKIP:"* ]]

  [[ "$output" != *"Bearer "* ]]
  [[ "$output" != *"CF-Access-"* ]]
}
