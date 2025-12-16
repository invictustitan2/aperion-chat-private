import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unstable_dev, Unstable_DevWorker } from "wrangler";

describe("Authentication Middleware", () => {
  let worker: Unstable_DevWorker | undefined;
  const TEST_TOKEN = "test-secure-token-12345";

  beforeAll(async () => {
    try {
      worker = await unstable_dev("src/index.ts", {
        experimental: { disableExperimentalWarning: true },
        vars: {
          API_TOKEN: TEST_TOKEN,
        },
      });
    } catch (error) {
      console.error("Failed to start worker:", error);
      throw error;
    }
  }, 30000); // 30 second timeout for worker startup

  afterAll(async () => {
    if (worker) {
      await worker.stop();
    }
  });

  describe("Valid Authentication", () => {
    it("should allow requests with valid Bearer token", async () => {
      const resp = await worker!.fetch("http://localhost/v1/identity", {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
      });

      expect(resp.status).toBe(200);
    });

    it("should allow requests with valid token (case-sensitive Bearer)", async () => {
      const resp = await worker!.fetch("http://localhost/v1/identity", {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
      });

      expect(resp.status).toBe(200);
    });
  });

  describe("Missing Authentication", () => {
    it("should reject requests without Authorization header", async () => {
      const resp = await worker!.fetch("http://localhost/v1/identity");

      expect(resp.status).toBe(401);
      const body = (await resp.json()) as { error?: string };
      expect(body.error).toContain("Unauthorized");
    });

    it("should reject requests with empty Authorization header", async () => {
      const resp = await worker!.fetch("http://localhost/v1/identity", {
        headers: {
          Authorization: "",
        },
      });

      expect(resp.status).toBe(401);
    });
  });

  describe("Invalid Authentication", () => {
    it("should reject requests with wrong token", async () => {
      const resp = await worker!.fetch("http://localhost/v1/identity", {
        headers: {
          Authorization: "Bearer wrong-token",
        },
      });

      expect(resp.status).toBe(403);
      const body = (await resp.json()) as { error?: string };
      expect(body.error).toContain("Forbidden");
    });

    it("should reject requests without Bearer prefix", async () => {
      const resp = await worker!.fetch("http://localhost/v1/identity", {
        headers: {
          Authorization: TEST_TOKEN,
        },
      });

      expect(resp.status).toBe(403);
    });

    it("should reject requests with malformed Bearer token", async () => {
      const resp = await worker!.fetch("http://localhost/v1/identity", {
        headers: {
          Authorization: "Bearer",
        },
      });

      expect(resp.status).toBe(403);
    });

    it("should handle tokens with extra whitespace", async () => {
      const resp = await worker!.fetch("http://localhost/v1/identity", {
        headers: {
          Authorization: `Bearer  ${TEST_TOKEN}  `,
        },
      });

      // Should fail because token doesn't match exactly after trimming "Bearer "
      expect(resp.status).toBe(403);
    });
  });

  describe("CORS Preflight", () => {
    it("should handle OPTIONS requests without authentication", async () => {
      const resp = await worker!.fetch("http://localhost/v1/identity", {
        method: "OPTIONS",
      });

      expect(resp.status).toBe(204);
      expect(resp.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
      expect(resp.headers.get("Access-Control-Allow-Methods")).toContain("GET");
      expect(resp.headers.get("Access-Control-Allow-Headers")).toContain(
        "Authorization",
      );
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
        const resp = await worker!.fetch(`http://localhost${path}`, {
          method,
        });

        expect(resp.status).toBe(401);
      });

      it(`should allow authenticated ${method} ${path}`, async () => {
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

        const resp = await worker!.fetch(`http://localhost${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${TEST_TOKEN}`,
            "Content-Type": "application/json",
          },
          body,
        });

        // Should not be 401 or 403 (may be 400 for invalid body, but auth passed)
        expect(resp.status).not.toBe(401);
        expect(resp.status).not.toBe(403);
      });
    });
  });
});
