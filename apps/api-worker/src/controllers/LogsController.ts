import { error, IRequest, json } from "itty-router";
import { Env } from "../types";

export class LogsController {
  /**
   * List dev logs
   * GET /v1/logs?limit=100
   */
  static async list(request: IRequest, env: Env) {
    const limit = parseInt((request.query.limit as string) || "100");

    try {
      const { results } = await env.MEMORY_DB.prepare(
        "SELECT * FROM dev_logs ORDER BY timestamp DESC LIMIT ?",
      )
        .bind(Math.min(limit, 500))
        .all();

      return json(
        results.map((r: Record<string, unknown>) => ({
          id: r.id,
          timestamp: r.timestamp,
          level: r.level,
          message: r.message,
          stack_trace: r.stack_trace,
          metadata: r.metadata,
          source: r.source,
        })),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return error(500, `Failed to fetch logs: ${msg}`);
    }
  }

  /**
   * Clear all dev logs
   * DELETE /v1/logs
   */
  static async clear(_request: IRequest, env: Env) {
    try {
      const result = await env.MEMORY_DB.prepare("DELETE FROM dev_logs").run();

      return json({
        success: true,
        deleted: result.meta?.changes || 0,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return error(500, `Failed to clear logs: ${msg}`);
    }
  }

  /**
   * Create a new log entry (internal use)
   * POST /v1/logs
   */
  static async create(request: IRequest, env: Env) {
    try {
      const body = (await request.json()) as {
        level: string;
        message: string;
        source?: string;
        metadata?: string;
        stack_trace?: string;
      };

      if (!body.level || !body.message) {
        return error(400, "Missing level or message");
      }

      const id = crypto.randomUUID();
      const timestamp = Date.now();

      await env.MEMORY_DB.prepare(
        "INSERT INTO dev_logs (id, timestamp, level, message, source, metadata, stack_trace) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          id,
          timestamp,
          body.level,
          body.message,
          body.source || null,
          body.metadata || null,
          body.stack_trace || null,
        )
        .run();

      return json({ success: true, id }, { status: 201 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return error(500, `Failed to create log: ${msg}`);
    }
  }
}
