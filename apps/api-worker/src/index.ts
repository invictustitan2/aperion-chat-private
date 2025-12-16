import {
  EpisodicRecord,
  IdentityRecord,
  MemoryProvenance,
  SemanticRecord,
} from "@aperion/memory-core";
import { MemoryWriteGate } from "@aperion/policy";
import { computeHash, hashRunbookTask } from "@aperion/shared";
import { AutoRouter, IRequest, error, json } from "itty-router";
import {
  ChatMessage,
  generateChatCompletion,
  generateEmbedding,
} from "./lib/ai";
import { bytesToBase64 } from "./lib/base64";
import { cleanupLogs } from "./lib/janitor";

import { BrowserWorker } from "@cloudflare/puppeteer";
import { MemoryQueueMessage, processMemoryBatch } from "./lib/queue-processor";
import { errorHandler } from "./middleware/errorHandler";

export interface Env {
  MEMORY_DB: D1Database;
  MEMORY_VECTORS: VectorizeIndex;
  AI: Ai;
  MEMORY_QUEUE: Queue<MemoryQueueMessage>;
  MEDIA_BUCKET: R2Bucket;
  BROWSER: BrowserWorker;
  CACHE_KV: KVNamespace;
  API_TOKEN: string;
  GOOGLE_CLOUD_PROJECT_ID?: string;
  GOOGLE_APPLICATION_CREDENTIALS_JSON?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

// ... (Auth helper remains same)
// Helper to validate auth
const withAuth = (request: IRequest, env: Env) => {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !env.API_TOKEN) {
    return error(401, "Unauthorized: Missing credentials or server config");
  }

  const token = authHeader.replace("Bearer ", "");
  if (token !== env.API_TOKEN) {
    return error(403, "Forbidden: Invalid credentials");
  }
};

// --- CORS Middleware ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const router = AutoRouter<IRequest, [Env, ExecutionContext]>({
  // Add CORS headers to all responses
  finally: [
    (response: Response) => {
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    },
  ],
});

// Handle preflight OPTIONS requests
router.options("*", () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
});

// --- Chat Completion (AI Response) ---
const SYSTEM_PROMPT = `You are Aperion, a helpful and intelligent AI assistant. You are part of a memory-augmented chat system that remembers conversations. Be concise, friendly, and helpful. If you don't know something, say so.`;

