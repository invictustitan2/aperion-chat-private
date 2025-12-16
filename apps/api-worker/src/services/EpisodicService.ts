import { EpisodicRecord, MemoryProvenance } from "@aperion/memory-core";
import { MemoryWriteGate } from "@aperion/policy";
import { computeHash } from "@aperion/shared";
import { Env } from "../types";

export class EpisodicService {
  constructor(private env: Env) {}

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

    // 5. Store Record (Queue or Sync)
    let status = "written";
    if (this.env.MEMORY_QUEUE) {
      await this.env.MEMORY_QUEUE.send({
        type: "episodic",
        record: record,
      });
      status = "queued";
    } else {
      await this.env.MEMORY_DB.prepare(
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

    return { success: true, id: record.id, receipt, status };
  }

  async list(limit: number = 50, since: number = 0) {
    const { results } = await this.env.MEMORY_DB.prepare(
      "SELECT * FROM episodic WHERE created_at > ? ORDER BY created_at ASC LIMIT ?",
    )
      .bind(since, limit)
      .all();

    return results.map((r: Record<string, unknown>) => ({
      id: r.id,
      createdAt: r.created_at,
      content: r.content,
      hash: r.hash,
      provenance: JSON.parse(r.provenance as string),
    }));
  }

  async clear() {
    await this.env.MEMORY_DB.prepare("DELETE FROM episodic").run();
    return { success: true, message: "Episodic memory cleared" };
  }
}
