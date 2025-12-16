/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KnowledgeController } from "../../src/controllers/KnowledgeController";
import { KnowledgeService } from "../../src/services/KnowledgeService";
import { Env } from "../../src/types";

vi.mock("../../src/services/KnowledgeService", () => {
  return {
    KnowledgeService: vi.fn().mockImplementation(() => ({
      list: vi.fn(),
      promoteFromSemantic: vi.fn(),
    })),
  };
});

describe("KnowledgeController", () => {
  let mockRequest: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockRequest = {
      query: {},
      params: {},
      json: vi.fn(),
    };
    mockEnv = {} as Env;
    (KnowledgeService as any).mockClear();
  });

  it("lists knowledge items", async () => {
    mockRequest.query = { limit: "10", since: "0", q: "test" };
    const mockList = vi.fn().mockResolvedValue([]);
    (
      KnowledgeService as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({ list: mockList }));

    const res = await KnowledgeController.list(mockRequest, mockEnv);
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(10, 0, "test");
  });

  it("promotes from semantic", async () => {
    mockRequest.json.mockResolvedValue({ semantic_id: "s1" });

    const mockPromote = vi
      .fn()
      .mockResolvedValue({ id: "k1", title: "t", content: "c" });
    (
      KnowledgeService as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({ promoteFromSemantic: mockPromote }));

    const res = await KnowledgeController.promote(mockRequest, mockEnv);
    expect(res.status).toBe(201);
    expect(mockPromote).toHaveBeenCalledWith("s1");
  });
});
