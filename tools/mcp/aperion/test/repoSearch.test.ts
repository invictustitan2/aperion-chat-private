import { describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => {
  return {
    spawnSync: vi.fn(),
  };
});

import { spawnSync } from "node:child_process";
import { repoSearch } from "../src/repoSearch.js";

describe("repoSearch", () => {
  it("adds --glob when include provided", () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "",
    } as unknown as ReturnType<typeof spawnSync>);

    repoSearch({
      repoRoot: "/tmp",
      query: "x",
      include: "**/*.ts",
      maxResults: 10,
    });

    const [, args] = vi.mocked(spawnSync).mock.calls[0];
    expect(args[0]).toBe("--glob");
  });

  it("returns ok=false when rg is missing", () => {
    vi.mocked(spawnSync).mockReturnValue({
      error: new Error("no rg"),
      stdout: "",
      stderr: "",
      status: null,
    } as unknown as ReturnType<typeof spawnSync>);

    const res = repoSearch({ repoRoot: "/tmp", query: "x" });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("rg not available");
  });

  it("treats status 0 and 1 as ok", () => {
    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 0,
      stdout: "hit",
      stderr: "",
    } as unknown as ReturnType<typeof spawnSync>);

    const a = repoSearch({ repoRoot: "/tmp", query: "x" });
    expect(a.ok).toBe(true);

    vi.mocked(spawnSync).mockReturnValueOnce({
      status: 1,
      stdout: "",
      stderr: "",
    } as unknown as ReturnType<typeof spawnSync>);

    const b = repoSearch({ repoRoot: "/tmp", query: "x" });
    expect(b.ok).toBe(true);
  });
});
