import { IdentityRecord, MemoryProvenance } from "@aperion/memory-core";
import { MemoryWriteGate } from "@aperion/policy";
import { computeHash } from "@aperion/shared";
import { Env } from "../types";

export class IdentityService {
  constructor(private env: Env) {}

  async upsert(
    body: Partial<IdentityRecord> & {
      explicit_confirm?: boolean;
      preferred_tone?: string;
      memory_retention_days?: number;
      interface_theme?: string;
    },
  ) {
    if (!body.key || body.value === undefined || !body.provenance) {
      throw new Error("Missing key, value, or provenance");
    }

    const receipt = MemoryWriteGate.shouldWriteIdentity(body, {
      userConfirmation: body.explicit_confirm,
    });

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

    await this.env.MEMORY_DB.prepare(
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

    return { success: true, id: record.id, receipt };
  }

  async getAll() {
    const { results } = await this.env.MEMORY_DB.prepare(
      "SELECT * FROM identity",
    ).all();

    return results.map((r: Record<string, unknown>) => ({
      key: r.key,
      id: r.id,
      createdAt: r.created_at,
      value: JSON.parse(r.value as string),
      provenance: JSON.parse(r.provenance as string),
      hash: r.hash,
      lastVerified: r.last_verified,
      preferredTone: r.preferred_tone,
      memoryRetentionDays: r.memory_retention_days,
      interfaceTheme: r.interface_theme,
    }));
  }
}
