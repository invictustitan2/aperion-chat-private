import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("fs/promises", () => {
  const writeFile = vi.fn(async () => undefined);
  return {
    default: { writeFile },
    writeFile,
  };
});

import * as fs from "fs/promises";
import { exportData } from "../src/commands/export";

function mockExit() {
  const spy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`process.exit:${code ?? 0}`);
  }) as unknown as typeof process.exit);
  return spy;
}

describe("exportData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.AUTH_TOKEN;
    delete process.env.VITE_AUTH_TOKEN;
    delete process.env.VITE_API_BASE_URL;
  });

  it("exits when AUTH_TOKEN missing", async () => {
    const exitSpy = mockExit();
    const errSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(exportData({})).rejects.toThrow("process.exit:1");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errSpy).toHaveBeenCalled();
  });

  it("fetches endpoints and writes jsonl when output provided", async () => {
    process.env.AUTH_TOKEN = "t";
    process.env.VITE_API_BASE_URL = "http://example.test";

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/v1/episodic")) {
        return {
          ok: true,
          statusText: "OK",
          json: async () => [{ a: 1 }, { a: 2 }],
        };
      }

      return {
        ok: false,
        statusText: "Bad",
        json: async () => ({}),
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    await exportData({ output: "/tmp/out.jsonl" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fs.writeFile)).toHaveBeenCalledTimes(1);

    const [, jsonl] = vi.mocked(fs.writeFile).mock.calls[0];
    expect(String(jsonl)).toContain('{"a":1}');
    expect(String(jsonl)).toContain('{"a":2}');
    expect(logSpy).toHaveBeenCalled();
  });

  it("handles fetch throw without crashing", async () => {
    process.env.AUTH_TOKEN = "t";

    const errSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom");
      }),
    );

    await exportData({ output: "/tmp/out.jsonl" });

    expect(errSpy).toHaveBeenCalled();
    expect(vi.mocked(fs.writeFile)).toHaveBeenCalled();
  });
});
