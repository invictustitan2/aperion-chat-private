import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { Env } from "../src/types";
import { createMockEnv } from "./bindings/mockBindings";

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

describe("Authentication Middleware", () => {
  const TEST_TOKEN = "test-secure-token-12345";
  const env = createMockEnv({ API_TOKEN: TEST_TOKEN }) as unknown as Env;

  describe("Valid Authentication", () => {
    it("should allow requests with valid Bearer token", async () => {
      const app = createApp();
      const resp = await app.fetch(
        new Request("http://local.test/v1/identity", {
          headers: {
            Authorization: `Bearer ${TEST_TOKEN}`,
          },
        }),
        env,
        ctx,
      );
      expect(resp.status).toBe(200);
    });

    it("should allow requests with valid token (case-sensitive Bearer)", async () => {
      const app = createApp();
      const resp = await app.fetch(
        new Request("http://local.test/v1/identity", {
          headers: {
            Authorization: `Bearer ${TEST_TOKEN}`,
          },
        }),
        env,
        ctx,
      );
      expect(resp.status).toBe(200);
    });
  });

  describe("Missing Authentication", () => {
    it("should reject requests without Authorization header", async () => {
      const app = createApp();
      const resp = await app.fetch(
        new Request("http://local.test/v1/identity"),
        env,
        ctx,
      );
      expect(resp.status).toBe(401);
      const body = (await resp.json()) as { error?: string };
      expect(body.error).toContain("Unauthorized");
    });

    it("should reject requests with empty Authorization header", async () => {
      const app = createApp();
      const resp = await app.fetch(
        new Request("http://local.test/v1/identity", {
          headers: { Authorization: "" },
        }),
        env,
        ctx,
      );
      expect(resp.status).toBe(401);
    });
  });

  describe("Invalid Authentication", () => {
    it("should reject requests with wrong token", async () => {
      const app = createApp();
      const resp = await app.fetch(
        new Request("http://local.test/v1/identity", {
          headers: { Authorization: "Bearer wrong-token" },
        }),
        env,
        ctx,
      );
      expect(resp.status).toBe(403);
      const body = (await resp.json()) as { error?: string };
      expect(body.error).toContain("Forbidden");
    });

    it("should reject requests without Bearer prefix", async () => {
      const app = createApp();
      const resp = await app.fetch(
        new Request("http://local.test/v1/identity", {
          headers: { Authorization: TEST_TOKEN },
        }),
        env,
        ctx,
      );
      expect(resp.status).toBe(401);
    });

    it("should reject requests with malformed Bearer token", async () => {
      const app = createApp();
      const resp = await app.fetch(
        new Request("http://local.test/v1/identity", {
          headers: { Authorization: "Bearer" },
        }),
        env,
        ctx,
      );
      expect(resp.status).toBe(401);
    });

    it("should handle tokens with extra whitespace", async () => {
      const app = createApp();
      const resp = await app.fetch(
        new Request("http://local.test/v1/identity", {
          headers: { Authorization: `Bearer  ${TEST_TOKEN}  ` },
        }),
        env,
        ctx,
      );
      expect(resp.status).toBe(403);
    });
  });

  describe("CORS Preflight", () => {
    it("should handle OPTIONS requests without authentication", async () => {
      const app = createApp();
      const resp = await app.fetch(
        new Request("http://local.test/v1/identity", { method: "OPTIONS" }),
        env,
        ctx,
      );
      expect(resp.status).toBe(204);
      expect(resp.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
      expect(resp.headers.get("Access-Control-Allow-Methods")).toContain("GET");
      expect(
        resp.headers.get("Access-Control-Allow-Headers")?.toLowerCase(),
      ).toContain("authorization");
    });
  });

  describe("Protected Endpoints", () => {
    const protectedEndpoints = [
      { method: "GET", path: "/v1/episodic" },
      { method: "POST", path: "/v1/episodic" },
      { method: "GET", path: "/v1/identity" },
      { method: "POST", path: "/v1/identity" },
      { method: "GET", path: "/v1/semantic/search?query=test" },
      { method: "POST", path: "/v1/semantic" },
      { method: "POST", path: "/v1/chat" },
    ];

    protectedEndpoints.forEach(({ method, path }) => {
      it(`should protect ${method} ${path}`, async () => {
        const app = createApp();
        const resp = await app.fetch(
          new Request(`http://local.test${path}`, { method }),
          env,
          ctx,
        );
        expect(resp.status).toBe(401);
      });

      it(`should allow authenticated ${method} ${path}`, async () => {
        const app = createApp();
        const body =
          method === "POST"
            ? JSON.stringify({
                content: "test",
                provenance: {
                  source_type: "test",
                  source_id: "test",
                  timestamp: Date.now(),
                  confidence: 1.0,
                },
              })
            : undefined;

        const resp = await app.fetch(
          new Request(`http://local.test${path}`, {
            method,
            headers: {
              Authorization: `Bearer ${TEST_TOKEN}`,
              "Content-Type": "application/json",
            },
            body,
          }),
          env,
          ctx,
        );
        expect(resp.status).not.toBe(401);
        expect(resp.status).not.toBe(403);
      });
    });
  });
});
