import { IRequest, json } from "itty-router";
import { Env } from "../types";

export class ReceiptsController {
  static async list(request: IRequest, env: Env) {
    const { results } = await env.MEMORY_DB.prepare(
      "SELECT * FROM receipts ORDER BY timestamp DESC LIMIT 50",
    ).all();

    return json(
      results.map((r: Record<string, unknown>) => {
        let reasons = [];
        try {
          reasons = JSON.parse(r.reason_codes as string);
        } catch (e) {
          reasons = [r.reason_codes];
        }

        return {
          id: r.id,
          timestamp: r.timestamp,
          action: "memory_write",
          allowed: r.decision === "allow",
          reason: Array.isArray(reasons) ? reasons.join(", ") : reasons,
        };
      }),
    );
  }
}
