/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsController } from "../../src/controllers/AnalyticsController";
import { AnalyticsService } from "../../src/services/AnalyticsService";
import { Env } from "../../src/types";

vi.mock("../../src/services/AnalyticsService", () => {
  return {
    AnalyticsService: vi.fn().mockImplementation(() => ({
      dashboard: vi.fn(),
    })),
  };
});

describe("AnalyticsController", () => {
  let mockRequest: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockRequest = { query: {} };
    mockEnv = {} as Env;
    (AnalyticsService as any).mockClear();
  });

  it("returns 400 for invalid days", async () => {
    mockRequest.query = { days: "nope" };
    const res = await AnalyticsController.dashboard(mockRequest, mockEnv);
    expect(res.status).toBe(400);
  });

  it("returns dashboard data", async () => {
    const mockDashboard = vi.fn().mockResolvedValue({
      generatedAt: 1,
      days: [],
      summary: [],
      topics: [],
      aiUsage: { assistantMessages30d: 0, avgAssistantChars30d: 0 },
    });
    (
      AnalyticsService as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({ dashboard: mockDashboard }));

    mockRequest.query = { days: "30" };

    const res = await AnalyticsController.dashboard(mockRequest, mockEnv);
    expect(res.status).toBe(200);
    expect(mockDashboard).toHaveBeenCalledWith(30);
  });
});
