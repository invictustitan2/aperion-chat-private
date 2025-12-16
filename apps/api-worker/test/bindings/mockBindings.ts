import type { BrowserWorker } from "@cloudflare/puppeteer";

import type { MemoryQueueMessage } from "../../src/lib/queue-processor";
import type { Env } from "../../src/types";

export type FakeAiRunResult =
  | { data: number[][] }
  | { response: string; tool_calls?: unknown[] }
  | ReadableStream<Uint8Array>;

export interface FakeAiOptions {
  embedding?: number[];
  chatResponse?: string;
  stream?: ReadableStream<Uint8Array>;
}

export function createFakeAi(options: FakeAiOptions = {}): Ai {
  const embedding = options.embedding ?? [0.1, 0.2];
  const chatResponse = options.chatResponse ?? "Mock response";

  return {
    // Workers AI binding shape: ai.run(model, input)
    run: async (model: unknown, input: unknown): Promise<FakeAiRunResult> => {
      const modelStr = String(model);
      const inputObj = input as { stream?: boolean } | undefined;

      if (inputObj?.stream && options.stream) {
        return options.stream;
      }

      // Embedding models return { data: [[...]] }
      if (modelStr.includes("bge") || modelStr.includes("embedding")) {
        return { data: [embedding] };
      }

      // Chat/summarization models return { response: "..." }
      return { response: chatResponse };
    },
  } as unknown as Ai;
}

export interface FakeVectorizeOptions {
  insertResult?: unknown;
  fixedQueryMatches?: unknown[];
}

export function createFakeVectorizeIndex(
  options: FakeVectorizeOptions = {},
): VectorizeIndex & { inserted: unknown[] } {
  const inserted: unknown[] = [];

  const index = {
    inserted,
    insert: async (vectors: unknown) => {
      inserted.push(vectors);
      return options.insertResult ?? {};
    },
    query: async () => ({ matches: options.fixedQueryMatches ?? [] }),
  };

  return index as unknown as VectorizeIndex & { inserted: unknown[] };
}

export interface FakeQueue<T> {
  sent: T[];
  send: Queue<T>["send"];
}

export function createFakeQueue<T>(): Queue<T> & { sent: T[] } {
  const sent: T[] = [];

  return {
    sent,
    send: async (message: T) => {
      sent.push(message);
    },
    sendBatch: async (messages: Iterable<MessageSendRequest<T>>) => {
      for (const req of messages) {
        sent.push(req.body);
      }
    },
  };
}

export interface FakeD1PreparedStatement extends D1PreparedStatement {
  bind(...args: unknown[]): FakeD1PreparedStatement;
  first<T = unknown>(colName: string): Promise<T | null>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(options: {
    columnNames: true;
  }): Promise<[string[], ...T[]]>;
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
}

export interface FakeD1Database extends D1Database {
  prepare: (query: string) => FakeD1PreparedStatement;
  prepared: { query: string; binds: unknown[] }[];
}

export interface FakeD1Options {
  run?: (entry: { query: string; binds: unknown[] }) => Promise<unknown>;
  first?: (entry: { query: string; binds: unknown[] }) => Promise<unknown>;
  all?: (entry: { query: string; binds: unknown[] }) => Promise<unknown>;
  raw?: (entry: { query: string; binds: unknown[] }) => Promise<unknown>;
}

export function createFakeD1Database(
  options: FakeD1Options = {},
): FakeD1Database {
  const prepared: { query: string; binds: unknown[] }[] = [];
  const runImpl = options.run ?? (async () => ({ success: true, results: [] }));
  const firstImpl = options.first ?? (async () => null);
  const allImpl =
    options.all ?? (async () => ({ success: true, meta: {}, results: [] }));
  const rawImpl = options.raw ?? (async () => []);

  const db = {
    prepared,
    prepare: (query: string) => {
      const entry = { query, binds: [] as unknown[] };
      prepared.push(entry);

      const stmt = {
        bind: (...args: unknown[]) => {
          entry.binds.push(...args);
          return stmt as unknown as FakeD1PreparedStatement;
        },
        first: async (colName?: string) => {
          const row = (await firstImpl(entry)) as unknown;
          if (typeof colName !== "string") return row as unknown;
          if (!row || typeof row !== "object") return null;
          const rec = row as Record<string, unknown>;
          return rec[colName] ?? null;
        },
        run: async () => {
          const out = (await runImpl(entry)) as unknown;
          return (out ?? { success: true, meta: {}, results: [] }) as unknown;
        },
        all: async () => {
          const out = (await allImpl(entry)) as unknown;
          return (out ?? { success: true, meta: {}, results: [] }) as unknown;
        },
        raw: async (opts?: { columnNames?: boolean }) => {
          const out = (await rawImpl(entry)) as unknown;
          const rows = Array.isArray(out) ? out : [];
          if (opts?.columnNames) {
            return [[] as string[], ...rows];
          }
          return rows;
        },
      } as unknown as FakeD1PreparedStatement;

      return stmt;
    },
  };

  return db as unknown as FakeD1Database;
}

export interface MockEnvOptions {
  AI?: Ai;
  MEMORY_DB?: D1Database;
  MEMORY_VECTORS?: VectorizeIndex;
  MEMORY_QUEUE?: Queue<MemoryQueueMessage>;
  API_TOKEN?: string;
}

// Single source of truth for deterministic bindings in tests.
// Use overrides for the pieces a given test cares about.
export function createMockEnv(options: MockEnvOptions = {}): Env {
  const queue = options.MEMORY_QUEUE ?? createFakeQueue<MemoryQueueMessage>();

  return {
    // Required by Env but usually irrelevant for unit tests.
    MEMORY_DB: options.MEMORY_DB ?? createFakeD1Database(),
    CHAT_STATE: undefined as unknown as DurableObjectNamespace,
    MEDIA_BUCKET: undefined as unknown as R2Bucket,
    BROWSER: undefined as unknown as BrowserWorker,
    CACHE_KV: undefined as unknown as KVNamespace,
    METRICS: undefined as unknown as AnalyticsEngineDataset,

    API_TOKEN: options.API_TOKEN ?? "test-secure-token-12345",

    AI: options.AI ?? createFakeAi(),
    MEMORY_VECTORS: options.MEMORY_VECTORS ?? createFakeVectorizeIndex(),
    MEMORY_QUEUE: queue,
  } as unknown as Env;
}