router.post("/v1/chat", withAuth, async (request, env) => {
  const body = (await request.json()) as {
    message: string;
    history?: ChatMessage[];
  };

  if (!body.message) {
    return error(400, "Missing message");
  }

  try {
    // Build conversation context from history (if provided) + current message
    const messages: ChatMessage[] = [
      ...(body.history || []).slice(-10), // Last 10 messages for context
      { role: "user" as const, content: body.message },
    ];

    // Generate AI response using Workers AI
    const response = await generateChatCompletion(
      env.AI,
      messages,
      SYSTEM_PROMPT,
    );

    // Store the AI response in episodic memory
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    const provenance = JSON.stringify({
      source_type: "assistant",
      source_id: "aperion",
      timestamp,
      confidence: 1.0,
    });

    await env.MEMORY_DB.prepare(
      "INSERT INTO episodic (id, created_at, content, provenance, hash) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(id, timestamp, response, provenance, computeHash(response))
      .run();

    return json({
      id,
      response,
      timestamp,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return error(500, `Chat completion failed: ${msg}`);
  }
});

// ... (Episodic and Voice Chat remain same) ...
// --- Episodic ---

router.post("/v1/episodic", withAuth, async (request, env) => {
  const body = (await request.json()) as Partial<EpisodicRecord>;

  // 1. Validate Input Structure (Basic)
  if (!body.content || !body.provenance) {
    return error(400, "Missing content or provenance");
  }

  // 2. Policy Gate
  const receipt = MemoryWriteGate.shouldWriteEpisodic(body);

  // 3. Store Receipt
  // Store receipt synchronously for audit trail? Or queue it too?
  // For safety, let's keep receipt sync for now so client knows it was "Allowed"
  await env.MEMORY_DB.prepare(
    "INSERT INTO receipts (id, timestamp, decision, reason_codes, inputs_hash) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(
      crypto.randomUUID(),
      receipt.timestamp,
      receipt.decision,
      JSON.stringify(receipt.reasonCodes),
      receipt.inputsHash,
    )
    .run();

  if (receipt.decision !== "allow") {
    return error(403, `Policy denied: ${JSON.stringify(receipt.reasonCodes)}`);
  }

  // 4. Construct Record
  const record: EpisodicRecord = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    type: "episodic",
    content: body.content,
    provenance: body.provenance as MemoryProvenance,
    hash: "", // Computed below
    metadata: body.metadata,
  };
  record.hash = computeHash(record);

  // 5. Store Record
  // Send to Queue
  if (env.MEMORY_QUEUE) {
    await env.MEMORY_QUEUE.send({
      type: "episodic",
      record: record,
    });
    return json(
      { success: true, id: record.id, receipt, status: "queued" },
      { status: 202 },
    );
  } else {
    // Fallback sync write if queue not configured (dev/test)
    try {
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return error(500, `Database error: ${msg}`);
    }
    return json({ success: true, id: record.id, receipt, status: "written" });
  }
});

router.get("/v1/episodic", withAuth, async (request, env) => {
  const { limit, since } = request.query;
  const limitVal = parseInt((limit as string) || "50");
  const sinceVal = parseInt((since as string) || "0");

  const { results } = await env.MEMORY_DB.prepare(
    "SELECT * FROM episodic WHERE created_at > ? ORDER BY created_at ASC LIMIT ?",
  )
    .bind(sinceVal, limitVal)
    .all();

  // Parse JSON fields and transform snake_case to camelCase for frontend
  const parsed = results.map((r: Record<string, unknown>) => ({
    id: r.id,
    createdAt: r.created_at, // Transform to camelCase for frontend
    content: r.content,
    hash: r.hash,
    provenance: JSON.parse(r.provenance as string),
  }));

  return json(parsed);
});

// --- Voice Chat ---

async function handleVoiceChat(request: IRequest, env: Env) {
  // Note: request is already authenticated by `withAuth`.
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return error(
      400,
      "Expected multipart/form-data with an 'audio' file field",
    );
  }

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    return error(400, "Missing 'audio' file");
  }

  const { transcribeAudio } = await import("./lib/speechToText");
  const { synthesizeSpeech } = await import("./lib/textToSpeech");
  const { generateAssistantReply } = await import("./lib/gemini");

  const bytes = new Uint8Array(await audio.arrayBuffer());
  const userText = await transcribeAudio({ bytes }, false, {
    GOOGLE_APPLICATION_CREDENTIALS_JSON:
      env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
  });

  if (!userText.trim()) {
    return error(400, "Speech-to-text produced empty transcription");
  }

  // Record episodic
  const provenance: MemoryProvenance = {
    source_type: "user",
    source_id: "operator",
    timestamp: Date.now(),
    confidence: 1.0,
  };

  const receipt = MemoryWriteGate.shouldWriteEpisodic({
    content: userText,
    provenance,
  });

  await env.MEMORY_DB.prepare(
    "INSERT INTO receipts (id, timestamp, decision, reason_codes, inputs_hash) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(
      crypto.randomUUID(),
      receipt.timestamp,
      receipt.decision,
      JSON.stringify(receipt.reasonCodes),
      receipt.inputsHash,
    )
    .run();

  if (receipt.decision !== "allow") {
    return error(403, `Policy denied: ${JSON.stringify(receipt.reasonCodes)}`);
  }

  const record: EpisodicRecord = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    type: "episodic",
    content: userText,
    provenance,
    hash: "",
  };
  record.hash = computeHash(record);

  // Queue Write
  if (env.MEMORY_QUEUE) {
    await env.MEMORY_QUEUE.send({ type: "episodic", record });
  } else {
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

  const assistantText =
    (await generateAssistantReply(userText, {
      GEMINI_API_KEY: env.GEMINI_API_KEY,
      GEMINI_MODEL: env.GEMINI_MODEL,
    })) || "";

  if (!assistantText.trim()) {
    return error(52, "LLM produced an empty response");
  }
  const audioBytes = await synthesizeSpeech(assistantText, {
    GOOGLE_APPLICATION_CREDENTIALS_JSON:
      env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
  });

  return json({
    userText,
    assistantText,
    audio: bytesToBase64(audioBytes),
    episodicId: record.id,
  });
}

