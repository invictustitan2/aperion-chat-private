import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryQueueMessage,
  processMemoryBatch,
} from "../src/lib/queue-processor";
import {
  createFakeAi,
  createFakeD1Database,
  createFakeVectorizeIndex,
  createMockEnv,
} from "./bindings/mockBindings";

describe("Queue Processor", () => {
  let env: ReturnType<typeof createMockEnv>;
  let db: ReturnType<typeof createFakeD1Database>;
  let vectors: ReturnType<typeof createFakeVectorizeIndex>;
  let ai: ReturnType<typeof createFakeAi>;

  beforeEach(() => {
    db = createFakeD1Database();
    vectors = createFakeVectorizeIndex();
    ai = createFakeAi({ embedding: [0.1, 0.2] });
    vi.spyOn(ai as unknown as { run: (...args: unknown[]) => unknown }, "run");
    vi.spyOn(
      vectors as unknown as { insert: (...args: unknown[]) => unknown },
      "insert",
    );

    env = createMockEnv({
      MEMORY_DB: db,
      AI: ai,
      MEMORY_VECTORS: vectors,
    });
  });

  it("should process episodic messages", async () => {
    const messages = [
      {
        id: "msg-1",
        body: {
          type: "episodic",
          record: {
            id: "rec-1",
            content: "test content",
            provenance: { source_type: "user" },
            createdAt: 123,
          },
        },
        ack: vi.fn(),
        retry: vi.fn(),
      },
    ] as unknown as Message<MemoryQueueMessage>[];

    await processMemoryBatch(messages, env);

    expect(
      db.prepared.some((p) => p.query.includes("INSERT INTO episodic")),
    ).toBe(true);
    expect(messages[0].ack).toHaveBeenCalled();
  });

  it("should process semantic messages and generate embeddings", async () => {
    const messages = [
      {
        id: "msg-2",
        body: {
          type: "semantic",
          record: {
            id: "rec-2",
            content: "semantic content",
            provenance: { source_type: "system" },
            createdAt: 123,
          },
        },
        ack: vi.fn(),
        retry: vi.fn(),
      },
    ] as unknown as Message<MemoryQueueMessage>[];

    await processMemoryBatch(messages, env);

    expect(
      (ai as unknown as { run: (...args: unknown[]) => unknown }).run,
    ).toHaveBeenCalled();
    expect(
      db.prepared.some((p) => p.query.includes("INSERT INTO semantic")),
    ).toBe(true);
    expect(
      (vectors as unknown as { insert: (...args: unknown[]) => unknown })
        .insert,
    ).toHaveBeenCalled();
    expect(messages[0].ack).toHaveBeenCalled();
  });

  it("should retry if processing fails", async () => {
    db = createFakeD1Database({
      run: async () => {
        throw new Error("DB Error");
      },
    });

    env = createMockEnv({
      MEMORY_DB: db,
      AI: ai,
      MEMORY_VECTORS: vectors,
    });

    const messages = [
      {
        id: "msg-3",
        body: {
          type: "episodic",
          record: { id: "rec-3", content: "fail", provenance: {} },
        },
        ack: vi.fn(),
        retry: vi.fn(),
      },
    ] as unknown as Message<MemoryQueueMessage>[];

    await processMemoryBatch(messages, env);
    expect(messages[0].retry).toHaveBeenCalled();
  });
});
