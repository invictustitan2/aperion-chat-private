#!/usr/bin/env bats

setup() {
  export REPO_ROOT
  REPO_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd -P)"
  export DEV="${REPO_ROOT}/dev"
}

@test "deploy:prod creates receipts and latest.txt when network disabled" {
  unset RUN_NETWORK_TESTS
  export DEV_LOAD_DOTENV=0

  run "${DEV}" deploy:prod

  # Should complete (no network deploy performed).
  [ "$status" -eq 0 ]
  [[ "$output" == *"PLAN.NETWORK: no"* ]]
  [[ "$output" == *"PLAN.VALIDATE.BROWSER: no"* ]]
  [[ "$output" == *"PLAN.VALIDATE.API: no"* ]]
  [[ "$output" == *"RECEIPTS.DIR: receipts/deploy/"* ]]
  [[ "$output" == *"RECEIPTS.INDEX: receipts/deploy/"*"/INDEX.md"* ]]
  [[ "$output" == *"DEPLOY.DONE: yes"* ]]

  latest_file="${REPO_ROOT}/receipts/deploy/latest.txt"
  [ -f "$latest_file" ]

  receipts_abs="$(cat "$latest_file")"
  [ -d "$receipts_abs" ]
  [ -f "$receipts_abs/SUMMARY.txt" ]
  [ -f "$receipts_abs/INDEX.md" ]

  # deploy:validate receipts should exist even when network is disabled (it prints SKIP).
  [ -f "$receipts_abs/post.deploy-validate.browser.txt" ]
  [ -f "$receipts_abs/post.deploy-validate.api.txt" ]

  # Summary should exist and be strict key/value.
  summary="$(cat "$receipts_abs/SUMMARY.txt")"
  [[ "$summary" == *"SUMMARY.VERSION: 2"* ]]
  [[ "$summary" == *"WORKER.DEPLOY.OK: no"* ]]
  [[ "$summary" == *"PAGES.DEPLOY.OK: no"* ]]
  [[ "$summary" == *"VALIDATE.BROWSER.OK: skip"* ]]
  [[ "$summary" == *"VALIDATE.API.OK: skip"* ]]

  # Must not leak obvious secret-like strings.
  [[ "$output" != *"Bearer "* ]]
  [[ "$output" != *"CF-Access-"* ]]
  [[ "$summary" != *"Bearer "* ]]
  [[ "$summary" != *"CF-Access-"* ]]
}
