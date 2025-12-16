import { Env } from "../types";

export type RelationshipKind = "episodic" | "semantic" | "knowledge" | "policy";

export type RelationshipType =
  | "EVIDENCE_FOR"
  | "INTERPRETS"
  | "REFINES"
  | "CONFLICTS_WITH"
  | "SUPERSEDES";

export interface RelationshipRecord {
  id: string;
  createdAt: number;
  createdBy: "user" | "system";
  type: RelationshipType;
  fromKind: RelationshipKind;
  fromId: string;
  toKind: RelationshipKind;
  toId: string;
  rationale: string;
  confidence?: number | null;
  evidence?: string[];

  // Convenience fields for UI (may be null if not resolvable)
  fromContent?: string | null;
  toContent?: string | null;
}

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

async function memoryExists(env: Env, kind: RelationshipKind, id: string) {
  if (kind === "episodic") {
    const row = await env.MEMORY_DB.prepare(
      "SELECT id FROM episodic WHERE id = ?",
    )
      .bind(id)
      .first();
    return !!row;
  }
  if (kind === "semantic") {
    const row = await env.MEMORY_DB.prepare(
      "SELECT id FROM semantic WHERE id = ?",
    )
      .bind(id)
      .first();
    return !!row;
  }

  // 'knowledge' + 'policy' are allowed for forward-compat, but not yet fully supported.
  return false;
}

export class RelationshipsService {
  constructor(private env: Env) {}

  async listForNode(opts: {
    kind: RelationshipKind;
    id: string;
    limit?: number;
    since?: number;
  }): Promise<RelationshipRecord[]> {
    const kind = opts.kind;
    const id = opts.id;
    const limit = Math.max(1, Math.min(200, Number(opts.limit) || 50));
    const since = Number(opts.since) || 0;

    const { results } = await this.env.MEMORY_DB.prepare(
      `SELECT
        id,
        created_at,
        created_by,
        type,
        from_kind,
        from_id,
        to_kind,
        to_id,
        rationale,
        confidence,
        evidence,

        CASE
          WHEN from_kind = 'episodic' THEN (SELECT content FROM episodic WHERE episodic.id = relationships.from_id)
          WHEN from_kind = 'semantic' THEN (SELECT content FROM semantic WHERE semantic.id = relationships.from_id)
          ELSE NULL
        END AS from_content,

        CASE
          WHEN to_kind = 'episodic' THEN (SELECT content FROM episodic WHERE episodic.id = relationships.to_id)
          WHEN to_kind = 'semantic' THEN (SELECT content FROM semantic WHERE semantic.id = relationships.to_id)
          ELSE NULL
        END AS to_content

      FROM relationships
      WHERE created_at > ?
        AND (
          (from_kind = ? AND from_id = ?)
          OR
          (to_kind = ? AND to_id = ?)
        )
      ORDER BY created_at DESC
      LIMIT ?`,
    )
      .bind(since, kind, id, kind, id, limit)
      .all();

    return (results || []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      createdAt: Number(r.created_at),
      createdBy: (String(r.created_by) as "user" | "system") || "system",
      type: String(r.type) as RelationshipType,
      fromKind: String(r.from_kind) as RelationshipKind,
      fromId: String(r.from_id),
      toKind: String(r.to_kind) as RelationshipKind,
      toId: String(r.to_id),
      rationale: String(r.rationale ?? ""),
      confidence:
        r.confidence === null || r.confidence === undefined
          ? null
          : Number(r.confidence),
      evidence: safeJsonParse<string[]>(r.evidence, []),
      fromContent: r.from_content ? String(r.from_content) : null,
      toContent: r.to_content ? String(r.to_content) : null,
    }));
  }

  async create(input: {
    type: RelationshipType;
    fromKind: RelationshipKind;
    fromId: string;
    toKind: RelationshipKind;
    toId: string;
    rationale: string;
    createdBy?: "user" | "system";
    confidence?: number;
    evidence?: string[];
  }): Promise<RelationshipRecord> {
    const fromId = input.fromId?.trim();
    const toId = input.toId?.trim();
    if (!fromId) throw new Error("Missing fromId");
    if (!toId) throw new Error("Missing toId");
    if (fromId === toId && input.fromKind === input.toKind) {
      throw new Error("Self-relationships are not allowed");
    }

    const rationale = input.rationale?.trim();
    if (!rationale) throw new Error("Missing rationale");

    const createdBy = input.createdBy ?? "user";
    const now = Date.now();
    const id = crypto.randomUUID();

    // Verify references for supported kinds.
    if (!(await memoryExists(this.env, input.fromKind, fromId))) {
      throw new Error(`from memory not found (${input.fromKind}:${fromId})`);
    }
    if (!(await memoryExists(this.env, input.toKind, toId))) {
      throw new Error(`to memory not found (${input.toKind}:${toId})`);
    }

    const confidence =
      input.confidence === undefined || input.confidence === null
        ? null
        : Math.max(0, Math.min(1, Number(input.confidence)));

    const evidence = Array.isArray(input.evidence)
      ? input.evidence
          .map((x) => String(x))
          .filter(Boolean)
          .slice(0, 50)
      : [];

    try {
      await this.env.MEMORY_DB.prepare(
        "INSERT INTO relationships (id, created_at, created_by, type, from_kind, from_id, to_kind, to_id, rationale, confidence, evidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          id,
          now,
          createdBy,
          input.type,
          input.fromKind,
          fromId,
          input.toKind,
          toId,
          rationale,
          confidence,
          evidence.length ? JSON.stringify(evidence) : null,
        )
        .run();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/unique/i.test(msg) || /constraint/i.test(msg)) {
        throw new Error("Relationship already exists");
      }
      throw e instanceof Error ? e : new Error(msg);
    }

    // Return with resolved content.
    const rows = await this.listForNode({
      kind: input.fromKind,
      id: fromId,
      limit: 5,
      since: now - 1,
    });
    const created = rows.find((r) => r.id === id);
    if (created) return created;

    return {
      id,
      createdAt: now,
      createdBy,
      type: input.type,
      fromKind: input.fromKind,
      fromId,
      toKind: input.toKind,
      toId,
      rationale,
      confidence,
      evidence,
    };
  }
}
