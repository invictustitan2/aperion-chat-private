/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SemanticController } from "../../src/controllers/SemanticController";
import { SemanticService } from "../../src/services/SemanticService";
import { Env } from "../../src/types";

vi.mock("../../src/services/SemanticService", () => {
  return {
    SemanticService: vi.fn().mockImplementation(() => ({
      create: vi.fn(),
      search: vi.fn(),
      summarize: vi.fn(),
    })),
  };
});

describe("SemanticController", () => {
  let mockRequest: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockRequest = {
      json: vi.fn(),
      query: {},
    };
    mockEnv = {} as Env;
    (SemanticService as any).mockClear();
  });

  describe("create", () => {
    it("should return 400 for invalid input", async () => {
      mockRequest.json.mockResolvedValue({});
      const response = await SemanticController.create(mockRequest, mockEnv);
      expect(response.status).toBe(400);
    });

    it("should return 202 if queued", async () => {
      mockRequest.json.mockResolvedValue({
        content: "test",
        references: ["ref1"],
        provenance: { source_type: "user", source_id: "u1", timestamp: 123 },
      });

      const mockCreate = vi.fn().mockResolvedValue({ status: "queued" });
      (
        SemanticService as unknown as ReturnType<typeof vi.fn>
      ).mockImplementation(() => ({ create: mockCreate }));

      const response = await SemanticController.create(mockRequest, mockEnv);
      expect(response.status).toBe(202);
    });
  });

  describe("search", () => {
    it("should return 400 if query missing", async () => {
      const response = await SemanticController.search(mockRequest, mockEnv);
      expect(response.status).toBe(400);
    });

    it("should return search results", async () => {
      mockRequest.query = { query: "hello", limit: "5" };
      const mockSearch = vi.fn().mockResolvedValue(["res1"]);
      (
        SemanticService as unknown as ReturnType<typeof vi.fn>
      ).mockImplementation(() => ({ search: mockSearch }));

      const response = await SemanticController.search(mockRequest, mockEnv);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(["res1"]);
      expect(mockSearch).toHaveBeenCalledWith("hello", 5);
    });

    it("should return 503 if not configured", async () => {
      mockRequest.query = { query: "hello" };
      (
        SemanticService as unknown as ReturnType<typeof vi.fn>
      ).mockImplementation(() => ({
        search: vi
          .fn()
          .mockRejectedValue(new Error("Vectorize not configured")),
      }));

      const response = await SemanticController.search(mockRequest, mockEnv);
      expect(response.status).toBe(503);
    });
  });

  describe("summarize", () => {
    it("should return 400 for invalid input", async () => {
      mockRequest.json.mockResolvedValue({});
      const response = await SemanticController.summarize(mockRequest, mockEnv);
      expect(response.status).toBe(400);
    });

    it("should return 200 with summary", async () => {
      mockRequest.json.mockResolvedValue({ contents: ["c1", "c2"] });
      const mockSummarize = vi.fn().mockResolvedValue({ summary: "Summary" });
      (
        SemanticService as unknown as ReturnType<typeof vi.fn>
      ).mockImplementation(() => ({ summarize: mockSummarize }));

      const response = await SemanticController.summarize(mockRequest, mockEnv);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ summary: "Summary" });
    });
  });
});
