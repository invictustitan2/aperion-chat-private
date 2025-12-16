/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { processMemoryBatch } from "../src/lib/queue-processor";

// Define simple mocks for types to avoid complex imports
type Env = any;
type D1Database = any;
type Message<T> = any;
type MemoryQueueMessage = any;

// Mock dependencies
vi.mock("../src/lib/ai", () => ({
  generateChatCompletion: vi
    .fn()
    .mockResolvedValue({ response: "Mock summary" }),
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2]),
}));

const mockDB = {
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  run: vi.fn().mockResolvedValue({}),
};

// Mock Env
const mockEnv = {
  MEMORY_DB: {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({}),
  } as unknown as D1Database,
  AI: {},
  MEMORY_VECTORS: {
    insert: vi.fn(),
  },
  MEMORY_QUEUE: {
    send: vi.fn(),
  },
} as unknown as Env;

describe("Queue Processor Jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mockDB in mockEnv to ensure it uses the local mockDB for consistency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockEnv.MEMORY_DB as any) = mockDB;
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

    await processMemoryBatch([message], mockEnv);

    // Verify DB updates (Processing -> Completed)
    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE jobs SET status = 'processing'"),
    );
    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE jobs SET status = 'completed'"),
    );
    expect(mockDB.bind).toHaveBeenCalledWith(
      expect.stringContaining('{"summary":"Mock summary"}'),
      expect.any(Number),
      "job-123",
    );

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

    await processMemoryBatch([message], mockEnv);

    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE jobs SET status = 'processing'"),
    );
    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE jobs SET status = 'completed'"),
    );
    expect(mockDB.bind).toHaveBeenCalledWith(
      expect.stringContaining('{"embedding":[0.1,0.2]}'),
      expect.any(Number),
      "job-456",
    );

    expect(message.ack).toHaveBeenCalled();
  });
});
