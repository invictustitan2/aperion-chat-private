import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => {
  return {
    DurableObject: class {
      constructor(_state: unknown, _env: unknown) {}
    },
  };
});

vi.mock("../src/app", () => {
  const fetch = vi.fn(async () => new Response("ok"));
  const createApp = vi.fn(() => ({ fetch }));
  return {
    createApp,
  };
});

vi.mock("../src/lib/janitor", () => {
  return {
    cleanupLogs: vi.fn(async () => ({ deleted: 3 })),
  };
});

vi.mock("../src/lib/queue-processor", () => {
  return {
    processMemoryBatch: vi.fn(async () => undefined),
  };
});

vi.mock("../src/middleware/rateLimit", () => {
  return {
    cleanupRateLimits: vi.fn(async () => ({ deleted: 2 })),
  };
});

describe("api-worker entrypoint (src/index.ts)", () => {
  it("fetch delegates to createApp().fetch", async () => {
    const mod = await import("../src/index");
    const worker = mod.default;
    const { createApp } = await import("../src/app");

    const request = new Request("http://local.test/v1/hello");
    const env = {} as any;
    const ctx = { waitUntil: vi.fn() } as any;

    const resp = await worker.fetch(request, env, ctx);
    expect(resp.status).toBe(200);
    expect(vi.mocked(createApp)).toHaveBeenCalledTimes(1);
    const app = vi.mocked(createApp).mock.results[0]?.value as any;
    expect(app.fetch).toHaveBeenCalledTimes(1);
  });

  it("queue delegates to processMemoryBatch", async () => {
    const mod = await import("../src/index");
    const worker = mod.default;
    const { processMemoryBatch } = await import("../src/lib/queue-processor");

    const env = {} as any;
    const batch = { messages: [{ id: "m1" }, { id: "m2" }] } as any;
    await worker.queue(batch, env);

    expect(vi.mocked(processMemoryBatch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(processMemoryBatch).mock.calls[0][0]).toHaveLength(2);
  });

  it("scheduled enqueues cleanup tasks via waitUntil", async () => {
    const mod = await import("../src/index");
    const worker = mod.default;

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const ctx = { waitUntil: vi.fn() } as any;
    await worker.scheduled({} as any, {} as any, ctx);

    expect(ctx.waitUntil).toHaveBeenCalledTimes(2);
    await Promise.all(ctx.waitUntil.mock.calls.map((c: any[]) => c[0]));

    logSpy.mockRestore();
  });
});
