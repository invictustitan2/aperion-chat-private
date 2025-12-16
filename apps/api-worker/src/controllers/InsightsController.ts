import { IRequest, error, json } from "itty-router";
import { InsightsSummarySchema } from "../lib/schemas";
import { InsightsService } from "../services/InsightsService";
import { Env } from "../types";

export class InsightsController {
  static async summarize(request: IRequest, env: Env) {
    const body = await request.json().catch(() => ({}));
    const parsed = InsightsSummarySchema.safeParse(body);
    if (!parsed.success) {
      return error(
        400,
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      );
    }

    try {
      const service = new InsightsService(env);
      const result = await service.generateSummary({
        query: parsed.data.query,
        limit: parsed.data.limit,
      });

      // Normalize response shape for UI:
      if ("jobId" in result) {
        return json({
          success: true,
          status: "queued",
          jobId: result.jobId,
          sources: result.sources,
        });
      }

      return json({
        success: true,
        status: "completed",
        summary: result.summary,
        sources: result.sources,
      });
    } catch (e: unknown) {
      return error(500, e instanceof Error ? e.message : String(e));
    }
  }
}
