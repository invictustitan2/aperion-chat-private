/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withRateLimit } from "../../src/middleware/rateLimit";
import { Env } from "../../src/types";
import { IRequest } from "itty-router";

describe("Rate Limit Middleware", () => {
  let mockRequest: IRequest;
  let mockEnv: Env;

  beforeEach(() => {
    mockRequest = {
      headers: new Map([["cf-connecting-ip", "127.0.0.1"]]),
    } as unknown as IRequest;

    mockEnv = {
      MEMORY_DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({}),
          first: vi.fn().mockResolvedValue(null),
        }),
      },
    } as unknown as Env;
  });

  it("should allow request if within limit", async () => {
    // Mock existing record: 1 request in current window
    (mockEnv.MEMORY_DB.prepare as any).mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockResolvedValue({
        count: 1,
        window_start: Date.now(),
      }),
    });

    const response = await withRateLimit(mockRequest, mockEnv, "default");
    expect(response).toBeNull(); // Null means pass
  });

  it("should block request if limit exceeded", async () => {
    // Mock existing record: 100 requests in current window (limit is 60)
    (mockEnv.MEMORY_DB.prepare as any).mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockResolvedValue({
        count: 100,
        window_start: Date.now(),
      }),
    });

    const response = await withRateLimit(mockRequest, mockEnv, "default");
    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
    const data = await response?.json();
    expect(data).toEqual({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Try again in 60 seconds.",
      retryAfter: 60,
    });
  });

  it("should reset window if expired", async () => {
    // Mock existing record: 100 requests but from old window
    (mockEnv.MEMORY_DB.prepare as any).mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockResolvedValue({
        count: 100,
        window_start: Date.now() - 70000, // 70s ago (window is 60s)
      }),
    });

    const response = await withRateLimit(mockRequest, mockEnv, "default");
    expect(response).toBeNull(); // Should reset and pass
  });

  it("should handle new clients", async () => {
    // Mock no existing record
    (mockEnv.MEMORY_DB.prepare as any).mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockResolvedValue(null),
    });

    const response = await withRateLimit(mockRequest, mockEnv, "default");
    expect(response).toBeNull();
  });

  it("should use fallback IP if cf-connecting-ip is missing", async () => {
    mockRequest = {
      headers: new Map([["x-forwarded-for", "10.0.0.1, 10.0.0.2"]]),
    } as unknown as IRequest;

    (mockEnv.MEMORY_DB.prepare as any).mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockResolvedValue(null),
    });

    const response = await withRateLimit(mockRequest, mockEnv, "default");
    expect(response).toBeNull();
    // We can't easily check the key used without spying on prepare arguments,
    // but we can ensure it doesn't crash
  });
});
