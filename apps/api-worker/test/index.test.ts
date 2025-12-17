import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UnstableDevWorker } from "wrangler";
import { unstable_dev } from "wrangler";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

describe.skipIf(isCI)("API Worker Integration", () => {
  let worker: UnstableDevWorker;
  const API_TOKEN = "test-token";

  beforeAll(async () => {
    // Apply migrations to the test database
    try {
      // Parse wrangler.toml to find the database name for env.test
      const wranglerConfig = fs.readFileSync(
        path.resolve(__dirname, "../wrangler.toml"),
        "utf-8",
      );
      // Look for the [env.test] section and the d1_databases definition within it
      // This regex looks for [[env.test.d1_databases]] and captures the database_name
      const dbNameMatch = wranglerConfig.match(
        /\[\[env\.test\.d1_databases\]\][\s\S]*?database_name\s*=\s*"([^"]+)"/,
      );

      if (!dbNameMatch) {
        throw new Error(
          "Could not find database_name for env.test in wrangler.toml",
        );
      }

      const dbName = dbNameMatch[1];

      // Ensure the migrations are applied to the local D1 database used by the test environment
      execSync(
        `pnpm wrangler d1 migrations apply ${dbName} --local --env test`,
        {
          cwd: path.resolve(__dirname, ".."),
          stdio: "inherit",
        },
      );
    } catch (e) {
      console.error("Failed to apply migrations:", e);
      throw e;
    }

    worker = await unstable_dev(path.resolve(__dirname, "../src/index.ts"), {
      env: "test",
      vars: { API_TOKEN },
      experimental: { disableExperimentalWarning: true },
      ip: "127.0.0.1",
      inspectorPort: 0,
    });
  }, 60000);

  afterAll(async () => {
    await worker.stop();
  });

  it("Missing Authorization -> 401 with exact error shape", async () => {
    const resp = await worker.fetch("/v1/conversations");
    expect(resp.status).toBe(401);
    const data = await resp.json();
    expect(data).toEqual({
      error: "Unauthorized: Missing authentication token",
      status: 401,
    });
  });

  it("Wrong scheme -> 401", async () => {
    const resp = await worker.fetch("/v1/conversations", {
      headers: { Authorization: "Basic 123" },
    });
    expect(resp.status).toBe(401);
    const data = await resp.json();
    expect(data).toEqual({
      error:
        "Unauthorized: Invalid authentication scheme. Use 'Bearer <token>'",
      status: 401,
    });
  });

  it("Wrong token -> 403", async () => {
    const resp = await worker.fetch("/v1/conversations", {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(resp.status).toBe(403);
    const data = await resp.json();
    expect(data).toEqual({
      error: "Forbidden: Invalid credentials",
      status: 403,
    });
  });

  it("Valid token GET to a stable route -> 200 + response JSON shape", async () => {
    const resp = await worker.fetch("/v1/conversations", {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  it("OPTIONS preflight -> 204 + CORS headers", async () => {
    const origin = "http://localhost:5173";
    const resp = await worker.fetch("/v1/conversations", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(resp.status).toBe(204);
    expect(resp.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(resp.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(resp.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("Unknown route -> 404 (exact)", async () => {
    const resp = await worker.fetch("/v1/unknown-route", {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
    expect(resp.status).toBe(404);
  });

  it("Deterministic error-handler path", async () => {
    // Trigger an error in ConversationsController.rename by sending invalid JSON (empty title)
    // PUT /v1/conversations/:id
    const resp = await worker.fetch("/v1/conversations/123", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "" }), // Empty title should fail validation
    });

    expect(resp.status).toBe(400);
    const data = await resp.json();
    expect(data).toMatchObject({
      status: 400,
    });
    expect((data as { error: string }).error).toContain("Invalid input");
  });
});
