export type VectorStoreInsertItem = {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
};

export type VectorStoreQueryOptions = {
  topK: number;
  returnMetadata?: boolean;
};

export type VectorStoreQueryMatch = {
  id: string;
  score?: number;
  metadata?: Record<string, unknown>;
};

export type VectorStoreQueryResult = {
  matches: VectorStoreQueryMatch[];
};

export interface VectorStore {
  insert(items: VectorStoreInsertItem[]): Promise<void>;
  query(
    embedding: number[],
    options: VectorStoreQueryOptions,
  ): Promise<VectorStoreQueryResult>;
}

type VectorizeBinding = {
  insert: (items: VectorStoreInsertItem[]) => Promise<unknown>;
  query: (
    embedding: number[],
    options: VectorStoreQueryOptions,
  ) => Promise<VectorStoreQueryResult>;
};

function getStringEnvValue(env: unknown, key: string): string | undefined {
  const value = (env as Record<string, unknown> | null | undefined)?.[key];
  return typeof value === "string" ? value : undefined;
}

export function isTestEnv(env: unknown): boolean {
  const mode =
    getStringEnvValue(env, "APERION_ENV") ??
    getStringEnvValue(env, "ENVIRONMENT") ??
    getStringEnvValue(env, "NODE_ENV");

  return mode === "test";
}

class NullVectorStore implements VectorStore {
  async insert(_: VectorStoreInsertItem[]): Promise<void> {
    // no-op
  }

  async query(
    _: number[],
    __: VectorStoreQueryOptions,
  ): Promise<VectorStoreQueryResult> {
    return { matches: [] };
  }
}

class VectorizeVectorStore implements VectorStore {
  constructor(private binding: VectorizeBinding) {}

  async insert(items: VectorStoreInsertItem[]): Promise<void> {
    await this.binding.insert(items);
  }

  async query(
    embedding: number[],
    options: VectorStoreQueryOptions,
  ): Promise<VectorStoreQueryResult> {
    return this.binding.query(embedding, options);
  }
}

export function getVectorStore(env: unknown): VectorStore {
  if (isTestEnv(env)) return new NullVectorStore();

  const binding = (
    env as { MEMORY_VECTORS?: VectorizeBinding } | null | undefined
  )?.MEMORY_VECTORS;

  if (!binding) return new NullVectorStore();
  return new VectorizeVectorStore(binding);
}
