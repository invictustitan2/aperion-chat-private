import { describe, it, expect, vi } from "vitest";
import { createApp } from "../src/app";
import { Env } from "../src/types";

// This suite exists to make router/middleware composition visible to V8 coverage.
// Runtime behavior is proven by unstable_dev integration tests in index.test.ts.

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

// Mock Durable Object stub
const mockStub = {
  fetch: vi.fn().mockResolvedValue(new Response("ok")),
};

const mockEnv = {
  API_TOKEN: "test-token",
  CHAT_STATE: {
    idFromName: () => "id",
    get: () => mockStub,
  },
} as unknown as Env;

describe("API Worker wiring (in-process coverage)", () => {
  it("Missing Authorization -> 401 (auth middleware wired)", async () => {
    const app = createApp();
    const req = new Request("http://local.test/v1/conversations");
    const resp = await app.fetch(req, mockEnv, ctx);
    expect(resp.status).toBe(401);
  });

  it("Access mode missing assertion -> 401 (fail-closed canary)", async () => {
    const app = createApp();
    const req = new Request("http://local.test/v1/conversations");
    const envAccessMode = {
      ...mockEnv,
      APERION_AUTH_MODE: "access",
      CF_ACCESS_TEAM_DOMAIN: "team",
      CF_ACCESS_AUD: "aud",
    } as unknown as Env;
    const resp = await app.fetch(req, envAccessMode, ctx);
    expect(resp.status).toBe(401);
    const data = await resp.json();
    expect(data).toMatchObject({
      status: 401,
    });
  });

  it("OPTIONS -> 204 and includes CORS headers", async () => {
    const app = createApp();
    const req = new Request("http://local.test/v1/conversations", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers":
          "content-type, x-aperion-client-version",
      },
    });
    const resp = await app.fetch(req, mockEnv, ctx);
    expect(resp.status).toBe(204);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );
    expect(resp.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(resp.headers.get("Vary")).toBe(
      "Origin, Access-Control-Request-Headers",
    );
    expect(
      resp.headers.get("Access-Control-Allow-Headers")?.toLowerCase(),
    ).toContain("content-type");
    expect(
      resp.headers.get("Access-Control-Allow-Headers")?.toLowerCase(),
    ).toContain("x-aperion-client-version");
  });

  it("GET -> includes strict CORS headers for allowed origin", async () => {
    const app = createApp();
    const req = new Request("http://local.test/v1/nope", {
      headers: {
        Origin: "https://chat.aperion.cc",
        Authorization: "Bearer test-token",
      },
    });
    const resp = await app.fetch(req, mockEnv, ctx);
    expect(resp.status).toBe(404);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://chat.aperion.cc",
    );
    expect(resp.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(resp.headers.get("Vary")).toBe("Origin");
  });

  it("GET -> does not include allow-origin for unknown origin", async () => {
    const app = createApp();
    const req = new Request("http://local.test/v1/nope", {
      headers: {
        Origin: "https://evil.com",
        Authorization: "Bearer test-token",
      },
    });
    const resp = await app.fetch(req, mockEnv, ctx);
    expect(resp.status).toBe(404);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(resp.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    expect(resp.headers.get("Vary")).toBeNull();
  });

  it("Unknown route -> 404", async () => {
    const app = createApp();
    const req = new Request("http://local.test/v1/nope", {
      headers: { Authorization: "Bearer test-token" },
    });
    const resp = await app.fetch(req, mockEnv, ctx);
    expect(resp.status).toBe(404);
  });

  it("WebSocket route -> 503 if ChatState not configured", async () => {
    const app = createApp();
    const req = new Request("http://local.test/v1/ws", {
      headers: { Authorization: "Bearer test-token" },
    });
    const envWithoutDO = { ...mockEnv, CHAT_STATE: undefined };
    const resp = await app.fetch(req, envWithoutDO, ctx);
    expect(resp.status).toBe(503);
    const data = await resp.json();
    expect(data).toEqual({
      error: "ChatState is not configured",
      status: 503,
    });
  });

  it("WebSocket route -> delegates to Durable Object", async () => {
    const app = createApp();
    const req = new Request("http://local.test/v1/ws", {
      headers: { Authorization: "Bearer test-token" },
    });
    const resp = await app.fetch(req, mockEnv, ctx);
    expect(resp.status).toBe(200);
    expect(mockStub.fetch).toHaveBeenCalled();

    const firstArg = mockStub.fetch.mock.calls[0]?.[0];
    expect(firstArg).toBeInstanceOf(Request);
  });
});
