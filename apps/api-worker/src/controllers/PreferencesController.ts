import { IRequest, error, json } from "itty-router";
import { z } from "zod";
import { PreferencesService } from "../services/PreferencesService";
import { Env } from "../types";

const PreferenceSetSchema = z.object({
  value: z.unknown(),
});

export class PreferencesController {
  static async get(request: IRequest, env: Env) {
    const { key } = request.params as { key?: string };
    if (!key) return error(400, "Missing key");

    try {
      const service = new PreferencesService(env);
      const found = await service.get(key);
      if (!found) return error(404, "Not found");
      return json(found);
    } catch (e: unknown) {
      return error(500, e instanceof Error ? e.message : String(e));
    }
  }

  static async set(request: IRequest, env: Env) {
    const { key } = request.params as { key?: string };
    if (!key) return error(400, "Missing key");

    const jsonBody = await request.json().catch(() => ({}));
    const parsed = PreferenceSetSchema.safeParse(jsonBody);
    if (!parsed.success) {
      return error(
        400,
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      );
    }

    try {
      const service = new PreferencesService(env);
      const saved = await service.set(key, parsed.data.value);
      return json(saved);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Missing")) return error(400, msg);
      return error(500, msg);
    }
  }
}
