import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function writeExecutable(filePath: string, content: string) {
  await fs.writeFile(filePath, content, { mode: 0o755 });
}

async function makeFakeWranglerBin(dir: string) {
  const binPath = path.join(dir, "wrangler");

  const script = `#!/usr/bin/env bash
set -euo pipefail

cmd="\${1:-}"
shift || true

case "$cmd" in
  --version)
    echo "9.9.9"
    exit 0
    ;;
  whoami)
    echo "you@example.com"
    exit 0
    ;;
  pages)
    sub="\${1:-}"
    shift || true
    if [ "$sub" = "project" ] && [ "\${1:-}" = "list" ]; then
      echo "aperion-chat-private"
      exit 0
    fi
    exit 2
    ;;
  deploy)
    # dry-run is expected
    echo "dry-run ok"
    exit 0
    ;;
  *)
    exit 2
    ;;
esac
`;

  await writeExecutable(binPath, script);
}

async function makeFakePnpmBin(dir: string) {
  const binPath = path.join(dir, "pnpm");

  const script = `#!/usr/bin/env bash
set -euo pipefail

cmd="\${1:-}"
shift || true

case "$cmd" in
  verify)
    echo "pnpm verify (stub)"
    exit 0
    ;;
  guard:prod-secrets)
    echo "pnpm guard:prod-secrets (stub)"
    exit 0
    ;;
  guard:config-drift)
    echo "pnpm guard:config-drift (stub)"
    exit 0
    ;;
  *)
    echo "unsupported pnpm invocation: $cmd" >&2
    exit 2
    ;;
esac
`;

  await writeExecutable(binPath, script);
}

describe("verify:ci", () => {
  it("fails with clear remediation when Cloudflare CI vars are missing", async () => {
    const repoRoot = path.resolve(__dirname, "..");

    try {
      await execFileAsync(path.join(repoRoot, "dev"), ["verify:ci"], {
        cwd: repoRoot,
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: "token-set",
          CLOUDFLARE_ACCOUNT_ID: "",
        },
      });
      throw new Error("Expected verify:ci to fail");
    } catch (error) {
      const err = error as { stderr?: string; stdout?: string };
      const stderr = err.stderr ?? "";
      expect(stderr).toContain("missing required CI Cloudflare env var(s)");
      expect(stderr).toContain("CLOUDFLARE_ACCOUNT_ID");
      expect(stderr).toContain("Remediation");
      expect(stderr).not.toContain(".ref");
    }
  });

  it("passes with PATH stubs and Cloudflare vars set", async () => {
    const repoRoot = path.resolve(__dirname, "..");
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "verify-ci-"));

    try {
      await makeFakeWranglerBin(tempDir);
      await makeFakePnpmBin(tempDir);

      const env = {
        ...process.env,
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        CLOUDFLARE_API_TOKEN: "token-set",
        CLOUDFLARE_ACCOUNT_ID: "account-set",
      };

      const { stdout, stderr } = await execFileAsync(
        path.join(repoRoot, "dev"),
        ["verify:ci"],
        { cwd: repoRoot, env },
      );

      expect(stdout + stderr).not.toContain(".ref");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
