import { spawnSync } from "node:child_process";

export function repoSearch(opts: {
  repoRoot: string;
  query: string;
  include?: string;
  maxResults?: number;
}) {
  const maxResults = Math.max(1, Math.min(opts.maxResults ?? 50, 200));

  const args = [
    "--no-heading",
    "--line-number",
    "--color",
    "never",
    "--max-count",
    String(maxResults),
    opts.query,
  ];

  if (opts.include && opts.include.trim()) {
    args.unshift("--glob", opts.include);
  }

  const proc = spawnSync("rg", args, {
    cwd: opts.repoRoot,
    encoding: "utf8",
  });

  if (proc.error) {
    return {
      ok: false as const,
      error: `rg not available: ${proc.error.message}`,
      stdout: "",
      stderr: "",
      exitCode: null as number | null,
    };
  }

  // ripgrep returns 1 when no matches.
  const ok = proc.status === 0 || proc.status === 1;

  return {
    ok: ok as boolean,
    stdout: (proc.stdout ?? "").slice(0, 60_000),
    stderr: (proc.stderr ?? "").slice(0, 60_000),
    exitCode: proc.status,
  };
}
