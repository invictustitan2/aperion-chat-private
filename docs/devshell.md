# Dev Shell

## One-liner

```bash
./scripts/bootstrap-dev.sh && ./dev shell
```

## Secrets

Default secrets file:

- `~/.config/aperion/cf_access.env`

You can provide Cloudflare Access credentials via either:

- Environment variables: `CF_ACCESS_SERVICE_TOKEN_ID`, `CF_ACCESS_SERVICE_TOKEN_SECRET`
- The secrets file (loaded only if the env vars are missing/invalid)

Override:

```bash
APERION_SECRETS_FILE=/path/to/cf_access.env ./devshell/devshell secrets check
```

Create the file (copy/paste):

```bash
mkdir -p "$HOME/.config/aperion"
cat > "$HOME/.config/aperion/cf_access.env" <<'CF_ACCESS_ENV'
export CF_ACCESS_SERVICE_TOKEN_ID="REPLACE_ME"
export CF_ACCESS_SERVICE_TOKEN_SECRET="REPLACE_ME"
CF_ACCESS_ENV
chmod 600 "$HOME/.config/aperion/cf_access.env"
```

## Commands

- `./dev shell` (preferred entrypoint)
- `./dev cf:access:bootstrap` (populate Access IDs; safe)
- `./dev cf:access:audit` (audit Access apps/policies; safe)
- `./dev secrets:status`
- `./dev access:debug` (diagnose 302/401 for service-token calls)
- `RUN_NETWORK_TESTS=1 ./dev access:probe` (status-only probe; safe)
- `./dev vscode:logs:start` (capture redacted VS Code logs into `.ref/receipts/`)
- `./dev vscode:logs:status`
- `./dev vscode:logs:stop`
- `./devshell/devshell enter`
- `./devshell/devshell doctor`
- `./devshell/devshell secrets path`
- `./devshell/devshell secrets check`
- `./devshell/devshell access test`

## Bootstrap Cloudflare Access IDs

```bash
./dev cf:access:bootstrap
```

Requires `CLOUDFLARE_API_TOKEN` in the environment. Prints safe values you can paste into `.dev.vars`.

## Debug Access redirect (302)

```bash
./dev access:debug
```

Runs a single authenticated request to `https://api.aperion.cc/v1/identity` using your service token (env-or-file) and prints only status + Location hostname/path.

## Shell tooling (fmt/lint)

The `pnpm` scripts for shell formatting/linting use a NUL-separated file list and pipes (to avoid filename escaping issues):

```bash
./scripts/shell-files.sh shfmt | xargs -0 shfmt -d
./scripts/shell-files.sh shellcheck | xargs -0 shellcheck
```

## Notes

- Secrets are never printed; only lengths and HTTP status codes.
- Network checks are disabled by default. Enable with `RUN_NETWORK_TESTS=1`.

## bootstrap-dev.sh fallbacks

`./scripts/bootstrap-dev.sh` prefers `apt-get` on Debian/Ubuntu, but will fall back when needed:

- **shfmt**: if not available via apt, downloads a pinned official release binary (verifies checksum when possible), or uses `go install` if Go is installed.
- **bats**: if not available via apt, tries `bats-core`, otherwise installs from the upstream `bats-core` repo into `~/.local/bin`.
