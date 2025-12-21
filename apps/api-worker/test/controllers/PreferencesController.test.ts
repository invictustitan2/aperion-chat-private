/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PreferencesController } from "../../src/controllers/PreferencesController";
import { PreferencesService } from "../../src/services/PreferencesService";
import { Env } from "../../src/types";

vi.mock("../../src/services/PreferencesService", () => {
  return {
    PreferencesService: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      set: vi.fn(),
    })),
  };
});

describe("PreferencesController", () => {
  let mockRequest: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockRequest = {
      params: {},
      json: vi.fn(),
    };
    mockEnv = {} as Env;
    (PreferencesService as any).mockClear();
  });

  it("gets a preference", async () => {
    mockRequest.params = { key: "ai.tone" };
    const mockGet = vi
      .fn()
      .mockResolvedValue({ key: "ai.tone", value: "default", updatedAt: 1 });
    (
      PreferencesService as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({ get: mockGet }));

    const res = await PreferencesController.get(mockRequest, mockEnv);
    expect(res.status).toBe(200);
    expect(mockGet).toHaveBeenCalledWith("ai.tone");
  });

  it("returns default for known key when missing", async () => {
    mockRequest.params = { key: "ai.tone" };
    const mockGet = vi.fn().mockResolvedValue(null);
    (
      PreferencesService as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({ get: mockGet }));

    const res = await PreferencesController.get(mockRequest, mockEnv);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      key: string;
      value: unknown;
      isDefault?: boolean;
    };
    expect(body.key).toBe("ai.tone");
    expect(body.value).toBe("default");
    expect(body.isDefault).toBe(true);
  });

  it("returns 404 for unknown keys", async () => {
    mockRequest.params = { key: "theme" };

    const res = await PreferencesController.get(mockRequest, mockEnv);
    expect(res.status).toBe(404);
  });

  it("sets a preference", async () => {
    mockRequest.params = { key: "ai.tone" };
    mockRequest.json.mockResolvedValue({ value: "concise" });

    const mockSet = vi
      .fn()
      .mockResolvedValue({ key: "ai.tone", value: "concise", updatedAt: 2 });
    (
      PreferencesService as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({ set: mockSet }));

    const res = await PreferencesController.set(mockRequest, mockEnv);
    expect(res.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith("ai.tone", "concise");
  });

  it("rejects invalid values for known keys", async () => {
    mockRequest.params = { key: "ai.tone" };
    mockRequest.json.mockResolvedValue({ value: "invalid" });

    const res = await PreferencesController.set(mockRequest, mockEnv);
    expect(res.status).toBe(400);
  });

  it("returns 404 on set for unknown keys", async () => {
    mockRequest.params = { key: "theme" };
    mockRequest.json.mockResolvedValue({ value: "dark" });

    const res = await PreferencesController.set(mockRequest, mockEnv);
    expect(res.status).toBe(404);
  });
});
