import { IRequest, error, json } from "itty-router";
import { z } from "zod";
import { AnalyticsService } from "../services/AnalyticsService";
import { Env } from "../types";

const DashboardQuerySchema = z.object({
  days: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (!Number.isNaN(v) && v > 0), {
      message: "days must be a positive number",
    }),
});

export class AnalyticsController {
  static async dashboard(request: IRequest, env: Env) {
    const parsed = DashboardQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return error(
        400,
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      );
    }

    const days = parsed.data.days;

    try {
      const service = new AnalyticsService(env);
      const result = await service.dashboard(days);
      const res = json(result);
      // Keep this relatively fresh for dashboard, but allow short caching.
      res.headers.set("Cache-Control", "private, max-age=10");
      return res;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return error(500, msg);
    }
  }
}