router.post("/v1/voice-chat", withAuth, async (request, env) => {
  return handleVoiceChat(request, env);
});

router.post("/api/voice-chat", withAuth, async (request, env) => {
  return handleVoiceChat(request, env);
});

// --- Semantic ---

router.post("/v1/semantic", withAuth, async (request, env) => {
  const body = (await request.json()) as Partial<SemanticRecord> & {
    policyContext?: Record<string, unknown>;
  };

  if (!body.content || !body.references || !body.provenance) {
    return error(400, "Missing content, references, or provenance");
  }

  // Extract policy flags from provenance (e.g., explicit_confirm from frontend)
  const prov = body.provenance as unknown as Record<string, unknown>;
  const policyContext = {
    ...body.policyContext,
    explicit_confirm: prov?.explicit_confirm ?? false,
  };

  const receipt = MemoryWriteGate.shouldWriteSemantic(body, policyContext);

  await env.MEMORY_DB.prepare(
    "INSERT INTO receipts (id, timestamp, decision, reason_codes, inputs_hash) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(
      crypto.randomUUID(),
      receipt.timestamp,
      receipt.decision,
      JSON.stringify(receipt.reasonCodes),
      receipt.inputsHash,
    )
    .run();

  if (receipt.decision !== "allow") {
    return error(
      403,
      `Policy denied/deferred: ${JSON.stringify(receipt.reasonCodes)}`,
    );
  }

  // Generate ID now so we can return it
  const record: SemanticRecord = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    type: "semantic",
    content: body.content,
    references: body.references,
    provenance: body.provenance as MemoryProvenance,
    hash: "",
    embedding: body.embedding, // Pass through if allowed, otherwise computed in queue
  };
  // We compute hash in consumer if embedding is missing, or here if present.
  // Actually, hash computation usually excludes dynamic fields or includes them?
  // Let's defer hash to processor if embedding is generated there.

  if (env.MEMORY_QUEUE) {
    await env.MEMORY_QUEUE.send({
      type: "semantic",
      record,
    });
    return json(
      { success: true, id: record.id, receipt, status: "queued" },
      { status: 202 },
    );
  } else {
    // Fallback Sync
    if (!record.embedding && env.AI) {
      record.embedding = await generateEmbedding(env.AI, record.content);
    }
    record.hash = computeHash(record);
    try {
      // 1. Store Content in D1
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

      // 2. Store Vector in Vectorize
      if (env.MEMORY_VECTORS && record.embedding) {
        await env.MEMORY_VECTORS.insert([
          {
            id: record.id,
            values: record.embedding,
            metadata: {
              // Store minimal metadata for filtering if needed
              type: "semantic",
              createdAt: record.createdAt,
            },
          },
        ]);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return error(500, `Database error: ${msg}`);
    }
    return json({ success: true, id: record.id, receipt, status: "written" });
  }
});

