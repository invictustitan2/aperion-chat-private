import { IRequest, error, json } from "itty-router";
import { z } from "zod";
import { PreferencesService } from "../services/PreferencesService";
import { Env } from "../types";
import {
  getDefaultPreference,
  isKnownPreferenceKey,
  validatePreferenceValue,
} from "../lib/preferencesRegistry";

const PreferenceSetSchema = z.object({
  value: z.unknown(),
});

export class PreferencesController {
  static async get(request: IRequest, env: Env) {
    const { key } = request.params as { key?: string };
    if (!key) return error(400, "Missing key");

    // Unknown keys are not part of the stable preferences contract.
    if (!isKnownPreferenceKey(key)) {
      return error(404, "Not found");
    }

    try {
      const service = new PreferencesService(env);
      const found = await service.get(key);
      if (!found) {
        const def = getDefaultPreference(key);
        return json({
          key: def.key,
          value: def.value,
          updatedAt: 0,
          isDefault: true,
        });
      }
      return json({ ...found, isDefault: false });
    } catch (e: unknown) {
      return error(500, e instanceof Error ? e.message : String(e));
    }
  }

  static async set(request: IRequest, env: Env) {
    const { key } = request.params as { key?: string };
    if (!key) return error(400, "Missing key");

    if (!isKnownPreferenceKey(key)) {
      return error(404, "Not found");
    }

    const jsonBody = await request.json().catch(() => ({}));
    const parsed = PreferenceSetSchema.safeParse(jsonBody);
    if (!parsed.success) {
      return error(
        400,
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      );
    }

    try {
      const validated = validatePreferenceValue(key, parsed.data.value);
      if (!validated.ok) {
        return error(400, validated.error);
      }
      const service = new PreferencesService(env);
      const saved = await service.set(key, validated.value);
      return json({ ...saved, isDefault: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Missing")) return error(400, msg);
      return error(500, msg);
    }
  }
}
