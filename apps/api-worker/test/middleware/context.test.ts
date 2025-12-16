/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { withContext } from "../../src/middleware/context";
import { Env } from "../../src/types";

describe("withContext Middleware", () => {
  it("should attach logger and metrics to request", () => {
    const mockRequest: any = {
      headers: {
        get: vi.fn(),
      },
    };
    const mockEnv: Env = {
      METRICS: {} as any,
    } as unknown as Env;

    withContext(mockRequest, mockEnv);

    expect(mockRequest.ctx).toBeDefined();
    expect(mockRequest.ctx.logger).toBeDefined();
    expect(mockRequest.ctx.metrics).toBeDefined();
    expect(mockRequest.ctx.traceId).toBeDefined();
    expect(mockRequest.ctx.startTime).toBeTypeOf("number");
  });

  it("should use existing cf-ray as traceId if present", () => {
    const mockRequest: any = {
      headers: {
        get: vi.fn(),
      },
    };
    mockRequest.headers.get.mockReturnValue("existing-trace-id");
    const mockEnv = {} as Env;

    withContext(mockRequest, mockEnv);

    expect(mockRequest.ctx.traceId).toBe("existing-trace-id");
  });
});
