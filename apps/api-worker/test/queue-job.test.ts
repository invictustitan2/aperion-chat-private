/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryQueueMessage,
  processMemoryBatch,
} from "../src/lib/queue-processor";
import {
  createFakeAi,
  createFakeD1Database,
  createFakeQueue,
  createFakeVectorizeIndex,
  createMockEnv,
} from "./bindings/mockBindings";

describe("Queue Processor Jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should process summarize job", async () => {
    const message = {
      id: "msg-1",
      body: {
        type: "summarize",
        jobId: "job-123",
        contents: ["content1", "content2"],
        query: "test query",
      },
      ack: vi.fn(),
      retry: vi.fn(),
    } as unknown as Message<MemoryQueueMessage>;

    const db = createFakeD1Database();
    const queue = createFakeQueue<MemoryQueueMessage>();
    const vectors = createFakeVectorizeIndex();
    vi.spyOn(queue, "send");
    vi.spyOn(
      vectors as unknown as { insert: (...args: unknown[]) => unknown },
      "insert",
    );

    const env = createMockEnv({
      MEMORY_DB: db,
      MEMORY_QUEUE: queue,
      MEMORY_VECTORS: vectors,
      AI: createFakeAi({ chatResponse: "Mock summary", embedding: [0.1, 0.2] }),
    });

    await processMemoryBatch([message], env);

    // Verify DB updates (Processing -> Completed)
    expect(
      db.prepared.some((p) =>
        p.query.includes("UPDATE jobs SET status = 'processing'"),
      ),
    ).toBe(true);
    expect(
      db.prepared.some((p) =>
        p.query.includes("UPDATE jobs SET status = 'completed'"),
      ),
    ).toBe(true);
    expect(
      db.prepared.some((p) =>
        p.binds.some(
          (b) =>
            typeof b === "string" && b.includes('{"summary":"Mock summary"}'),
        ),
      ),
    ).toBe(true);
    expect(db.prepared.some((p) => p.binds.includes("job-123"))).toBe(true);

    // Verify AI call implicit via mock result usage
    expect(message.ack).toHaveBeenCalled();
  });

  it("should process embed job", async () => {
    const message = {
      id: "msg-2",
      body: {
        type: "embed",
        jobId: "job-456",
        content: "text to embed",
      },
      ack: vi.fn(),
      retry: vi.fn(),
    } as unknown as Message<MemoryQueueMessage>;

    const db = createFakeD1Database();
    const queue = createFakeQueue<MemoryQueueMessage>();
    const vectors = createFakeVectorizeIndex();
    vi.spyOn(queue, "send");
    vi.spyOn(
      vectors as unknown as { insert: (...args: unknown[]) => unknown },
      "insert",
    );

    const env = createMockEnv({
      MEMORY_DB: db,
      MEMORY_QUEUE: queue,
      MEMORY_VECTORS: vectors,
      AI: createFakeAi({ chatResponse: "Mock summary", embedding: [0.1, 0.2] }),
    });

    await processMemoryBatch([message], env);

    expect(
      db.prepared.some((p) =>
        p.query.includes("UPDATE jobs SET status = 'processing'"),
      ),
    ).toBe(true);
    expect(
      db.prepared.some((p) =>
        p.query.includes("UPDATE jobs SET status = 'completed'"),
      ),
    ).toBe(true);
    expect(
      db.prepared.some((p) =>
        p.binds.some(
          (b) => typeof b === "string" && b.includes('{"embedding":[0.1,0.2]}'),
        ),
      ),
    ).toBe(true);
    expect(db.prepared.some((p) => p.binds.includes("job-456"))).toBe(true);

    expect(message.ack).toHaveBeenCalled();
  });
});