router.get("/v1/semantic/search", withAuth, async (request, env) => {
  const { query, limit } = request.query;
  if (!query) return error(400, "Missing query");

  const limitVal = parseInt((limit as string) || "5");

  // 1. Embed query
  if (!env.AI || !env.MEMORY_VECTORS) {
    return error(503, "AI/Vectorize not configured");
  }

  const embedding = await generateEmbedding(env.AI, query as string);

  // 2. Search Vectors
  const matches = await env.MEMORY_VECTORS.query(embedding, {
    topK: limitVal,
    returnMetadata: true,
  });

  // 3. Hydrate content from D1 (Optional, if we want full content)
  // For now, let's just return matches IDs and scores, or fetch if needed.
  // Let's fetch content for better UX.

  const ids = matches.matches.map((m) => m.id);
  if (ids.length === 0) return json([]);

  const placeholders = ids.map(() => "?").join(",");
  const { results } = await env.MEMORY_DB.prepare(
    `SELECT * FROM semantic WHERE id IN (${placeholders})`,
  )
    .bind(...ids)
    .all();

  // Merge scores and transform to camelCase
  const hydrated = results
    .map((r: Record<string, unknown>) => {
      const match = matches.matches.find((m) => m.id === r.id);
      return {
        id: r.id,
        createdAt: r.created_at, // Transform to camelCase
        content: r.content,
        embedding: r.embedding,
        hash: r.hash,
        score: match?.score || 0,
        provenance: JSON.parse(r.provenance as string),
        references: JSON.parse(r.references as string),
      };
    })
    .sort((a, b) => b.score - a.score);

  return json(hydrated);
});

// --- Media (R2) ---

router.put("/v1/media/:key", withAuth, async (request, env) => {
  if (!env.MEDIA_BUCKET) return error(503, "R2 not configured");
  const key = request.params.key;

  // Check allow-list or size limits if needed
  const object = await env.MEDIA_BUCKET.put(key, request.body);
  return json({ success: true, key: object?.key });
});

router.get("/v1/media/:key", withAuth, async (request, env) => {
  if (!env.MEDIA_BUCKET) return error(503, "R2 not configured");
  const key = request.params.key;

  const object = await env.MEDIA_BUCKET.get(key);
  if (!object) return error(404, "Not found");

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);

  return new Response(object.body, { headers });
});

// --- Identity ---

router.post("/v1/identity", withAuth, async (request, env) => {
  const body = (await request.json()) as Partial<IdentityRecord> & {
    explicit_confirm?: boolean;
  };

  if (!body.key || body.value === undefined || !body.provenance) {
    return error(400, "Missing key, value, or provenance");
  }

  const receipt = MemoryWriteGate.shouldWriteIdentity(body, {
    userConfirmation: body.explicit_confirm,
  });

  await env.MEMORY_DB.prepare(
    "INSERT INTO receipts (id, timestamp, decision, reason_codes, inputs_hash) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(
      crypto.randomUUID(),
      receipt.timestamp,
      receipt.decision,
      JSON.stringify(receipt.reasonCodes),
      receipt.inputsHash,
    )
    .run();

  if (receipt.decision !== "allow") {
    return error(403, `Policy denied: ${JSON.stringify(receipt.reasonCodes)}`);
  }

  const record: IdentityRecord = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    type: "identity",
    key: body.key,
    value: body.value,
    provenance: body.provenance as MemoryProvenance,
    hash: "",
    last_verified: Date.now(),
  };
  record.hash = computeHash(record);

  try {
    // Upsert for identity
    await env.MEMORY_DB.prepare(
      `INSERT INTO identity (key, id, created_at, value, provenance, hash, last_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
       id=excluded.id, created_at=excluded.created_at, value=excluded.value,
       provenance=excluded.provenance, hash=excluded.hash, last_verified=excluded.last_verified`,
    )
      .bind(
        record.key,
        record.id,
        record.createdAt,
        JSON.stringify(record.value),
        JSON.stringify(record.provenance),
        record.hash,
        record.last_verified,
      )
      .run();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return error(500, `Database error: ${msg}`);
  }

  return json({ success: true, id: record.id, receipt });
});

