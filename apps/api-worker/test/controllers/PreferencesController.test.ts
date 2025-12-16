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
    mockRequest.params = { key: "theme" };
    const mockGet = vi
      .fn()
      .mockResolvedValue({ key: "theme", value: "dark", updatedAt: 1 });
    (
      PreferencesService as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({ get: mockGet }));

    const res = await PreferencesController.get(mockRequest, mockEnv);
    expect(res.status).toBe(200);
    expect(mockGet).toHaveBeenCalledWith("theme");
  });

  it("returns 404 when missing", async () => {
    mockRequest.params = { key: "missing" };
    const mockGet = vi.fn().mockResolvedValue(null);
    (
      PreferencesService as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({ get: mockGet }));

    const res = await PreferencesController.get(mockRequest, mockEnv);
    expect(res.status).toBe(404);
  });

  it("sets a preference", async () => {
    mockRequest.params = { key: "theme" };
    mockRequest.json.mockResolvedValue({ value: "light" });

    const mockSet = vi
      .fn()
      .mockResolvedValue({ key: "theme", value: "light", updatedAt: 2 });
    (
      PreferencesService as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({ set: mockSet }));

    const res = await PreferencesController.set(mockRequest, mockEnv);
    expect(res.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith("theme", "light");
  });
});
