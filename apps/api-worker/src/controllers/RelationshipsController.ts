import { IRequest, error, json } from "itty-router";
import {
  RelationshipCreateSchema,
  RelationshipListQuerySchema,
} from "../lib/schemas";
import { RelationshipsService } from "../services/RelationshipsService";
import { Env } from "../types";

export class RelationshipsController {
  static async list(request: IRequest, env: Env) {
    const parsed = RelationshipListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return error(
        400,
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      );
    }

    try {
      const service = new RelationshipsService(env);
      const rows = await service.listForNode({
        kind: parsed.data.kind,
        id: parsed.data.id,
        limit: parsed.data.limit,
        since: parsed.data.since,
      });
      return json(rows);
    } catch (e: unknown) {
      return error(500, e instanceof Error ? e.message : String(e));
    }
  }

  static async create(request: IRequest, env: Env) {
    const body = await request.json().catch(() => ({}));
    const parsed = RelationshipCreateSchema.safeParse(body);
    if (!parsed.success) {
      return error(
        400,
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      );
    }

    try {
      const service = new RelationshipsService(env);
      const created = await service.create({
        type: parsed.data.type,
        fromKind: parsed.data.from_kind,
        fromId: parsed.data.from_id,
        toKind: parsed.data.to_kind,
        toId: parsed.data.to_id,
        rationale: parsed.data.rationale,
        createdBy: parsed.data.created_by,
        confidence: parsed.data.confidence,
        evidence: parsed.data.evidence,
      });
      return json({ success: true, relationship: created }, { status: 201 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/not found/i.test(msg)) return error(404, msg);
      if (/missing/i.test(msg)) return error(400, msg);
      if (/already exists/i.test(msg)) return error(409, msg);
      return error(500, msg);
    }
  }
}
