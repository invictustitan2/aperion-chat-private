import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashRunbook } from "../src/commands/hash-runbook.js";
import { verify } from "../src/commands/verify.js";
import fs from "fs/promises";

// Mock fs
vi.mock("fs/promises");

// Mock console
const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(process, "exit").mockImplementation((code) => {
  throw new Error(`Process exit ${code}`);
});

describe("CLI Commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hashRunbook", () => {
    it("should hash tasks correctly", async () => {
      const mockContent = `
# Runbook

## Task 1
Do something.

## Task 2
Do something else.
`;
      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      await hashRunbook("runbook.md");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Found 2 tasks"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Task 1"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Task 2"),
      );
    });

    it("should handle single task file", async () => {
      const mockContent = "Just some content";
      vi.mocked(fs.readFile).mockResolvedValue(mockContent);

      await hashRunbook("runbook.md");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("No tasks found"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("File Hash"),
      );
    });
  });

  describe("verify", () => {
    it("should fail if VITE_AUTH_TOKEN is missing", async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, VITE_AUTH_TOKEN: "" };

      await expect(verify()).rejects.toThrow("Process exit 1");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("VITE_AUTH_TOKEN is missing"),
      );

      process.env = originalEnv;
    });
  });
});
