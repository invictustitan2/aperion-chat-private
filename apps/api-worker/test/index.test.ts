import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";

describe("API Worker", () => {
  let worker: UnstableDevWorker;
  const API_TOKEN = "test-token";

  beforeAll(async () => {
    worker = await unstable_dev("src/index.ts", {
      experimental: { disableExperimentalWarning: true },
      vars: { API_TOKEN },
      d1Databases: ["MEMORY_DB"],
    });
  }, 30000);

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
});
