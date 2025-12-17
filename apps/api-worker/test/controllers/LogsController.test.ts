/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogsController } from "../../src/controllers/LogsController";
import { Env } from "../../src/types";

describe("LogsController", () => {
  let mockRequest: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockRequest = {
      query: {},
      json: vi.fn(),
    };
    mockEnv = {
      MEMORY_DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        }),
      },
    } as unknown as Env;
  });

  describe("list", () => {
    it("should return logs", async () => {
      const mockLogs = [
        {
          id: "l1",
          timestamp: 123,
          level: "info",
          message: "test log",
          source: "test",
        },
      ];
      (mockEnv.MEMORY_DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockLogs }),
      });

      const response = await LogsController.list(mockRequest, mockEnv);
      const data = await response.json();

      expect(data).toHaveLength(1);
      expect(data[0].message).toBe("test log");
    });

    it("should handle errors", async () => {
      (mockEnv.MEMORY_DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockRejectedValue(new Error("DB Error")),
      });

      const response = await LogsController.list(mockRequest, mockEnv);
      expect(response.status).toBe(500);
    });
  });

  describe("clear", () => {
    it("should clear logs", async () => {
      const response = await LogsController.clear(mockRequest, mockEnv);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.deleted).toBe(1);
    });

    it("should handle errors", async () => {
      (mockEnv.MEMORY_DB.prepare as any).mockReturnValue({
        run: vi.fn().mockRejectedValue(new Error("DB Error")),
      });

      const response = await LogsController.clear(mockRequest, mockEnv);
      expect(response.status).toBe(500);
    });
  });

  describe("create", () => {
    it("should create a log entry", async () => {
      mockRequest.json.mockResolvedValue({
        level: "error",
        message: "Something went wrong",
      });

      const response = await LogsController.create(mockRequest, mockEnv);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.id).toBeDefined();
    });

    it("should return 400 if missing fields", async () => {
      mockRequest.json.mockResolvedValue({
        level: "info",
        // missing message
      });

      const response = await LogsController.create(mockRequest, mockEnv);
      expect(response.status).toBe(400);
    });

    it("should handle errors", async () => {
      mockRequest.json.mockResolvedValue({
        level: "info",
        message: "test",
      });
      (mockEnv.MEMORY_DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockRejectedValue(new Error("DB Error")),
      });

      const response = await LogsController.create(mockRequest, mockEnv);
      expect(response.status).toBe(500);
    });
  });
});