router.get("/v1/identity", withAuth, async (request, env) => {
  const { results } = await env.MEMORY_DB.prepare(
    "SELECT * FROM identity",
  ).all();

  // Transform snake_case to camelCase for frontend
  const parsed = results.map((r: Record<string, unknown>) => ({
    key: r.key,
    id: r.id,
    createdAt: r.created_at, // Transform to camelCase
    value: JSON.parse(r.value as string),
    provenance: JSON.parse(r.provenance as string),
    hash: r.hash,
    lastVerified: r.last_verified, // Transform to camelCase
  }));

  return json(parsed);
});

// --- Runbooks ---

router.post("/v1/runbooks/hash", withAuth, async (request) => {
  const text = await request.text();
  if (!text) return error(400, "Missing body");

  const taskId = hashRunbookTask(text);
  return json({ taskId });
});

// --- Receipts ---

router.get("/v1/receipts", withAuth, async (request, env) => {
  const { results } = await env.MEMORY_DB.prepare(
    "SELECT * FROM receipts ORDER BY timestamp DESC LIMIT 50",
  ).all();

  return json(
    results.map((r: Record<string, unknown>) => {
      let reasons = [];
      try {
        reasons = JSON.parse(r.reason_codes as string);
      } catch (e) {
        reasons = [r.reason_codes];
      }

      return {
        id: r.id,
        timestamp: r.timestamp,
        action: "memory_write",
        allowed: r.decision === "allow",
        reason: Array.isArray(reasons) ? reasons.join(", ") : reasons,
      };
    }),
  );
});

router.get("/api/dev/logs", withAuth, async (request, env) => {
  try {
    const { results } = await env.MEMORY_DB.prepare(
      "SELECT * FROM dev_logs ORDER BY timestamp DESC LIMIT 100",
    ).all();
    return json(results);
  } catch (e) {
    // If table doesn't exist yet or other error, return empty
    console.error(e);
    return json([]);
  }
});

router.post("/api/dev/logs/clear", withAuth, async (request, env) => {
  await env.MEMORY_DB.prepare("DELETE FROM dev_logs").run();
  return json({ success: true });
});

// --- Chat Export ---
import { renderChatToPdf } from "./lib/renderer";

router.get("/v1/chat/export", withAuth, async (_request, _env) => {
  // In a real app we'd fetch message history here.
  // For now receive it via POST or just demo text if mostly checking browser binding.
  // User wants "Export Chat".
  // Let's make it a POST so we can send the current client-side chat history to render.
  return error(405, "Use POST with HTML content");
});

router.post("/v1/chat/export", withAuth, async (request, env) => {
  const { html } = (await request.json()) as { html: string };
  if (!html) return error(400, "Missing html content");

  try {
    const pdf = await renderChatToPdf(html, env);

    return new Response(pdf.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="chat-export-${Date.now()}.pdf"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return error(500, `PDF Generation failed: ${msg}`);
  }
});

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    try {
      return await router.fetch(request as IRequest, env, ctx);
    } catch (err: unknown) {
      try {
        const message = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        ctx.waitUntil(
          env.MEMORY_DB.prepare(
            "INSERT INTO dev_logs (id, timestamp, level, message, stack_trace, source) VALUES (?, ?, ?, ?, ?, ?)",
          )
            .bind(
              crypto.randomUUID(),
              Date.now(),
              "ERROR",
              message,
              stack,
              "api-worker",
            )
            .run(),
        );
      } catch (logErr) {
        console.error("Failed to log error to DB", logErr);
      }

      return errorHandler(err);
    }
  },
  queue: async (batch: MessageBatch<MemoryQueueMessage>, env: Env) => {
    await processMemoryBatch(batch.messages, env);
  },
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(
      cleanupLogs(env).then((res) =>
        console.log(`Deleted ${res.deleted} logs`),
      ),
    );
  },
};
