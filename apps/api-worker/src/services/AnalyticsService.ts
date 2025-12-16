import { Env } from "../types";

export type AnalyticsRange = "24h" | "7d" | "30d";

export interface AnalyticsDayCounts {
  date: string; // YYYY-MM-DD
  episodicCount: number;
  semanticCount: number;
  userMessages: number;
  assistantMessages: number;
}

export interface AnalyticsSummaryBucket {
  range: AnalyticsRange;
  episodicCount: number;
  semanticCount: number;
  userMessages: number;
  assistantMessages: number;
}

export interface AnalyticsTopic {
  term: string;
  count: number;
}

export interface AnalyticsDashboardResponse {
  generatedAt: number;
  days: AnalyticsDayCounts[];
  summary: AnalyticsSummaryBucket[];
  topics: AnalyticsTopic[];
  aiUsage: {
    assistantMessages30d: number;
    avgAssistantChars30d: number;
  };
}

function startOfDayUTC(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function formatDayUTC(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "into",
  "your",
  "you",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "not",
  "but",
  "can",
  "will",
  "just",
  "like",
  "what",
  "when",
  "where",
  "which",
  "who",
  "how",
  "why",
  "about",
  "their",
  "them",
  "they",
  "then",
  "than",
  "too",
  "very",
  "also",
  "more",
  "most",
  "some",
  "any",
  "all",
  "our",
  "out",
  "use",
  "using",
  "used",
  "one",
  "two",
  "three",
  "would",
  "could",
  "should",
]);

export class AnalyticsService {
  constructor(private env: Env) {}

  private async getDailyCounts(startMs: number): Promise<
    Array<{
      day: string;
      episodicCount: number;
      semanticCount: number;
      userMessages: number;
      assistantMessages: number;
    }>
  > {
    const episodic = await this.env.MEMORY_DB.prepare(
      "SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, COUNT(*) AS cnt FROM episodic WHERE created_at >= ? GROUP BY day",
    )
      .bind(startMs)
      .all();

    const semantic = await this.env.MEMORY_DB.prepare(
      "SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, COUNT(*) AS cnt FROM semantic WHERE created_at >= ? GROUP BY day",
    )
      .bind(startMs)
      .all();

    const user = await this.env.MEMORY_DB.prepare(
      "SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, COUNT(*) AS cnt FROM episodic WHERE created_at >= ? AND json_extract(provenance, '$.source_type') = 'user' GROUP BY day",
    )
      .bind(startMs)
      .all();

    const assistant = await this.env.MEMORY_DB.prepare(
      "SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS day, COUNT(*) AS cnt FROM episodic WHERE created_at >= ? AND json_extract(provenance, '$.source_type') = 'assistant' GROUP BY day",
    )
      .bind(startMs)
      .all();

    const byDay = new Map<
      string,
      {
        day: string;
        episodicCount: number;
        semanticCount: number;
        userMessages: number;
        assistantMessages: number;
      }
    >();

    const upsert = (day: string) => {
      if (!byDay.has(day)) {
        byDay.set(day, {
          day,
          episodicCount: 0,
          semanticCount: 0,
          userMessages: 0,
          assistantMessages: 0,
        });
      }
      return byDay.get(day)!;
    };

    for (const r of episodic.results as Array<Record<string, unknown>>) {
      const day = String(r.day);
      upsert(day).episodicCount = Number(r.cnt ?? 0);
    }
    for (const r of semantic.results as Array<Record<string, unknown>>) {
      const day = String(r.day);
      upsert(day).semanticCount = Number(r.cnt ?? 0);
    }
    for (const r of user.results as Array<Record<string, unknown>>) {
      const day = String(r.day);
      upsert(day).userMessages = Number(r.cnt ?? 0);
    }
    for (const r of assistant.results as Array<Record<string, unknown>>) {
      const day = String(r.day);
      upsert(day).assistantMessages = Number(r.cnt ?? 0);
    }

    // Fill in missing dates for continuity.
    const days: Array<{
      day: string;
      episodicCount: number;
      semanticCount: number;
      userMessages: number;
      assistantMessages: number;
    }> = [];

    const end = startOfDayUTC(Date.now());
    for (let t = startOfDayUTC(startMs); t <= end; t += 24 * 60 * 60 * 1000) {
      const day = formatDayUTC(t);
      const existing = byDay.get(day);
      if (existing) {
        days.push(existing);
      } else {
        days.push({
          day,
          episodicCount: 0,
          semanticCount: 0,
          userMessages: 0,
          assistantMessages: 0,
        });
      }
    }

    return days;
  }

