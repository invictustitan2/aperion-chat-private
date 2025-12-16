/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IdentityController } from "../../src/controllers/IdentityController";
import { IdentityService } from "../../src/services/IdentityService";
import { Env } from "../../src/types";

// Mock IdentityService
vi.mock("../../src/services/IdentityService", () => {
  return {
    IdentityService: vi.fn().mockImplementation(() => ({
      upsert: vi.fn(),
      getAll: vi.fn(),
    })),
  };
});

describe("IdentityController", () => {
  let mockRequest: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockRequest = {
      json: vi.fn(),
    };
    mockEnv = {} as Env;
    (IdentityService as any).mockClear();
  });

  describe("upsert", () => {
    it("should return 400 for invalid input", async () => {
      mockRequest.json.mockResolvedValue({}); // Missing key/provenance

      const response = await IdentityController.upsert(mockRequest, mockEnv);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect((body as any).error).toContain("Invalid input");
    });

    it("should upsert valid identity and return result", async () => {
      mockRequest.json.mockResolvedValue({
        key: "theme",
        value: "dark",
        provenance: {
          source_type: "user",
          source_id: "u1",
          timestamp: 123,
          confidence: 1,
        },
      });

      const mockUpsert = vi
        .fn()
        .mockResolvedValue({ success: true, id: "id-1" });
      (
        IdentityService as unknown as ReturnType<typeof vi.fn>
      ).mockImplementation(() => ({
        upsert: mockUpsert,
      }));

      const response = await IdentityController.upsert(mockRequest, mockEnv);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ success: true, id: "id-1" });
      expect(mockUpsert).toHaveBeenCalled();
    });

    it("should return 403 when Policy denies", async () => {
      mockRequest.json.mockResolvedValue({
        key: "locked-key",
        value: "val",
        provenance: {
          source_type: "user",
          source_id: "u1",
          timestamp: 123,
        },
      });

      (
        IdentityService as unknown as ReturnType<typeof vi.fn>
      ).mockImplementation(() => ({
        upsert: vi
          .fn()
          .mockRejectedValue(new Error("Policy denied: reason codes")),
      }));

      const response = await IdentityController.upsert(mockRequest, mockEnv);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect((body as any).error).toContain("Policy denied");
    });
  });

  describe("get", () => {
    it("should return list of identities", async () => {
      const mockGetAll = vi
        .fn()
        .mockResolvedValue([{ key: "k1", value: "v1" }]);
      (
        IdentityService as unknown as ReturnType<typeof vi.fn>
      ).mockImplementation(() => ({
        getAll: mockGetAll,
      }));

      const response = await IdentityController.get(mockRequest, mockEnv);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual([{ key: "k1", value: "v1" }]);
    });
  });
});
