import { IdentityRecord } from "@aperion/memory-core";
import { IRequest, error, json } from "itty-router";
import { IdentityUpsertSchema } from "../lib/schemas";
import { IdentityService } from "../services/IdentityService";
import { Env } from "../types";

export class IdentityController {
  static async upsert(request: IRequest, env: Env) {
    const jsonBody = await request.json();
    const parseResult = IdentityUpsertSchema.safeParse(jsonBody);

    if (!parseResult.success) {
      return error(
        400,
        `Invalid input: ${parseResult.error.issues.map((e) => e.message).join(", ")}`,
      );
    }

    const body = parseResult.data as Partial<IdentityRecord> & {
      explicit_confirm?: boolean;
      preferred_tone?: string;
      memory_retention_days?: number;
      interface_theme?: string;
    };
    try {
      const service = new IdentityService(env);
      const result = await service.upsert(body);
      return json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Policy denied")) return error(403, msg);
      if (msg.includes("Missing")) return error(400, msg);
      return error(500, msg);
    }
  }

  static async get(request: IRequest, env: Env) {
    try {
      const service = new IdentityService(env);
      const result = await service.getAll();
      return json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return error(500, msg);
    }
  }
}
