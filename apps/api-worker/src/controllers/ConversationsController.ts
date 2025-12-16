import { IRequest, error, json } from "itty-router";
import { z } from "zod";
import { ConversationsService } from "../services/ConversationsService";
import { Env } from "../types";

const CreateConversationSchema = z.object({
  title: z.string().optional(),
});

const RenameConversationSchema = z.object({
  title: z.string().min(1),
});

export class ConversationsController {
  static async list(request: IRequest, env: Env) {
    const { limit, since } = request.query;
    const limitVal = parseInt((limit as string) || "50");
    const sinceVal = parseInt((since as string) || "0");

    try {
      const service = new ConversationsService(env);
      const conversations = await service.list(limitVal, sinceVal);
      return json(conversations);
    } catch (e: unknown) {
      return error(500, e instanceof Error ? e.message : String(e));
    }
  }

  static async create(request: IRequest, env: Env) {
    const jsonBody = await request.json().catch(() => ({}));
    const parseResult = CreateConversationSchema.safeParse(jsonBody);
    if (!parseResult.success) {
      return error(
        400,
        `Invalid input: ${parseResult.error.issues.map((i) => i.message).join(", ")}`,
      );
    }

    try {
      const service = new ConversationsService(env);
      const created = await service.create(parseResult.data.title);
      return json(created, { status: 201 });
    } catch (e: unknown) {
      return error(500, e instanceof Error ? e.message : String(e));
    }
  }

  static async rename(request: IRequest, env: Env) {
    const { id } = request.params as { id?: string };
    if (!id) return error(400, "Missing id");

    const jsonBody = await request.json();
    const parseResult = RenameConversationSchema.safeParse(jsonBody);
    if (!parseResult.success) {
      return error(
        400,
        `Invalid input: ${parseResult.error.issues.map((i) => i.message).join(", ")}`,
      );
    }

    try {
      const service = new ConversationsService(env);
      const result = await service.rename(id, parseResult.data.title);
      return json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Not found")) return error(404, msg);
      if (msg.includes("Missing")) return error(400, msg);
      return error(500, msg);
    }
  }

  static async delete(request: IRequest, env: Env) {
    const { id } = request.params as { id?: string };
    if (!id) return error(400, "Missing id");

    try {
      const service = new ConversationsService(env);
      const result = await service.delete(id);
      return json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Not found")) return error(404, msg);
      if (msg.includes("Missing")) return error(400, msg);
      return error(500, msg);
    }
  }
}
