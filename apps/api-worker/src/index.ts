// Trigger deployment final verify
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

// --- Authentication Middleware ---
// Helper to validate auth with enhanced logging and validation
const withAuth = (request: IRequest, env: Env) => {
  const authHeader = request.headers.get("Authorization");

  // Check if auth header exists
  if (!authHeader) {
    console.warn("Authentication failed: Missing Authorization header", {
      url: request.url,
      method: request.method,
    });
    return error(401, "Unauthorized: Missing Authorization header");
  }

  // Check if API_TOKEN is configured
  if (!env.API_TOKEN) {
    console.error("Authentication failed: API_TOKEN not configured in Worker");
    return error(401, "Unauthorized: Server authentication not configured");
  }

  // Validate Bearer scheme
  if (!authHeader.startsWith("Bearer ")) {
    console.warn("Authentication failed: Invalid Authorization scheme", {
      url: request.url,
      scheme: authHeader.split(" ")[0],
    });
    return error(
      401,
      "Unauthorized: Invalid authentication scheme. Use 'Bearer <token>'",
    );
  }

  // Extract and validate token
  const token = authHeader.replace("Bearer ", "");
  if (!token || token.trim() === "") {
    console.warn("Authentication failed: Empty token", {
      url: request.url,
    });
    return error(401, "Unauthorized: Empty authentication token");
  }

  if (token !== env.API_TOKEN) {
    console.warn("Authentication failed: Invalid token", {
      url: request.url,
      tokenPrefix: token.substring(0, 8) + "...",
    });
    return error(403, "Forbidden: Invalid credentials");
  }

  // Authentication successful - no return means continue
};

// --- CORS Middleware ---
// Environment-aware CORS configuration for security
function getCorsHeaders(request: IRequest): Record<string, string> {
  const origin = request.headers.get("Origin") || "";

  // Allowed origins based on environment
  const allowedOrigins = [
    "http://localhost:5173", // Local Vite dev server
    "http://127.0.0.1:5173", // Local Vite dev server (IP)
    "https://chat.aperion.cc", // Production frontend
  ];

  // Also allow Cloudflare Pages preview deployments
  const isPreviewDeploy = origin.endsWith(".pages.dev");

  // Determine if origin is allowed
  const isAllowed = allowedOrigins.includes(origin) || isPreviewDeploy;

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[2], // Default to production
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
    "Access-Control-Allow-Credentials": "true",
  };
}

