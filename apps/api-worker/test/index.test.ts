import { describe, expect, it } from "vitest";
import type { Env } from "../src/types";
import { createApp } from "../src/app";
import { createMockEnv } from "./bindings/mockBindings";

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

describe("API Worker Integration", () => {
  const API_TOKEN = "test-token";
  const env = createMockEnv({ API_TOKEN }) as unknown as Env;

  it("Missing Authorization -> 401 with exact error shape", async () => {
    const app = createApp();
    const resp = await app.fetch(
      new Request("http://local.test/v1/conversations"),
      env,
      ctx,
    );
    expect(resp.status).toBe(401);
    expect(await resp.json()).toEqual({
      error: "Unauthorized (missing bearer token)",
      status: 401,
    });
  });

  it("Wrong scheme -> 401", async () => {
    const app = createApp();
    const resp = await app.fetch(
      new Request("http://local.test/v1/conversations", {
        headers: { Authorization: "Basic 123" },
      }),
      env,
      ctx,
    );
    expect(resp.status).toBe(401);
    expect(await resp.json()).toEqual({
      error:
        "Unauthorized (missing bearer token): Invalid authentication scheme",
      status: 401,
    });
  });

  it("Wrong token -> 403", async () => {
    const app = createApp();
    const resp = await app.fetch(
      new Request("http://local.test/v1/conversations", {
        headers: { Authorization: "Bearer wrong-token" },
      }),
      env,
      ctx,
    );
    expect(resp.status).toBe(403);
    expect(await resp.json()).toEqual({
      error: "Forbidden (invalid credentials)",
      status: 403,
    });
  });

  it("Valid token GET to a stable route -> 200 + response JSON shape", async () => {
    const app = createApp();
    const resp = await app.fetch(
      new Request("http://local.test/v1/conversations", {
        headers: { Authorization: `Bearer ${API_TOKEN}` },
      }),
      env,
      ctx,
    );
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data).toEqual([]);
  });

  it("OPTIONS preflight -> 204 + CORS headers", async () => {
    const app = createApp();
    const origin = "http://localhost:5173";
    const resp = await app.fetch(
      new Request("http://local.test/v1/conversations", {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET",
        },
      }),
      env,
      ctx,
    );
    expect(resp.status).toBe(204);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(resp.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(resp.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("Unknown route -> 404", async () => {
    const app = createApp();
    const resp = await app.fetch(
      new Request("http://local.test/v1/unknown-route", {
        headers: { Authorization: `Bearer ${API_TOKEN}` },
      }),
      env,
      ctx,
    );
    expect(resp.status).toBe(404);
  });

  it("Deterministic error-handler path", async () => {
    const app = createApp();
    const resp = await app.fetch(
      new Request("http://local.test/v1/conversations/123", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "" }),
      }),
      env,
      ctx,
    );

    expect(resp.status).toBe(400);
    const data = await resp.json();
    expect(data).toMatchObject({ status: 400 });
    expect((data as { error: string }).error).toContain("Invalid input");
  });
});
