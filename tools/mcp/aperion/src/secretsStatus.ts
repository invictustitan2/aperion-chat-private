import { spawnSync } from "node:child_process";

export function secretsStatus(opts: { repoRoot: string }) {
  const proc = spawnSync("./dev", ["secrets:status"], {
    cwd: opts.repoRoot,
    encoding: "utf8",
    env: { ...process.env },
  });

  return {
    exitCode: proc.status,
    stdout: (proc.stdout ?? "").slice(0, 60_000),
    stderr: (proc.stderr ?? "").slice(0, 60_000),
  };
}
