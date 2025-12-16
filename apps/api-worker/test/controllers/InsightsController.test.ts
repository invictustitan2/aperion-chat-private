/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InsightsController } from "../../src/controllers/InsightsController";
import { InsightsService } from "../../src/services/InsightsService";
import { Env } from "../../src/types";

vi.mock("../../src/services/InsightsService", () => {
  return {
    InsightsService: vi.fn().mockImplementation(() => ({
      generateSummary: vi.fn(),
    })),
  };
});

describe("InsightsController", () => {
  let mockRequest: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockRequest = {
      query: {},
      params: {},
      json: vi.fn(),
    };
    mockEnv = {} as Env;
    (InsightsService as any).mockClear();
  });

  it("returns completed summary", async () => {
    mockRequest.json.mockResolvedValue({ query: "hello", limit: 5 });

    const mockGenerate = vi.fn().mockResolvedValue({
      summary: "ok",
      sources: [{ type: "semantic", id: "s1" }],
    });
    (InsightsService as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => ({ generateSummary: mockGenerate }),
    );

    const res = await InsightsController.summarize(mockRequest, mockEnv);
    expect(res.status).toBe(200);
  });

  it("returns queued summary", async () => {
    mockRequest.json.mockResolvedValue({ query: "hello" });

    const mockGenerate = vi.fn().mockResolvedValue({
      jobId: "j1",
      status: "queued",
      sources: [{ type: "semantic", id: "s1" }],
    });
    (InsightsService as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => ({ generateSummary: mockGenerate }),
    );

    const res = await InsightsController.summarize(mockRequest, mockEnv);
    expect(res.status).toBe(200);
  });
});
