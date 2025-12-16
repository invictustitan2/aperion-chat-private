import { IRequest, error, json } from "itty-router";
import { KnowledgePromoteSchema } from "../lib/schemas";
import { KnowledgeService } from "../services/KnowledgeService";
import { Env } from "../types";

export class KnowledgeController {
  static async list(request: IRequest, env: Env) {
    const limit = Number(
      (request.query as Record<string, string>)?.limit ?? 50,
    );
    const since = Number((request.query as Record<string, string>)?.since ?? 0);
    const q = (request.query as Record<string, string>)?.q;

    try {
      const service = new KnowledgeService(env);
      const items = await service.list(limit, since, q);
      return json(items);
    } catch (e: unknown) {
      return error(500, e instanceof Error ? e.message : String(e));
    }
  }

  static async promote(request: IRequest, env: Env) {
    const jsonBody = await request.json().catch(() => ({}));
    const parsed = KnowledgePromoteSchema.safeParse(jsonBody);
    if (!parsed.success) {
      return error(
        400,
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      );
    }

    try {
      const service = new KnowledgeService(env);
      const record = await service.promoteFromSemantic(parsed.data.semantic_id);
      return json({ success: true, record }, { status: 201 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/not found/i.test(msg)) return error(404, msg);
      if (/missing/i.test(msg)) return error(400, msg);
      return error(500, msg);
    }
  }
}
