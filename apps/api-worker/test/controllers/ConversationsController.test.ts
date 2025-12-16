/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationsController } from "../../src/controllers/ConversationsController";
import { ConversationsService } from "../../src/services/ConversationsService";
import { Env } from "../../src/types";

vi.mock("../../src/services/ConversationsService", () => {
  return {
    ConversationsService: vi.fn().mockImplementation(() => ({
      list: vi.fn(),
      create: vi.fn(),
      rename: vi.fn(),
      delete: vi.fn(),
    })),
  };
});

describe("ConversationsController", () => {
  let mockRequest: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockRequest = {
      query: {},
      params: {},
      json: vi.fn(),
    };
    mockEnv = {} as Env;
    (ConversationsService as any).mockClear();
  });

  it("lists conversations", async () => {
    mockRequest.query = { limit: "10", since: "0" };
    const mockList = vi.fn().mockResolvedValue([]);
    (
      ConversationsService as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({ list: mockList }));

    const res = await ConversationsController.list(mockRequest, mockEnv);
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(10, 0);
  });

  it("creates conversation", async () => {
    mockRequest.json.mockResolvedValue({ title: "Test" });
    const mockCreate = vi.fn().mockResolvedValue({ id: "c1", title: "Test" });
    (
      ConversationsService as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({ create: mockCreate }));

    const res = await ConversationsController.create(mockRequest, mockEnv);
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith("Test");
  });

  it("renames conversation", async () => {
    mockRequest.params = { id: "c1" };
    mockRequest.json.mockResolvedValue({ title: "Renamed" });

    const mockRename = vi
      .fn()
      .mockResolvedValue({ success: true, id: "c1", title: "Renamed" });
    (
      ConversationsService as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({ rename: mockRename }));

    const res = await ConversationsController.rename(mockRequest, mockEnv);
    expect(res.status).toBe(200);
    expect(mockRename).toHaveBeenCalledWith("c1", "Renamed");
  });

  it("deletes conversation", async () => {
    mockRequest.params = { id: "c1" };

    const mockDelete = vi.fn().mockResolvedValue({ success: true, id: "c1" });
    (
      ConversationsService as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({ delete: mockDelete }));

    const res = await ConversationsController.delete(mockRequest, mockEnv);
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith("c1");
  });
});
