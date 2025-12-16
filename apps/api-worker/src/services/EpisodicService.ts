import { EpisodicRecord, MemoryProvenance } from "@aperion/memory-core";
import { MemoryWriteGate } from "@aperion/policy";
import { computeHash } from "@aperion/shared";
import { Env } from "../types";
import { ConversationsService } from "./ConversationsService";

export class EpisodicService {
  constructor(private env: Env) {}

  private normalizeTags(tags: unknown): string[] {
    if (!Array.isArray(tags)) return [];

    const out: string[] = [];
    const seen = new Set<string>();

    for (const raw of tags) {
      const t = String(raw ?? "")
        .trim()
        .toLowerCase();
      if (!t) continue;
      if (t.length > 48) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
      if (out.length >= 25) break;
    }

    return out;
  }

  async create(body: Partial<EpisodicRecord>) {
    // 1. Validate Input Structure (Basic)
    if (!body.content || !body.provenance) {
      throw new Error("Missing content or provenance");
    }

    // 2. Policy Gate
    const receipt = MemoryWriteGate.shouldWriteEpisodic(body);

    // 3. Store Receipt
    await this.env.MEMORY_DB.prepare(
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
      throw new Error(`Policy denied: ${JSON.stringify(receipt.reasonCodes)}`);
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

    const conversationId = (body as unknown as { conversation_id?: string })
      .conversation_id;

    // 5. Store Record (Queue or Sync)
    let status = "written";
    if (this.env.MEMORY_QUEUE) {
      await this.env.MEMORY_QUEUE.send({
        type: "episodic",
        record: record as unknown as EpisodicRecord & {
          conversation_id?: string;
        },
        ...(conversationId ? { conversation_id: conversationId } : {}),
      });
      status = "queued";
    } else {
      await this.env.MEMORY_DB.prepare(
        "INSERT INTO episodic (id, created_at, content, provenance, hash, conversation_id) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(
          record.id,
          record.createdAt,
          record.content,
          JSON.stringify(record.provenance),
          record.hash,
          conversationId || null,
        )
        .run();
    }

    if (conversationId) {
      await new ConversationsService(this.env).touch(conversationId);
    }

    return { success: true, id: record.id, receipt, status };
  }

  async list(limit: number = 50, since: number = 0, conversationId?: string) {
    const { results } = await this.env.MEMORY_DB.prepare(
      conversationId
        ? "SELECT * FROM episodic WHERE conversation_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT ?"
        : "SELECT * FROM episodic WHERE created_at > ? ORDER BY created_at ASC LIMIT ?",
    )
      .bind(
        ...(conversationId ? [conversationId, since, limit] : [since, limit]),
      )
      .all();

    return results.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      createdAt: Number(r.created_at),
      type: "episodic" as const,
      content: String(r.content ?? ""),
      hash: String(r.hash ?? ""),
      provenance: JSON.parse(String(r.provenance ?? "{}")),
      conversation_id: r.conversation_id
        ? String(r.conversation_id)
        : undefined,
      tags: (() => {
        try {
          return this.normalizeTags(JSON.parse(String(r.tags ?? "[]")));
        } catch {
          return [];
        }
      })(),
      importance:
        r.importance === null || r.importance === undefined
          ? undefined
          : Number(r.importance),
    }));
  }

  async update(
    id: string,
    patch: { content?: string; tags?: string[]; importance?: number },
  ) {
    if (!id) throw new Error("Missing id");

    const hasAny =
      patch.content !== undefined ||
      patch.tags !== undefined ||
      patch.importance !== undefined;
    if (!hasAny) throw new Error("Missing update fields");

    const existing = await this.env.MEMORY_DB.prepare(
      "SELECT id, created_at, content, provenance, hash, tags, importance FROM episodic WHERE id = ?",
    )
      .bind(id)
      .first();

    if (!existing) throw new Error("Not found");

    const e = existing as Record<string, unknown>;
    const provenance = JSON.parse(String(e.provenance ?? "{}")) as {
      source_type?: string;
    };

    const updates: string[] = [];
    const binds: unknown[] = [];

    let nextHash: string | null = null;

    if (patch.content !== undefined) {
      const content = String(patch.content ?? "");
      if (!content) throw new Error("Missing content");
      if (String(provenance.source_type) !== "user") {
        throw new Error("Only user messages can be edited");
      }

      const recordForHash = {
        id: String(e.id),
        createdAt: Number(e.created_at),
        type: "episodic" as const,
        content,
        provenance,
      };
      nextHash = computeHash(recordForHash as unknown as EpisodicRecord);

      updates.push("content = ?");
      binds.push(content);

      updates.push("hash = ?");
      binds.push(nextHash);
    }

    if (patch.tags !== undefined) {
      const normalized = this.normalizeTags(patch.tags);
      updates.push("tags = ?");
      binds.push(JSON.stringify(normalized));
    }

    if (patch.importance !== undefined) {
      const imp = Number(patch.importance);
      if (Number.isNaN(imp)) throw new Error("Invalid importance");
      updates.push("importance = ?");
      binds.push(Math.min(Math.max(imp, 0), 1));
    }

    if (updates.length === 0) {
      return { success: true, id, status: "noop" };
    }

    await this.env.MEMORY_DB.prepare(
      `UPDATE episodic SET ${updates.join(", ")} WHERE id = ?`,
    )
      .bind(...binds, id)
      .run();

    return { success: true, id, status: "updated" };
  }

  async clear() {
    await this.env.MEMORY_DB.prepare("DELETE FROM episodic").run();
    return { success: true, message: "Episodic memory cleared" };
  }
}
