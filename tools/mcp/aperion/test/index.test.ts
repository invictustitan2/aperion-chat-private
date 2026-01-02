import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createMcpTools } from "../src/index.js";

function mkTempRepoRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "aperion-mcp-"));
}

describe("createAperionMcpServer", () => {
  it("repo.search returns (no matches) for empty output", async () => {
    const repoRoot = mkTempRepoRoot();

    const tools = createMcpTools({
      repoRoot,
      deps: {
        repoSearch: () => ({
          ok: true,
          stdout: "",
          stderr: "",
          exitCode: 1,
        }),
        secretsStatus: () => ({ exitCode: 0, stdout: "ok", stderr: "" }),
        memoryIngestReceipt: async () => ({ ok: true, mode: "remote" }),
      },
    });

    const res = await tools.repoSearch.handler({ query: "x" });
    expect(res.content[0].type).toBe("text");
    expect(res.content[0].text).toBe("(no matches)");
  });

  it("repo.search error path formats error", async () => {
    const repoRoot = mkTempRepoRoot();

    const tools = createMcpTools({
      repoRoot,
      deps: {
        repoSearch: () => ({
          ok: false as const,
          error: "rg not available",
          stdout: "",
          stderr: "",
          exitCode: null,
        }),
      },
    });

    const res = await tools.repoSearch.handler({ query: "x" });
    expect(res.content[0].text).toContain("error: rg not available");
  });

  it("receipts.append writes and reports ok", async () => {
    const repoRoot = mkTempRepoRoot();

    const tools = createMcpTools({ repoRoot });
    const res = await tools.receiptsAppend.handler({ content: "hello\n" });
    expect(res.content[0].text).toContain("ok: appended to .ref/receipts/");
  });

  it("secrets.status joins stdout/stderr", async () => {
    const repoRoot = mkTempRepoRoot();

    const tools = createMcpTools({
      repoRoot,
      deps: {
        secretsStatus: () => ({ exitCode: 0, stdout: "a", stderr: "b" }),
      },
    });

    const res = await tools.secretsStatus.handler();
    expect(res.content[0].text).toContain("a");
    expect(res.content[0].text).toContain("b");
  });

  it("memory.ingestReceipt returns JSON string", async () => {
    const repoRoot = mkTempRepoRoot();

    const tools = createMcpTools({
      repoRoot,
      deps: {
        memoryIngestReceipt: async () => ({ ok: true, mode: "remote" }),
      },
    });

    const res = await tools.memoryIngestReceipt.handler({ content: "x" });
    expect(res.content[0].text).toContain('"ok":true');
  });
});
