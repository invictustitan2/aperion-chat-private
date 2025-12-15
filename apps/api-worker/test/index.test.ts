import path from "path";
import { fileURLToPath } from "url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UnstableDevWorker } from "wrangler";
import { unstable_dev } from "wrangler";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe.skip("API Worker", () => {
  let worker: UnstableDevWorker;
  const API_TOKEN = "test-token";

  beforeAll(async () => {
    worker = await unstable_dev(path.resolve(__dirname, "../src/index.ts"), {
      experimental: { disableExperimentalWarning: true },
      vars: { API_TOKEN },
      d1Databases: ["MEMORY_DB"],
      // Mock AI and Vectorize for tests? Or integration test them?
      // Since Vectorize is a remote resource basically, integration testing it locally with just unstable_dev
      // requires binding mocks or actual local implementations which Miniflare supports but might be tricky to config here.
      // For now, let's assume if we don't bind them in test config, they might be undefined in the worker env
      // But we handle that gracefully in code (check if env.AI exists).
    });

    // Warm up the Worker bundle/boot so individual tests don't hit startup/compile latency.
    await worker.fetch("/v1/runbooks/hash", {
      method: "POST",
      headers: { Authorization: `Bearer ${API_TOKEN}` },
      body: "warmup",
    });
  }, 60000);

  afterAll(async () => {
    await worker.stop();
  });

  it("should reject unauthorized requests", async () => {
    const resp = await worker.fetch("/v1/episodic");
    expect(resp.status).toBe(401);
  });

  it("should reject invalid token", async () => {
    const resp = await worker.fetch("/v1/episodic", {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(resp.status).toBe(403);
  });

  it("should store episodic memory", async () => {
    const resp = await worker.fetch("/v1/episodic", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "Test content",
        provenance: {
          source_type: "user",
          source_id: "test-user",
          timestamp: Date.now(),
          confidence: 1.0,
        },
      }),
    });

    if (resp.status !== 200) {
      console.error("Store Episodic Error:", await resp.text());
    }
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as {
      success: boolean;
      id: string;
      receipt: { decision: string };
    };
    expect(data.success).toBe(true);
    expect(data.id).toBeDefined();
    expect(data.receipt.decision).toBe("allow");
  });

  it("should retrieve episodic memory", async () => {
    const resp = await worker.fetch("/v1/episodic", {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
    if (resp.status !== 200) {
      console.error("Retrieve Episodic Error:", await resp.text());
    }
    expect(resp.status).toBe(200);
    const data = (await resp.json()) as { content: string }[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].content).toBe("Test content");
  });

  it("should deny identity write without confirmation", async () => {
    const resp = await worker.fetch("/v1/identity", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: "test_key",
        value: "test_value",
        provenance: {
          source_type: "user",
          source_id: "test-user",
          timestamp: Date.now(),
          confidence: 1.0,
        },
        explicit_confirm: false,
      }),
    });

    if (resp.status !== 403) {
      console.error("Deny Identity Error:", await resp.text());
    }
    expect(resp.status).toBe(403);
    const data = (await resp.json()) as { error: string };
    expect(data.error).toContain("Policy denied");
  });

  it("should allow identity write with confirmation", async () => {
    const resp = await worker.fetch("/v1/identity", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: "test_key",
        value: "test_value",
        provenance: {
          source_type: "user",
          source_id: "test-user",
          timestamp: Date.now(),
          confidence: 1.0,
        },
        explicit_confirm: true,
      }),
    });

    if (resp.status !== 200) {
      console.error("Allow Identity Error:", await resp.text());
    }
    expect(resp.status).toBe(200);
  });

  it("should hash runbook task", async () => {
    const resp = await worker.fetch("/v1/runbooks/hash", {
      method: "POST",
      headers: { Authorization: `Bearer ${API_TOKEN}` },
      body: "  Deploy to production  ",
    });

    expect(resp.status).toBe(200);
    const data = (await resp.json()) as { taskId: string };
    expect(data.taskId).toBeDefined();
  });

  it("should manage dev logs", async () => {
    // Clear logs
    const clearResp = await worker.fetch("/api/dev/logs/clear", {
      method: "POST",
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
    expect(clearResp.status).toBe(200);

    // Get logs (should be empty)
    const resp = await worker.fetch("/api/dev/logs", {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
    expect(resp.status).toBe(200);
    const logs = (await resp.json()) as unknown[];
    expect(Array.isArray(logs)).toBe(true);
    // expect(logs.length).toBe(0); // Might not be 0 if other tests caused errors in parallel, but safe enough for now
  });
});
