/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EpisodicController } from "../../src/controllers/EpisodicController";
import { EpisodicService } from "../../src/services/EpisodicService";
import { Env } from "../../src/types";

vi.mock("../../src/services/EpisodicService", () => {
  return {
    EpisodicService: vi.fn().mockImplementation(() => ({
      create: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      clear: vi.fn(),
    })),
  };
});

describe("EpisodicController", () => {
  let mockRequest: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockRequest = {
      json: vi.fn(),
      query: {},
    };
    mockEnv = {} as Env;
    (EpisodicService as any).mockClear();
  });

  describe("create", () => {
    it("should return 400 for invalid input", async () => {
      mockRequest.json.mockResolvedValue({}); // Missing content/provenance

      const response = await EpisodicController.create(mockRequest, mockEnv);

      expect(response.status).toBe(400);
    });

    it("should create memory and return 202 if queued", async () => {
      mockRequest.json.mockResolvedValue({
        content: "test",
        provenance: { source_type: "user", source_id: "u1", timestamp: 123 },
      });

      const mockCreate = vi
        .fn()
        .mockResolvedValue({ status: "queued", id: "id-1" });
      (
        EpisodicService as unknown as ReturnType<typeof vi.fn>
      ).mockImplementation(() => ({
        create: mockCreate,
      }));

      const response = await EpisodicController.create(mockRequest, mockEnv);

      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body).toEqual({ status: "queued", id: "id-1" });
    });
  });

  describe("list", () => {
    it("should list memories with cache control", async () => {
      mockRequest.query = { limit: "10" };
      const mockList = vi.fn().mockResolvedValue([]);
      (
        EpisodicService as unknown as ReturnType<typeof vi.fn>
      ).mockImplementation(() => ({
        list: mockList,
      }));

      const response = await EpisodicController.list(mockRequest, mockEnv);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, max-age=5");
      expect(mockList).toHaveBeenCalledWith(10, 0, undefined);
    });
  });

  describe("delete", () => {
    it("should return 400 if confirm missing", async () => {
      const response = await EpisodicController.delete(mockRequest, mockEnv);
      expect(response.status).toBe(400);
    });

    it("should clear memories if confirmed", async () => {
      mockRequest.query = { confirm: "true" };
      const mockClear = vi.fn().mockResolvedValue({ deleted: 5 });
      (
        EpisodicService as unknown as ReturnType<typeof vi.fn>
      ).mockImplementation(() => ({
        clear: mockClear,
      }));

      const response = await EpisodicController.delete(mockRequest, mockEnv);
      expect(response.status).toBe(200);
      expect(mockClear).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should return 400 if id missing", async () => {
      mockRequest.params = {};
      mockRequest.json.mockResolvedValue({ content: "updated" });

      const response = await EpisodicController.update(mockRequest, mockEnv);
      expect(response.status).toBe(400);
    });

    it("should return 400 for invalid body", async () => {
      mockRequest.params = { id: "m1" };
      mockRequest.json.mockResolvedValue({});

      const response = await EpisodicController.update(mockRequest, mockEnv);
      expect(response.status).toBe(400);
    });

    it("should update content", async () => {
      mockRequest.params = { id: "m1" };
      mockRequest.json.mockResolvedValue({ content: "updated" });

      const mockUpdate = vi.fn().mockResolvedValue({ success: true, id: "m1" });
      (
        EpisodicService as unknown as ReturnType<typeof vi.fn>
      ).mockImplementation(() => ({
        update: mockUpdate,
      }));

      const response = await EpisodicController.update(mockRequest, mockEnv);
      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith("m1", { content: "updated" });
    });

    it("should update tags", async () => {
      mockRequest.params = { id: "m1" };
      mockRequest.json.mockResolvedValue({ tags: ["work", "personal"] });

      const mockUpdate = vi.fn().mockResolvedValue({ success: true, id: "m1" });
      (
        EpisodicService as unknown as ReturnType<typeof vi.fn>
      ).mockImplementation(() => ({
        update: mockUpdate,
      }));

      const response = await EpisodicController.update(mockRequest, mockEnv);
      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith("m1", {
        tags: ["work", "personal"],
      });
    });
  });
});
