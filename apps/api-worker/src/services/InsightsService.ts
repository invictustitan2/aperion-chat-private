import { SemanticService } from "./SemanticService";
import { Env } from "../types";

export type InsightSource =
  | { type: "semantic"; id: string; score?: number }
  | { type: "episodic"; id: string };

export class InsightsService {
  constructor(private env: Env) {}

  async generateSummary(opts: { query?: string; limit?: number }) {
    const limit = Math.max(1, Math.min(20, Number(opts.limit) || 8));
    const query = opts.query?.trim() || undefined;

    const sources: InsightSource[] = [];
    const contents: string[] = [];

    // Prefer semantic memories for insight generation.
    if (query) {
      try {
        const semantic = new SemanticService(this.env);
        const results = await semantic.hybridSearch(query, limit);
        for (const r of results) {
          sources.push({ type: "semantic", id: String(r.id), score: r.score });
          contents.push(String(r.content));
        }
      } catch {
        // fall through
      }
    }

    // Fallback: recent semantic entries via keyword search.
    if (contents.length === 0) {
      const { results } = await this.env.MEMORY_DB.prepare(
        "SELECT id, content FROM semantic ORDER BY created_at DESC LIMIT ?",
      )
        .bind(limit)
        .all();

      for (const r of (results || []) as Array<Record<string, unknown>>) {
        sources.push({ type: "semantic", id: String(r.id) });
        contents.push(String(r.content));
      }
    }

    // Fallback: recent episodic entries.
    if (contents.length === 0) {
      const { results } = await this.env.MEMORY_DB.prepare(
        "SELECT id, content FROM episodic ORDER BY created_at DESC LIMIT ?",
      )
        .bind(limit)
        .all();

      for (const r of (results || []) as Array<Record<string, unknown>>) {
        sources.push({ type: "episodic", id: String(r.id) });
        contents.push(String(r.content));
      }
    }

    const semantic = new SemanticService(this.env);
    const summarizeRes = await semantic.summarize(contents, query);

    return {
      ...summarizeRes,
      sources,
    };
  }
}
