/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { RunbooksController } from "../../src/controllers/RunbooksController";

describe("RunbooksController", () => {
  describe("hash", () => {
    it("should return hash for valid input", async () => {
      const mockRequest = {
        text: vi.fn().mockResolvedValue("some task content"),
      } as any;

      const response = await RunbooksController.hash(mockRequest);
      const data = await response.json();

      expect(data.taskId).toBeDefined();
      expect(typeof data.taskId).toBe("string");
    });

    it("should return 400 for missing body", async () => {
      const mockRequest = {
        text: vi.fn().mockResolvedValue(""),
      } as any;

      const response = await RunbooksController.hash(mockRequest);
      expect(response.status).toBe(400);
    });
  });
});
