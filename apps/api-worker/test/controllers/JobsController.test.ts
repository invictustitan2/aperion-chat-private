/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobsController } from "../../src/controllers/JobsController";
import { Env } from "../../src/types";

describe("JobsController", () => {
  let mockRequest: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockRequest = {
      params: { id: "job-123" },
    };
    mockEnv = {
      MEMORY_DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
        }),
      },
    } as unknown as Env;
  });

  describe("get", () => {
    it("should return job details", async () => {
      const mockJob = {
        id: "job-123",
        type: "test-job",
        status: "completed",
        created_at: 123,
        updated_at: 456,
        output: JSON.stringify({ foo: "bar" }),
        error: null,
      };
      (mockEnv.MEMORY_DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockJob),
      });

      const response = await JobsController.get(mockRequest, mockEnv);
      const data = await response.json();

      expect(data.id).toBe("job-123");
      expect(data.result).toEqual({ foo: "bar" });
    });

    it("should handle non-JSON output", async () => {
      const mockJob = {
        id: "job-123",
        output: "plain text",
      };
      (mockEnv.MEMORY_DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockJob),
      });

      const response = await JobsController.get(mockRequest, mockEnv);
      const data = await response.json();

      expect(data.result).toBe("plain text");
    });

    it("should return 404 if job not found", async () => {
      const response = await JobsController.get(mockRequest, mockEnv);
      expect(response.status).toBe(404);
    });
  });
});
