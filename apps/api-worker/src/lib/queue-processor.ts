import { EpisodicRecord, SemanticRecord } from "@aperion/memory-core";
import { computeHash } from "@aperion/shared";
import { Env } from "../index";
import { generateChatCompletion, generateEmbedding } from "./ai";

// Define the shape of messages sent to the queue
export type MemoryQueueMessage =
  | {
      type: "episodic";
      record: EpisodicRecord;
    }
  | {
      type: "semantic";
      record: SemanticRecord;
    }
  | {
      type: "summarize";
      jobId: string;
      contents: string[];
      query?: string;
    }
  | {
      type: "embed";
      jobId: string;
      content: string;
    };

export async function processMemoryBatch(
  messages: readonly Message<MemoryQueueMessage>[],
  env: Env,
): Promise<void> {
  for (const message of messages) {
    try {
      const { type } = message.body;

      if (type === "episodic") {
        await processEpisodic(message.body.record, env);
      } else if (type === "semantic") {
        await processSemantic(message.body.record, env);
      } else if (type === "summarize") {
        await processSummarize(message.body, env);
      } else if (type === "embed") {
        await processEmbed(message.body, env);
      } else {
        const bodyWithExtras = message.body as unknown as { type: string };
        console.warn(`Unknown message type: ${bodyWithExtras.type}`);
      }

      // Ack message if successful
      message.ack();
    } catch (e) {
      console.error(`Failed to process message ${message.id}:`, e);
      const body = message.body as { jobId: string };
      if (body.jobId) {
        await env.MEMORY_DB.prepare(
          "UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?",
        )
          .bind(String(e), Date.now(), body.jobId)
          .run()
          .catch(console.error);
        // For jobs, we mark as failed and don't retry locally to avoid loops. User can retry via API.
        message.ack();
      } else {
        // For data storage (episodic/semantic), we retry to ensure durability
        message.retry();
      }
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
      const start = performance.now();
      record.embedding = await generateEmbedding(env.AI, record.content);
      console.log(
        `Generated embedding for semantic record ${record.id} in ${(
          performance.now() - start
        ).toFixed(2)}ms`,
      );
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

async function processSummarize(
  job: { jobId: string; contents: string[]; query?: string },
  env: Env,
) {
  const { jobId, contents, query } = job;

  // 1. Mark Processing
  await env.MEMORY_DB.prepare(
    "UPDATE jobs SET status = 'processing', updated_at = ? WHERE id = ?",
  )
    .bind(Date.now(), jobId)
    .run();

  // 2. Generate Summary
  const combinedContent = contents.join("\n\n---\n\n");
  const prompt = query
    ? `Based on the following search results for "${query}", provide a concise summary of the key information:\n\n${combinedContent}`
    : `Summarize the following information concisely:\n\n${combinedContent}`;

  const response = await generateChatCompletion(
    env.AI,
    [{ role: "user", content: prompt }],
    "You are a helpful assistant that provides concise, accurate summaries.",
    "summarization",
  );

  // 3. Complete
  await env.MEMORY_DB.prepare(
    "UPDATE jobs SET status = 'completed', output = ?, updated_at = ? WHERE id = ?",
  )
    .bind(JSON.stringify({ summary: response }), Date.now(), jobId)
    .run();
}

async function processEmbed(job: { jobId: string; content: string }, env: Env) {
  const { jobId, content } = job;

  // 1. Mark Processing
  await env.MEMORY_DB.prepare(
    "UPDATE jobs SET status = 'processing', updated_at = ? WHERE id = ?",
  )
    .bind(Date.now(), jobId)
    .run();

  // 2. Generate
  const start = performance.now();
  const embedding = await generateEmbedding(env.AI, content);
  console.log(
    `Generated embedding for job ${jobId} in ${(
      performance.now() - start
    ).toFixed(2)}ms`,
  );

  // 3. Complete
  await env.MEMORY_DB.prepare(
    "UPDATE jobs SET status = 'completed', output = ?, updated_at = ? WHERE id = ?",
  )
    .bind(JSON.stringify({ embedding }), Date.now(), jobId)
    .run();
}
