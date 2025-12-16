import { SemanticRecord } from "@aperion/memory-core";
import { IRequest, error, json } from "itty-router";
import { SemanticRequestSchema, SemanticSummarizeSchema } from "../lib/schemas";
import { SemanticService } from "../services/SemanticService";
import { Env } from "../types";

export class SemanticController {
  static async create(request: IRequest, env: Env) {
    const jsonBody = await request.json();
    const parseResult = SemanticRequestSchema.safeParse(jsonBody);

    if (!parseResult.success) {
      return error(
        400,
        `Invalid input: ${parseResult.error.issues.map((e) => e.message).join(", ")}`,
      );
    }

    const body = parseResult.data as Partial<SemanticRecord> & {
      policyContext?: Record<string, unknown>;
    };
    try {
      const service = new SemanticService(env);
      const result = await service.create(body);
      const status = result.status === "queued" ? 202 : 200;
      return json(result, { status });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Policy denied")) return error(403, msg);
      if (msg.includes("Missing")) return error(400, msg);
      return error(500, msg);
    }
  }

  static async search(request: IRequest, env: Env) {
    const { query, limit } = request.query;
    if (!query) return error(400, "Missing query");

    try {
      const service = new SemanticService(env);
      const result = await service.search(
        query as string,
        parseInt((limit as string) || "5"),
      );
      return json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("not configured")) return error(503, msg);
      return error(500, msg);
    }
  }

  static async summarize(request: IRequest, env: Env) {
    const jsonBody = await request.json();
    const parseResult = SemanticSummarizeSchema.safeParse(jsonBody);

    if (!parseResult.success) {
      return error(
        400,
        `Invalid input: ${parseResult.error.issues.map((e) => e.message).join(", ")}`,
      );
    }

    const body = parseResult.data;

    try {
      const service = new SemanticService(env);
      const result = await service.summarize(body.contents, body.query);
      const status = result.status === "queued" ? 202 : 200;
      return json(result, { status });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("not configured")) return error(503, msg);
      return error(500, `Summarization failed: ${msg}`);
    }
  }

  /**
   * Hybrid search combining keyword and semantic search
   * GET /v1/semantic/hybrid?query=...&limit=10
   */
  static async hybridSearch(request: IRequest, env: Env) {
    const { query, limit } = request.query;

    if (!query) {
      return error(400, "Missing query parameter");
    }

    try {
      const service = new SemanticService(env);
      const result = await service.hybridSearch(
        query as string,
        parseInt((limit as string) || "10"),
      );
      return json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return error(500, msg);
    }
  }
}