  private async getRangeSummary(
    range: AnalyticsRange,
  ): Promise<AnalyticsSummaryBucket> {
    const now = Date.now();
    const startMs =
      range === "24h"
        ? now - 24 * 60 * 60 * 1000
        : range === "7d"
          ? now - 7 * 24 * 60 * 60 * 1000
          : now - 30 * 24 * 60 * 60 * 1000;

    const episodicRow = await this.env.MEMORY_DB.prepare(
      "SELECT COUNT(*) AS cnt FROM episodic WHERE created_at >= ?",
    )
      .bind(startMs)
      .first();

    const semanticRow = await this.env.MEMORY_DB.prepare(
      "SELECT COUNT(*) AS cnt FROM semantic WHERE created_at >= ?",
    )
      .bind(startMs)
      .first();

    const userRow = await this.env.MEMORY_DB.prepare(
      "SELECT COUNT(*) AS cnt FROM episodic WHERE created_at >= ? AND json_extract(provenance, '$.source_type') = 'user'",
    )
      .bind(startMs)
      .first();

    const assistantRow = await this.env.MEMORY_DB.prepare(
      "SELECT COUNT(*) AS cnt FROM episodic WHERE created_at >= ? AND json_extract(provenance, '$.source_type') = 'assistant'",
    )
      .bind(startMs)
      .first();

    const getCnt = (row: unknown) =>
      Number((row as Record<string, unknown> | null)?.cnt ?? 0);

    return {
      range,
      episodicCount: getCnt(episodicRow),
      semanticCount: getCnt(semanticRow),
      userMessages: getCnt(userRow),
      assistantMessages: getCnt(assistantRow),
    };
  }

  private async getTopics(startMs: number): Promise<AnalyticsTopic[]> {
    // Sample recent semantic memories to approximate topic distribution.
    const { results } = await this.env.MEMORY_DB.prepare(
      "SELECT content FROM semantic WHERE created_at >= ? ORDER BY created_at DESC LIMIT 500",
    )
      .bind(startMs)
      .all();

    const freq = new Map<string, number>();

    for (const r of results as Array<Record<string, unknown>>) {
      const content = String(r.content ?? "");
      for (const term of tokenize(content)) {
        if (term.length < 3) continue;
        if (STOPWORDS.has(term)) continue;
        freq.set(term, (freq.get(term) ?? 0) + 1);
      }
    }

    const items = Array.from(freq.entries())
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    return items;
  }

  private async getAiUsage30d(): Promise<{
    assistantMessages30d: number;
    avgAssistantChars30d: number;
  }> {
    const startMs = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const row = await this.env.MEMORY_DB.prepare(
      "SELECT COUNT(*) AS cnt, AVG(LENGTH(content)) AS avg_len FROM episodic WHERE created_at >= ? AND json_extract(provenance, '$.source_type') = 'assistant'",
    )
      .bind(startMs)
      .first();

    const r = (row ?? {}) as Record<string, unknown>;
    const cnt = Number(r.cnt ?? 0);
    const avg = Number(r.avg_len ?? 0);

    return {
      assistantMessages30d: cnt,
      avgAssistantChars30d: Math.round(avg || 0),
    };
  }

  async dashboard(days: number = 30): Promise<AnalyticsDashboardResponse> {
    const safeDays = Math.min(Math.max(days, 7), 90);
    const startMs = Date.now() - (safeDays - 1) * 24 * 60 * 60 * 1000;

    const dayCounts = await this.getDailyCounts(startOfDayUTC(startMs));
    const summary: AnalyticsSummaryBucket[] = await Promise.all([
      this.getRangeSummary("24h"),
      this.getRangeSummary("7d"),
      this.getRangeSummary("30d"),
    ]);

    const topics = await this.getTopics(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const aiUsage = await this.getAiUsage30d();

    return {
      generatedAt: Date.now(),
      days: dayCounts.map((d) => ({
        date: d.day,
        episodicCount: d.episodicCount,
        semanticCount: d.semanticCount,
        userMessages: d.userMessages,
        assistantMessages: d.assistantMessages,
      })),
      summary,
      topics,
      aiUsage,
    };
  }
}
