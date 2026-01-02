import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryIngestReceipt } from "../src/memoryIngest.js";

function mkTempRepoRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "aperion-mcp-"));
}

describe("memoryIngestReceipt", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts to remote when fetch succeeds", async () => {
    const repoRoot = mkTempRepoRoot();

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "ok",
    }));

    vi.stubGlobal("fetch", fetchMock);

    const res = await memoryIngestReceipt({
      repoRoot,
      content: "hello",
      url: "http://example.test/v1/receipts",
    });

    expect(res.ok).toBe(true);
    expect(res.mode).toBe("remote");
    expect(res.url).toContain("http://example.test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to local receipt when HTTP fails", async () => {
    const repoRoot = mkTempRepoRoot();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => "nope",
      })),
    );

    const res = await memoryIngestReceipt({
      repoRoot,
      content: "hello",
      url: "http://example.test/v1/receipts",
    });

    expect(res.ok).toBe(false);
    expect(res.mode).toBe("local");
    expect(res.fallback.relativePath).toBeTruthy();

    const receiptPath = path.join(
      repoRoot,
      ".ref",
      "receipts",
      res.fallback.relativePath,
    );
    expect(fs.existsSync(receiptPath)).toBe(true);
  });

  it("falls back to local receipt when fetch throws", async () => {
    const repoRoot = mkTempRepoRoot();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const res = await memoryIngestReceipt({
      repoRoot,
      content: "hello",
      url: "http://example.test/v1/receipts",
    });

    expect(res.ok).toBe(false);
    expect(res.mode).toBe("local");
    expect(res.error).toContain("network down");
  });

  it("handles response.text() failures on success", async () => {
    const repoRoot = mkTempRepoRoot();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => {
          throw new Error("boom");
        },
      })),
    );

    const res = await memoryIngestReceipt({
      repoRoot,
      content: "hello",
      url: "http://example.test/v1/receipts",
    });

    expect(res.ok).toBe(true);
    expect(res.mode).toBe("remote");
    expect(res.response).toBe("");
  });
});
