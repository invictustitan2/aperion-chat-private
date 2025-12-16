/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RelationshipsController } from "../../src/controllers/RelationshipsController";
import { RelationshipsService } from "../../src/services/RelationshipsService";
import { Env } from "../../src/types";

vi.mock("../../src/services/RelationshipsService", () => {
  return {
    RelationshipsService: vi.fn().mockImplementation(() => ({
      listForNode: vi.fn(),
      create: vi.fn(),
    })),
  };
});

describe("RelationshipsController", () => {
  let mockRequest: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockRequest = {
      query: {},
      params: {},
      json: vi.fn(),
    };
    mockEnv = {} as Env;
    (RelationshipsService as any).mockClear();
  });

  it("lists relationships for node", async () => {
    mockRequest.query = { kind: "semantic", id: "s1", limit: "10", since: "0" };

    const mockList = vi.fn().mockResolvedValue([]);
    (
      RelationshipsService as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({ listForNode: mockList }));

    const res = await RelationshipsController.list(mockRequest, mockEnv);
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith({
      kind: "semantic",
      id: "s1",
      limit: 10,
      since: 0,
    });
  });

  it("creates relationship", async () => {
    mockRequest.json.mockResolvedValue({
      type: "EVIDENCE_FOR",
      from_kind: "episodic",
      from_id: "e1",
      to_kind: "semantic",
      to_id: "s1",
      rationale: "Observed behavior supports preference",
      created_by: "user",
      confidence: 0.9,
    });

    const mockCreate = vi.fn().mockResolvedValue({ id: "r1" });
    (
      RelationshipsService as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({ create: mockCreate }));

    const res = await RelationshipsController.create(mockRequest, mockEnv);
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalled();
  });
});
