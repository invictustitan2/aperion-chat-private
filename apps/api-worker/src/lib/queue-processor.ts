import { EpisodicRecord, SemanticRecord } from "@aperion/memory-core";
import { computeHash } from "@aperion/shared";
import { Env } from "../index";
import { generateEmbedding } from "./ai";

// Define the shape of messages sent to the queue
export type MemoryQueueMessage =
  | {
      type: "episodic";
      record: EpisodicRecord;
    }
  | {
      type: "semantic";
      record: SemanticRecord;
    };

export async function processMemoryBatch(
  messages: readonly Message<MemoryQueueMessage>[],
  env: Env,
): Promise<void> {
  for (const message of messages) {
    try {
      const { type, record } = message.body;

      if (type === "episodic") {
        await processEpisodic(record as EpisodicRecord, env);
      } else if (type === "semantic") {
        await processSemantic(record as SemanticRecord, env);
      } else {
        const bodyWithExtras = message.body as unknown as { type: string };
        console.warn(`Unknown message type: ${bodyWithExtras.type}`);
      }

      // Ack message if successful
      message.ack();
    } catch (e) {
      console.error(`Failed to process message ${message.id}:`, e);
      // Retry message
      message.retry();
    }
  }
}

async function processEpisodic(record: EpisodicRecord, env: Env) {
  // Hash should already be computed by the producer, but we can re-verify or compute if missing
  if (!record.hash) {
    record.hash = computeHash(record);
  }

  await env.MEMORY_DB.prepare(
    "INSERT INTO episodic (id, created_at, content, provenance, hash) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(
      record.id,
      record.createdAt,
      record.content,
      JSON.stringify(record.provenance),
      record.hash,
    )
    .run();
}

async function processSemantic(record: SemanticRecord, env: Env) {
  // 1. Generate Embedding if missing
  if ((!record.embedding || record.embedding.length === 0) && env.AI) {
    try {
      record.embedding = await generateEmbedding(env.AI, record.content);
    } catch (e) {
      console.error("Failed to generate embedding in queue processor", e);
      throw e; // Retry the message
    }
  }

  if (!record.hash) {
    record.hash = computeHash(record);
  }

  // 2. Store Content in D1
  await env.MEMORY_DB.prepare(
    'INSERT INTO semantic (id, created_at, content, embedding, "references", provenance, hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      record.id,
      record.createdAt,
      record.content,
      JSON.stringify(record.embedding || []),
      JSON.stringify(record.references),
      JSON.stringify(record.provenance),
      record.hash,
    )
    .run();

  // 3. Store Vector in Vectorize
  if (env.MEMORY_VECTORS && record.embedding) {
    await env.MEMORY_VECTORS.insert([
      {
        id: record.id,
        values: record.embedding,
        metadata: {
          type: "semantic",
          createdAt: record.createdAt,
          // Could add more metadata for filtering
        },
      },
    ]);
  }
}
