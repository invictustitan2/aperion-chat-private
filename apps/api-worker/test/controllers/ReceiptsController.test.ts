/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReceiptsController } from "../../src/controllers/ReceiptsController";
import { Env } from "../../src/types";

describe("ReceiptsController", () => {
  let mockRequest: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockRequest = {
      query: {},
    };
    mockEnv = {
      MEMORY_DB: {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      },
    } as unknown as Env;
  });

  describe("list", () => {
    it("should return empty list when no receipts found", async () => {
      const response = await ReceiptsController.list(mockRequest, mockEnv);
      const data = await response.json();
      expect(data).toEqual([]);
    });

    it("should return formatted receipts", async () => {
      const mockReceipts = [
        {
          id: "r1",
          timestamp: 1234567890,
          decision: "allow",
          reason_codes: JSON.stringify(["policy_check_passed"]),
        },
        {
          id: "r2",
          timestamp: 1234567891,
          decision: "deny",
          reason_codes: "violation", // Not JSON
        },
      ];

      (mockEnv.MEMORY_DB.prepare as any).mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: mockReceipts }),
      });

      const response = await ReceiptsController.list(mockRequest, mockEnv);
      const data = await response.json();

      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({
        id: "r1",
        timestamp: 1234567890,
        action: "memory_write",
        allowed: true,
        reason: "policy_check_passed",
      });
      expect(data[1]).toEqual({
        id: "r2",
        timestamp: 1234567891,
        action: "memory_write",
        allowed: false,
        reason: "violation",
      });
    });
  });
});
