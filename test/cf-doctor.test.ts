import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type CfDoctorCheck = {
  id: string;
  status: string;
  message: string;
  data?: {
    version?: string;
    [key: string]: unknown;
  };
};

type CfDoctorJson = {
  schemaVersion: number;
  checks: CfDoctorCheck[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
    skip: number;
    ok: boolean;
  };
  meta: {
    repo: string;
    paths: {
      pagesWranglerToml: string;
      workerWranglerToml: string;
    };
  };
};

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
      echo "some-other-project"
      exit 0
    fi
    echo "unsupported pages subcommand" >&2
    exit 2
    ;;
  deploy)
    # dry-run is expected; never mutate
    echo "dry-run ok"
    exit 0
    ;;
  *)
    echo "unsupported wrangler invocation: $cmd" >&2
    exit 2
    ;;
esac
`;

  await fs.writeFile(binPath, script, { mode: 0o755 });
  return binPath;
}

describe("cf:doctor", () => {
  it("emits stable JSON without .ref paths", async () => {
    const repoRoot = path.resolve(__dirname, "..");
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-doctor-"));

    try {
      await makeFakeWranglerBin(tempDir);

      const env = {
        ...process.env,
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        CLOUDFLARE_API_TOKEN: "",
        CLOUDFLARE_ACCOUNT_ID: "",
      };

      const { stdout } = await execFileAsync(
        path.join(repoRoot, "dev"),
        ["cf:doctor", "--json"],
        { cwd: repoRoot, env },
      );

      const json = JSON.parse(stdout) as CfDoctorJson;

      expect(json).toMatchObject({
        schemaVersion: 1,
        checks: expect.any(Array),
        summary: {
          pass: expect.any(Number),
          warn: expect.any(Number),
          fail: expect.any(Number),
          skip: expect.any(Number),
          ok: expect.any(Boolean),
        },
        meta: {
          repo: "aperion-chat-private",
          paths: {
            pagesWranglerToml: "wrangler.toml",
            workerWranglerToml: "apps/api-worker/wrangler.toml",
          },
        },
      });

      expect(json.checks.length).toBeGreaterThan(0);
      for (const check of json.checks) {
        expect(check).toMatchObject({
          id: expect.any(String),
          status: expect.any(String),
          message: expect.any(String),
        });
      }

      const serialized = JSON.stringify(json);
      expect(serialized).not.toContain(".ref");

      const wranglerCheck = json.checks.find(
        (c) => c.id === "tooling.wrangler",
      );
      expect(wranglerCheck?.data?.version).toBe("9.9.9");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
