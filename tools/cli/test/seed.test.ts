import { describe, it, expect, vi, beforeEach } from "vitest";
import { seed } from "../src/commands/seed.js";
import fs from "fs/promises";
import inquirer from "inquirer";
import YAML from "yaml";

vi.mock("fs/promises");
vi.mock("inquirer");
vi.mock("yaml");

const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

vi.spyOn(process, "exit").mockImplementation((code) => {
  throw new Error(`Process exit ${code}`);
});

describe("seed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exits when AUTH_TOKEN is missing", async () => {
    const originalEnv = process.env;
    process.env = { ...originalEnv, AUTH_TOKEN: "", VITE_AUTH_TOKEN: "" };

    await expect(seed("seed.yml", { confirm: true })).rejects.toThrow(
      "Process exit 1",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("AUTH_TOKEN is missing"),
    );

    process.env = originalEnv;
  });

  it("returns early when user cancels interactive confirm", async () => {
    const originalEnv = process.env;
    process.env = { ...originalEnv, AUTH_TOKEN: "t" };

    vi.mocked(fs.readFile).mockResolvedValue(
      Buffer.from("- key: a\n  value: 1\n"),
    );
    vi.spyOn(YAML, "parse").mockReturnValue([
      { key: "k", value: 1 },
    ] as unknown);
    vi.mocked(inquirer.prompt).mockResolvedValue({ confirm: false } as never);

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(seed("seed.yml", { confirm: false })).resolves.toBeUndefined();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Seed cancelled"),
    );
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
    process.env = originalEnv;
  });

  it("seeds records and tracks ok/fail outcomes", async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      AUTH_TOKEN: "t",
      VITE_API_BASE_URL: "http://127.0.0.1:8787",
    };

    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("dummy"));
    vi.spyOn(YAML, "parse").mockReturnValue([
      {
        key: "a",
        value: 1,
        provenance: { source_type: "seed", source_id: "cli" },
      },
      { key: "b", value: 2 },
    ] as unknown);

    const okRes: Partial<Response> = { ok: true };
    const badRes: Partial<Response> = {
      ok: false,
      text: async () => "nope",
    };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(okRes as Response)
      .mockResolvedValueOnce(badRes as Response);

    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await expect(seed("seed.yml", { confirm: true })).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(writeSpy).toHaveBeenCalled();

    fetchSpy.mockRestore();
    writeSpy.mockRestore();
    process.env = originalEnv;
  });

  it("exits when seed file cannot be read", async () => {
    const originalEnv = process.env;
    process.env = { ...originalEnv, AUTH_TOKEN: "t" };

    vi.mocked(fs.readFile).mockRejectedValue(new Error("boom"));

    await expect(seed("seed.yml", { confirm: true })).rejects.toThrow(
      "Process exit 1",
    );

    process.env = originalEnv;
  });
});
