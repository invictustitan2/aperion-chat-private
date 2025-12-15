import { Ai } from "@cloudflare/workers-types";

export interface AiConfig {
  binding: Ai;
  embeddingModel: string;
}

export const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

/**
 * Generate an embedding for a given text using Workers AI
 */
export async function generateEmbedding(
  ai: Ai,
  text: string,
): Promise<number[]> {
  const response = await ai.run(EMBEDDING_MODEL, {
    text: [text],
  });

  // response is { shape: [1, 768], data: [[...]] } usually
  // The types for @cloudflare/workers-types AI run output can be generic
  // We expect { data: number[][] } for embeddings
  const data = (response as { data: number[][] }).data;
  if (!data || !data[0]) {
    throw new Error("Failed to generate embedding");
  }
  return data[0];
}
