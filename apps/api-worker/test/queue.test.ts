import {
  Ai,
  D1Database,
  Message,
  VectorizeIndex,
} from "@cloudflare/workers-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Env } from "../src/index";
import {
  MemoryQueueMessage,
  processMemoryBatch,
} from "../src/lib/queue-processor";

describe("Queue Processor", () => {
  let mockEnv: Partial<Env>;
  let mockDB: D1Database;
  let mockAI: Ai;
  let mockVectors: VectorizeIndex;

  beforeEach(() => {
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as D1PreparedStatement;

    mockDB = {
      prepare: vi.fn().mockReturnValue(mockStmt),
    } as unknown as D1Database;

    mockAI = {
      run: vi.fn().mockResolvedValue({ data: [[0.1, 0.2]] }),
    } as unknown as Ai;

    mockVectors = {
      insert: vi.fn().mockResolvedValue({}),
    } as unknown as VectorizeIndex;

    mockEnv = {
      MEMORY_DB: mockDB,
      AI: mockAI,
      MEMORY_VECTORS: mockVectors,
    };
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

    await processMemoryBatch(messages, mockEnv as Env);

    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO episodic"),
    );
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

    await processMemoryBatch(messages, mockEnv as Env);

    expect(mockAI.run).toHaveBeenCalled(); // Should generate embedding
    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO semantic"),
    );
    expect(mockVectors.insert).toHaveBeenCalled();
    expect(messages[0].ack).toHaveBeenCalled();
  });

  it("should retry if processing fails", async () => {
    const mockStmtThrow = {
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockRejectedValue(new Error("DB Error")),
    } as unknown as PreparedStatement;
    mockDB.prepare = vi.fn().mockReturnValue(mockStmtThrow);

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

    await processMemoryBatch(messages, mockEnv as Env);
    expect(messages[0].retry).toHaveBeenCalled();
  });
});
