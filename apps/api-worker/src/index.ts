import { EpisodicRecord, SemanticRecord, IdentityRecord, MemoryProvenance } from '@aperion/memory-core';
import { MemoryWriteGate, Receipt } from '@aperion/policy';
import { computeHash, hashRunbookTask } from '@aperion/shared';
import { AutoRouter, IRequest, error, json } from 'itty-router';

export interface Env {
  MEMORY_DB: D1Database;
  CACHE_KV: KVNamespace;
  API_TOKEN: string;
}

// Helper to validate auth
const withAuth = (request: IRequest, env: Env) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !env.API_TOKEN) {
    return error(401, 'Unauthorized: Missing credentials or server config');
  }
  
  const token = authHeader.replace('Bearer ', '');
  // Constant time comparison would be better, but for this scope simple check is ok
  if (token !== env.API_TOKEN) {
    return error(403, 'Forbidden: Invalid credentials');
  }
};

const router = AutoRouter<IRequest, [Env, ExecutionContext]>();

// --- Episodic ---

router.post('/v1/episodic', withAuth, async (request, env) => {
  const body = await request.json() as Partial<EpisodicRecord>;
  
  // 1. Validate Input Structure (Basic)
  if (!body.content || !body.provenance) {
    return error(400, 'Missing content or provenance');
  }

  // 2. Policy Gate
  const receipt = MemoryWriteGate.shouldWriteEpisodic(body);
  
  // 3. Store Receipt
  await env.MEMORY_DB.prepare(
    'INSERT INTO receipts (id, timestamp, decision, reason_codes, inputs_hash) VALUES (?, ?, ?, ?, ?)'
  ).bind(
    crypto.randomUUID(),
    receipt.timestamp,
    receipt.decision,
    JSON.stringify(receipt.reasonCodes),
    receipt.inputsHash
  ).run();

  if (receipt.decision !== 'allow') {
    return error(403, `Policy denied: ${JSON.stringify(receipt.reasonCodes)}`);
  }

  // 4. Construct Record
  const record: EpisodicRecord = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    type: 'episodic',
    content: body.content,
    provenance: body.provenance as MemoryProvenance,
    hash: '', // Computed below
    metadata: body.metadata
  };
  record.hash = computeHash(record);

  // 5. Store Record
  try {
    await env.MEMORY_DB.prepare(
      'INSERT INTO episodic (id, created_at, content, provenance, hash) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      record.id,
      record.createdAt,
      record.content,
      JSON.stringify(record.provenance),
      record.hash
    ).run();
  } catch (e: any) {
    return error(500, `Database error: ${e.message}`);
  }

  return json({ success: true, id: record.id, receipt });
});

router.get('/v1/episodic', withAuth, async (request, env) => {
  const { limit, since } = request.query;
  const limitVal = parseInt((limit as string) || '50');
  const sinceVal = parseInt((since as string) || '0');

  const { results } = await env.MEMORY_DB.prepare(
    'SELECT * FROM episodic WHERE created_at > ? ORDER BY created_at ASC LIMIT ?'
  ).bind(sinceVal, limitVal).all();

  // Parse JSON fields
  const parsed = results.map((r: any) => ({
    ...r,
    provenance: JSON.parse(r.provenance)
  }));

  return json(parsed);
});

// --- Semantic ---

router.post('/v1/semantic', withAuth, async (request, env) => {
  const body = await request.json() as Partial<SemanticRecord> & { policyContext?: any };

  if (!body.content || !body.references || !body.provenance) {
    return error(400, 'Missing content, references, or provenance');
  }

  const receipt = MemoryWriteGate.shouldWriteSemantic(body, body.policyContext || {});

  await env.MEMORY_DB.prepare(
    'INSERT INTO receipts (id, timestamp, decision, reason_codes, inputs_hash) VALUES (?, ?, ?, ?, ?)'
  ).bind(
    crypto.randomUUID(),
    receipt.timestamp,
    receipt.decision,
    JSON.stringify(receipt.reasonCodes),
    receipt.inputsHash
  ).run();

  if (receipt.decision !== 'allow') {
    return error(403, `Policy denied/deferred: ${JSON.stringify(receipt.reasonCodes)}`);
  }

  const record: SemanticRecord = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    type: 'semantic',
    content: body.content,
    references: body.references,
    provenance: body.provenance as MemoryProvenance,
    hash: '',
    embedding: body.embedding
  };
  record.hash = computeHash(record);

  try {
    await env.MEMORY_DB.prepare(
      'INSERT INTO semantic (id, created_at, content, embedding, "references", provenance, hash) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      record.id,
      record.createdAt,
      record.content,
      JSON.stringify(record.embedding || []),
      JSON.stringify(record.references),
      JSON.stringify(record.provenance),
      record.hash
    ).run();
  } catch (e: any) {
    return error(500, `Database error: ${e.message}`);
  }

  return json({ success: true, id: record.id, receipt });
});

// --- Identity ---

router.post('/v1/identity', withAuth, async (request, env) => {
  const body = await request.json() as Partial<IdentityRecord> & { explicit_confirm?: boolean };

  if (!body.key || body.value === undefined || !body.provenance) {
    return error(400, 'Missing key, value, or provenance');
  }

  const receipt = MemoryWriteGate.shouldWriteIdentity(body, { userConfirmation: body.explicit_confirm });

  await env.MEMORY_DB.prepare(
    'INSERT INTO receipts (id, timestamp, decision, reason_codes, inputs_hash) VALUES (?, ?, ?, ?, ?)'
  ).bind(
    crypto.randomUUID(),
    receipt.timestamp,
    receipt.decision,
    JSON.stringify(receipt.reasonCodes),
    receipt.inputsHash
  ).run();

  if (receipt.decision !== 'allow') {
    return error(403, `Policy denied: ${JSON.stringify(receipt.reasonCodes)}`);
  }

  const record: IdentityRecord = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    type: 'identity',
    key: body.key,
    value: body.value,
    provenance: body.provenance as MemoryProvenance,
    hash: '',
    last_verified: Date.now()
  };
  record.hash = computeHash(record);

  try {
    // Upsert for identity
    await env.MEMORY_DB.prepare(
      `INSERT INTO identity (key, id, created_at, value, provenance, hash, last_verified) 
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
       id=excluded.id, created_at=excluded.created_at, value=excluded.value, 
       provenance=excluded.provenance, hash=excluded.hash, last_verified=excluded.last_verified`
    ).bind(
      record.key,
      record.id,
      record.createdAt,
      JSON.stringify(record.value),
      JSON.stringify(record.provenance),
      record.hash,
      record.last_verified
    ).run();
  } catch (e: any) {
    return error(500, `Database error: ${e.message}`);
  }

  return json({ success: true, id: record.id, receipt });
});

router.get('/v1/identity', withAuth, async (request, env) => {
  const { results } = await env.MEMORY_DB.prepare(
    'SELECT * FROM identity'
  ).all();

  const parsed = results.map((r: any) => ({
    ...r,
    value: JSON.parse(r.value),
    provenance: JSON.parse(r.provenance)
  }));

  return json(parsed);
});

// --- Runbooks ---

router.post('/v1/runbooks/hash', withAuth, async (request) => {
  const text = await request.text();
  if (!text) return error(400, 'Missing body');
  
  const taskId = hashRunbookTask(text);
  return json({ taskId });
});

export default {
  fetch: router.fetch
};
