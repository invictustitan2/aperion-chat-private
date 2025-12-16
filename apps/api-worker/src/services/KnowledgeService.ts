import { Env } from "../types";

export interface KnowledgeRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  content: string;
  sourceSemanticId?: string | null;
  tags: string[];
  metadata?: unknown;
}

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function deriveTitle(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Untitled";
  return trimmed.length <= 80 ? trimmed : `${trimmed.slice(0, 77)}…`;
}

export class KnowledgeService {
  constructor(private env: Env) {}

  async list(limit = 50, since = 0, q?: string): Promise<KnowledgeRecord[]> {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const safeSince = Number(since) || 0;

    const clauses: string[] = ["updated_at > ?"];
    const binds: unknown[] = [safeSince];

    if (q && q.trim()) {
      clauses.push("(LOWER(title) LIKE ? OR LOWER(content) LIKE ?)");
      const like = `%${q.trim().toLowerCase()}%`;
      binds.push(like, like);
    }

    const sql = `SELECT id, created_at, updated_at, title, content, source_semantic_id, tags, metadata
      FROM knowledge
      WHERE ${clauses.join(" AND ")}
      ORDER BY updated_at DESC
      LIMIT ?`;

    const { results } = await this.env.MEMORY_DB.prepare(sql)
      .bind(...binds, safeLimit)
      .all();

    return (results || []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
      title: String(r.title),
      content: String(r.content),
      sourceSemanticId: (r.source_semantic_id ?? null) as string | null,
      tags: safeJsonParse<string[]>(r.tags, []).filter(
        (t) => typeof t === "string",
      ),
      metadata: safeJsonParse<unknown>(r.metadata, undefined),
    }));
  }

  async promoteFromSemantic(semanticId: string): Promise<KnowledgeRecord> {
    if (!semanticId?.trim()) {
      throw new Error("Missing semanticId");
    }

    const semantic = await this.env.MEMORY_DB.prepare(
      "SELECT id, created_at, content, tags FROM semantic WHERE id = ?",
    )
      .bind(semanticId)
      .first<Record<string, unknown>>();

    if (!semantic) {
      throw new Error("Semantic record not found");
    }

    const existing = await this.env.MEMORY_DB.prepare(
      "SELECT id, created_at, updated_at, title, content, source_semantic_id, tags, metadata FROM knowledge WHERE source_semantic_id = ?",
    )
      .bind(semanticId)
      .first<Record<string, unknown>>();

    const now = Date.now();
    const content = String(semantic.content ?? "");
    const title = deriveTitle(content);
    const tags = safeJsonParse<string[]>(semantic.tags, []);

    if (existing) {
      await this.env.MEMORY_DB.prepare(
        "UPDATE knowledge SET updated_at = ?, title = ?, content = ?, tags = ? WHERE id = ?",
      )
        .bind(now, title, content, JSON.stringify(tags), String(existing.id))
        .run();

      return {
        id: String(existing.id),
        createdAt: Number(existing.created_at),
        updatedAt: now,
        title,
        content,
        sourceSemanticId: semanticId,
        tags,
        metadata: safeJsonParse<unknown>(existing.metadata, undefined),
      };
    }

    const id = crypto.randomUUID();

    await this.env.MEMORY_DB.prepare(
      "INSERT INTO knowledge (id, created_at, updated_at, title, content, source_semantic_id, tags, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        now,
        now,
        title,
        content,
        semanticId,
        JSON.stringify(tags),
        null,
      )
      .run();

    return {
      id,
      createdAt: now,
      updatedAt: now,
      title,
      content,
      sourceSemanticId: semanticId,
      tags,
    };
  }
}