const router = AutoRouter<IRequest, [Env, ExecutionContext]>({
  // Add CORS headers to all responses
  finally: [
    (response: Response, request: IRequest) => {
      const corsHeaders = getCorsHeaders(request);
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
router.options("*", (request) => {
  const corsHeaders = getCorsHeaders(request);
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
    // Fetch user preferences
    const prefResult = await env.MEMORY_DB.prepare(
      "SELECT preferred_tone FROM identity WHERE key = 'user_preferences'",
    ).first<{ preferred_tone: string }>();

    let systemPrompt = SYSTEM_PROMPT;
    if (prefResult?.preferred_tone) {
      systemPrompt += `\n\nYour preferred tone is: ${prefResult.preferred_tone}. Adjust your responses accordingly.`;
    }

    // Build conversation context from history (if provided) + current message
    const messages: ChatMessage[] = [
      ...(body.history || []).slice(-10), // Last 10 messages for context
      { role: "user" as const, content: body.message },
    ];

    // Generate AI response using Workers AI
    const response = await generateChatCompletion(
      env.AI,
      messages,
      systemPrompt,
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

router.delete("/v1/episodic", withAuth, async (request, env) => {
  const { confirm } = request.query;
  if (confirm !== "true") {
    return error(400, "Missing confirm=true query parameter");
  }

  try {
    await env.MEMORY_DB.prepare("DELETE FROM episodic").run();
    return json({ success: true, message: "Episodic memory cleared" });
  } catch (e) {
    return error(500, "Failed to clear memory");
  }
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

  const bytes = new Uint8Array(await audio.arrayBuffer());
  let userText = "";

  // Use Workers AI Whisper for speech-to-text (preferred)
  if (env.AI) {
    const { transcribeWithWhisper } = await import("./lib/workersAiStt");
    userText = await transcribeWithWhisper(env.AI, bytes);
  } else {
    // Fallback to Google Cloud STT
    const { transcribeAudio } = await import("./lib/speechToText");
    userText = await transcribeAudio({ bytes }, false, {
      GOOGLE_APPLICATION_CREDENTIALS_JSON:
        env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    });
  }

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

  // Generate response using Workers AI (preferred) or Gemini (fallback)
  let assistantText = "";
  if (env.AI) {
    assistantText =
      (await generateChatCompletion(
        env.AI,
        [{ role: "user", content: userText }],
        "You are a helpful voice assistant. Provide concise, clear responses suitable for speech output.",
        "chat",
      )) || "";
  } else {
    const { generateAssistantReply } = await import("./lib/gemini");
    assistantText =
      (await generateAssistantReply(userText, {
        GEMINI_API_KEY: env.GEMINI_API_KEY,
        GEMINI_MODEL: env.GEMINI_MODEL,
      })) || "";
  }

  if (!assistantText.trim()) {
    return error(502, "LLM produced an empty response");
  }

  // Text-to-Speech: Use Google TTS (Workers AI doesn't have TTS yet)
  // Return text for client-side Web Speech API synthesis as alternative
  let audioBase64 = "";
  let useFrontendTts = true;

  if (env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
      const { synthesizeSpeech } = await import("./lib/textToSpeech");
      const audioBytes = await synthesizeSpeech(assistantText, {
        GOOGLE_APPLICATION_CREDENTIALS_JSON:
          env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
      });
      if (audioBytes.length > 0) {
        audioBase64 = bytesToBase64(audioBytes);
        useFrontendTts = false;
      }
    } catch (e) {
      console.error("TTS failed, falling back to frontend synthesis:", e);
    }
  }

  return json({
    userText,
    assistantText,
    audio: audioBase64,
    episodicId: record.id,
    useFrontendTts, // Tells frontend to use Web Speech API if true
    source: env.AI ? "workers-ai" : "gemini",
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

  const start = performance.now();
  const embedding = await generateEmbedding(env.AI, query as string);
  console.log(
    `Generated query embedding in ${(performance.now() - start).toFixed(2)}ms`,
  );

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

// Summarize semantic search results using Workers AI
router.post("/v1/semantic/summarize", withAuth, async (request, env) => {
  const body = (await request.json()) as {
    contents: string[];
    query?: string;
  };

  if (!body.contents || body.contents.length === 0) {
    return error(400, "Missing contents array");
  }

  // If Queue is configured, offload
  if (env.MEMORY_QUEUE) {
    const jobId = crypto.randomUUID();
    const now = Date.now();

    try {
      // 1. Create Job Record
      await env.MEMORY_DB.prepare(
        "INSERT INTO jobs (id, type, status, created_at, updated_at, input) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(
          jobId,
          "summarize",
          "queued",
          now,
          now,
          JSON.stringify(body), // Store input for debugging
        )
        .run();

      // 2. Enqueue
      await env.MEMORY_QUEUE.send({
        type: "summarize",
        jobId,
        contents: body.contents,
        query: body.query,
      });

      return json({ success: true, jobId, status: "queued" }, { status: 202 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return error(500, `Failed to enqueue summarization: ${msg}`);
    }
  }

  // Fallback Sync
  if (!env.AI) {
    return error(503, "Workers AI not configured");
  }

  // Use the summarization task type for cost-effective processing
  const combinedContent = body.contents.join("\n\n---\n\n");
  const prompt = body.query
    ? `Based on the following search results for "${body.query}", provide a concise summary of the key information:\n\n${combinedContent}`
    : `Summarize the following information concisely:\n\n${combinedContent}`;

  try {
    const response = await generateChatCompletion(
      env.AI,
      [{ role: "user", content: prompt }],
      "You are a helpful assistant that provides concise, accurate summaries. Focus on the most relevant information and key points.",
      "summarization",
    );

    return json({ summary: response });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return error(500, `Summarization failed: ${msg}`);
  }
});

router.get("/v1/jobs/:id", withAuth, async (request, env) => {
  const jobId = request.params.id;
  const job = await env.MEMORY_DB.prepare("SELECT * FROM jobs WHERE id = ?")
    .bind(jobId)
    .first();

  if (!job) {
    return error(404, "Job not found");
  }

  // Parse JSON fields
  let result = null;
  if (job.output) {
    try {
      result = JSON.parse(job.output as string);
    } catch {
      result = job.output;
    }
  }

  return json({
    id: job.id,
    type: job.type,
    status: job.status,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    result,
    error: job.error,
  });
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
    preferred_tone?: string;
    memory_retention_days?: number;
    interface_theme?: string;
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

  const record: IdentityRecord & {
    preferred_tone?: string;
    memory_retention_days?: number;
    interface_theme?: string;
  } = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    type: "identity",
    key: body.key,
    value: body.value,
    provenance: body.provenance as MemoryProvenance,
    hash: "",
    last_verified: Date.now(),
    preferred_tone: body.preferred_tone,
    memory_retention_days: body.memory_retention_days,
    interface_theme: body.interface_theme,
  };
  record.hash = computeHash(record);

  try {
    // Upsert for identity including preferences
    await env.MEMORY_DB.prepare(
      `INSERT INTO identity (key, id, created_at, value, provenance, hash, last_verified, preferred_tone, memory_retention_days, interface_theme)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
       id=excluded.id, created_at=excluded.created_at, value=excluded.value,
       provenance=excluded.provenance, hash=excluded.hash, last_verified=excluded.last_verified,
       preferred_tone=excluded.preferred_tone, memory_retention_days=excluded.memory_retention_days, interface_theme=excluded.interface_theme`,
    )
      .bind(
        record.key,
        record.id,
        record.createdAt,
        JSON.stringify(record.value),
        JSON.stringify(record.provenance),
        record.hash,
        record.last_verified,
        record.preferred_tone || null,
        record.memory_retention_days || null,
        record.interface_theme || null,
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
    preferredTone: r.preferred_tone,
    memoryRetentionDays: r.memory_retention_days,
    interfaceTheme: r.interface_theme,
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
      // Log to console (Workers Observability)
      console.error("Unhandled error:", err);
      // Fallback to basic error handler if needed, or simple response
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
