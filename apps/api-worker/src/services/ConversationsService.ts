import { Env } from "../types";

export interface ConversationRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  metadata?: unknown;
}

export class ConversationsService {
  constructor(private env: Env) {}

  async list(limit = 50, since = 0): Promise<ConversationRecord[]> {
    const { results } = await this.env.MEMORY_DB.prepare(
      "SELECT id, title, created_at, updated_at, metadata FROM conversations WHERE updated_at > ? ORDER BY updated_at DESC LIMIT ?",
    )
      .bind(since, limit)
      .all();

    return results.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      title: String(r.title),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
      metadata: r.metadata ? JSON.parse(String(r.metadata)) : undefined,
    }));
  }

  async create(title?: string): Promise<ConversationRecord> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const safeTitle =
      (title || "New Conversation").trim() || "New Conversation";

    await this.env.MEMORY_DB.prepare(
      "INSERT INTO conversations (id, title, created_at, updated_at, metadata) VALUES (?, ?, ?, ?, ?) ",
    )
      .bind(id, safeTitle, now, now, null)
      .run();

    return { id, title: safeTitle, createdAt: now, updatedAt: now };
  }

  async rename(
    id: string,
    title: string,
  ): Promise<{ success: true; id: string; title: string }> {
    if (!id) throw new Error("Missing id");
    const safeTitle = title.trim();
    if (!safeTitle) throw new Error("Missing title");

    const now = Date.now();
    const res = await this.env.MEMORY_DB.prepare(
      "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
    )
      .bind(safeTitle, now, id)
      .run();

    if (
      (res as unknown as { meta?: { changes?: number } }).meta?.changes === 0
    ) {
      throw new Error("Not found");
    }

    return { success: true, id, title: safeTitle };
  }

  async touch(id: string, at: number = Date.now()): Promise<void> {
    if (!id) return;
    await this.env.MEMORY_DB.prepare(
      "UPDATE conversations SET updated_at = ? WHERE id = ?",
    )
      .bind(at, id)
      .run();
  }

  async delete(id: string): Promise<{ success: true; id: string }> {
    if (!id) throw new Error("Missing id");

    await this.env.MEMORY_DB.prepare(
      "UPDATE episodic SET conversation_id = NULL WHERE conversation_id = ?",
    )
      .bind(id)
      .run();

    const res = await this.env.MEMORY_DB.prepare(
      "DELETE FROM conversations WHERE id = ?",
    )
      .bind(id)
      .run();

    if (
      (res as unknown as { meta?: { changes?: number } }).meta?.changes === 0
    ) {
      throw new Error("Not found");
    }

    return { success: true, id };
  }
}
