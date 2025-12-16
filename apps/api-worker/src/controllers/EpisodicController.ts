import { EpisodicRecord } from "@aperion/memory-core";
import { IRequest, error, json } from "itty-router";
import { EpisodicRequestSchema, EpisodicUpdateSchema } from "../lib/schemas";
import { EpisodicService } from "../services/EpisodicService";
import { Env } from "../types";

export class EpisodicController {
  static async create(request: IRequest, env: Env) {
    const jsonBody = await request.json();
    const parseResult = EpisodicRequestSchema.safeParse(jsonBody);

    if (!parseResult.success) {
      return error(
        400,
        `Invalid input: ${parseResult.error.issues.map((e) => e.message).join(", ")}`,
      );
    }

    const body = parseResult.data as Partial<EpisodicRecord>; // Schema matches structure, explicit cast helps service compatibility
    try {
      const service = new EpisodicService(env);
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

  static async list(request: IRequest, env: Env) {
    const { limit, since, conversation_id } = request.query;
    const limitVal = parseInt((limit as string) || "50");
    const sinceVal = parseInt((since as string) || "0");

    try {
      const service = new EpisodicService(env);
      const parsed = await service.list(
        limitVal,
        sinceVal,
        (conversation_id as string) || undefined,
      );

      const response = json(parsed);
      // Short cache for polling (5 seconds), private to user
      response.headers.set("Cache-Control", "private, max-age=5");
      return response;
    } catch (e: unknown) {
      return error(500, e instanceof Error ? e.message : String(e));
    }
  }

  static async update(request: IRequest, env: Env) {
    const { id } = request.params as { id?: string };
    if (!id) return error(400, "Missing id");

    const jsonBody = await request.json();
    const parseResult = EpisodicUpdateSchema.safeParse(jsonBody);

    if (!parseResult.success) {
      return error(
        400,
        `Invalid input: ${parseResult.error.issues.map((e) => e.message).join(", ")}`,
      );
    }

    try {
      const service = new EpisodicService(env);
      const result = await service.update(id, parseResult.data);
      return json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Not found")) return error(404, msg);
      if (msg.includes("Only user messages")) return error(403, msg);
      if (msg.includes("Missing")) return error(400, msg);
      return error(500, msg);
    }
  }

  static async delete(request: IRequest, env: Env) {
    const { confirm } = request.query;
    if (confirm !== "true") {
      return error(400, "Missing confirm=true query parameter");
    }

    try {
      const service = new EpisodicService(env);
      const result = await service.clear();
      return json(result);
    } catch (e) {
      return error(500, "Failed to clear memory");
    }
  }
}
