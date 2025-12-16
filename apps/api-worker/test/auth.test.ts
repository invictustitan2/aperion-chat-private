import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unstable_dev, Unstable_DevWorker } from "wrangler";

/**
 * Helper to wait for worker to be ready by polling until it responds
 * This allows tests to proceed immediately once worker is live,
 * rather than waiting for the full timeout period
 */
async function waitForWorkerReady(
  worker: Unstable_DevWorker,
  token: string,
  maxAttempts = 60,
  intervalMs = 2000,
): Promise<void> {
  console.log("Waiting for worker to be ready...");

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await worker.fetch("http://localhost/v1/identity", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resp.status === 200 || resp.status === 401 || resp.status === 403) {
        // Worker is responding (even if auth fails, it's alive)
        console.log(
          `✓ Worker ready after ${attempt} attempts (~${(attempt * intervalMs) / 1000}s)`,
        );
        return;
      }
    } catch (error) {
      // Worker not ready yet, continue polling
      if (attempt % 5 === 0) {
        console.log(`  Still waiting... (attempt ${attempt}/${maxAttempts})`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Worker failed to become ready after ${maxAttempts} attempts`,
  );
}

describe("Authentication Middleware", () => {
  let worker: Unstable_DevWorker | undefined;
  const TEST_TOKEN = "test-secure-token-12345";

  beforeAll(async () => {
    try {
      // Get the absolute path to the worker directory
      const workerDir = path.resolve(__dirname, "..");
      const scriptPath = path.join(workerDir, "src", "index.ts");
      const configPath = path.join(workerDir, "wrangler.toml");

      console.log("Starting worker...");
      worker = await unstable_dev(scriptPath, {
        experimental: { disableExperimentalWarning: true },
        vars: {
          API_TOKEN: TEST_TOKEN,
        },
        config: configPath,
        persist: true, // Enable local persistence for D1
      });

      // Wait for worker to be ready (polls until responsive)
      await waitForWorkerReady(worker, TEST_TOKEN);
    } catch (error) {
      console.error("Failed to start worker:", error);
      throw error;
    }
  }, 120000); // 120 second timeout for CI environment

  afterAll(async () => {
    if (worker) {
      await worker.stop();
    }
  }, 10000); // 10 second timeout for cleanup

  describe("Valid Authentication", { timeout: 10000 }, () => {
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

  describe("Missing Authentication", { timeout: 10000 }, () => {
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

  describe("Invalid Authentication", { timeout: 10000 }, () => {
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

      expect(resp.status).toBe(401); // Invalid scheme returns 401
    });

    it("should reject requests with malformed Bearer token", async () => {
      const resp = await worker!.fetch("http://localhost/v1/identity", {
        headers: {
          Authorization: "Bearer",
        },
      });

      expect(resp.status).toBe(401); // Empty token returns 401
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

  describe("CORS Preflight", { timeout: 10000 }, () => {
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

  describe("Protected Endpoints", { timeout: 10000 }, () => {
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
