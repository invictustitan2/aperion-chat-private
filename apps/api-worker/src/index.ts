import {
  EpisodicRecord,
  SemanticRecord,
  IdentityRecord,
  MemoryProvenance,
} from "@aperion/memory-core";
import { MemoryWriteGate } from "@aperion/policy";
import { computeHash, hashRunbookTask } from "@aperion/shared";
import { AutoRouter, IRequest, error, json } from "itty-router";
import { errorHandler } from "./middleware/errorHandler";
import { bytesToBase64 } from "./lib/base64";

export interface Env {
  MEMORY_DB: D1Database;
  CACHE_KV: KVNamespace;
  API_TOKEN: string;
  GOOGLE_CLOUD_PROJECT_ID?: string;
  GOOGLE_APPLICATION_CREDENTIALS_JSON?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

// Helper to validate auth
const withAuth = (request: IRequest, env: Env) => {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !env.API_TOKEN) {
    return error(401, "Unauthorized: Missing credentials or server config");
  }

  const token = authHeader.replace("Bearer ", "");
  // Constant time comparison would be better, but for this scope simple check is ok
  if (token !== env.API_TOKEN) {
    return error(403, "Forbidden: Invalid credentials");
  }
};

const router = AutoRouter<IRequest, [Env, ExecutionContext]>();

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

  return json({ success: true, id: record.id, receipt });
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

  // Parse JSON fields
  const parsed = results.map((r: Record<string, unknown>) => ({
    ...r,
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

  // For now, voice-chat mirrors the existing "Operator Chat" behavior: it logs an episodic record.
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

  const assistantText =
    (await generateAssistantReply(userText, {
      GEMINI_API_KEY: env.GEMINI_API_KEY,
      GEMINI_MODEL: env.GEMINI_MODEL,
    })) || "";

  if (!assistantText.trim()) {
    return error(502, "LLM produced an empty response");
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

// Back-compat alias with the "expected prompt" naming.
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

  const receipt = MemoryWriteGate.shouldWriteSemantic(
    body,
    body.policyContext || {},
  );

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

  const record: SemanticRecord = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    type: "semantic",
    content: body.content,
    references: body.references,
    provenance: body.provenance as MemoryProvenance,
    hash: "",
    embedding: body.embedding,
  };
  record.hash = computeHash(record);

  try {
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return error(500, `Database error: ${msg}`);
  }

  return json({ success: true, id: record.id, receipt });
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

  const parsed = results.map((r: Record<string, unknown>) => ({
    ...r,
    value: JSON.parse(r.value as string),
    provenance: JSON.parse(r.provenance as string),
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

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    try {
      return await router.fetch(request as IRequest, env, ctx);
    } catch (err) {
      return errorHandler(err);
    }
  },
};
