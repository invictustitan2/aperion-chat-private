import { MemoryProvenance, SemanticRecord } from "@aperion/memory-core";
import { MemoryWriteGate } from "@aperion/policy";
import { computeHash } from "@aperion/shared";
import { generateChatCompletion, generateEmbedding } from "../lib/ai";
import { Env } from "../types";

export class SemanticService {
  constructor(private env: Env) {}

  async create(
    body: Partial<SemanticRecord> & { policyContext?: Record<string, unknown> },
  ) {
    if (!body.content || !body.references || !body.provenance) {
      throw new Error("Missing content, references, or provenance");
    }

    const prov = body.provenance as unknown as Record<string, unknown>;
    const policyContext = {
      ...body.policyContext,
      explicit_confirm: prov?.explicit_confirm ?? false,
    };

    const receipt = MemoryWriteGate.shouldWriteSemantic(body, policyContext);

    await this.env.MEMORY_DB.prepare(
      "INSERT INTO receipts (id, timestamp, decision, reason_codes, inputs_hash) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(
        crypto.randomUUID(),
        receipt.timestamp,
        receipt.decision,
        JSON.stringify(receipt.reasonCodes),
        receipt.inputsHash,
      )
      .run();

    if (receipt.decision !== "allow") {
      throw new Error(
        `Policy denied/deferred: ${JSON.stringify(receipt.reasonCodes)}`,
      );
    }

    const record: SemanticRecord = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      type: "semantic",
      content: body.content,
      references: body.references,
      provenance: body.provenance as MemoryProvenance,
      hash: "",
      embedding: body.embedding,
    };

    let status = "written";

    if (this.env.MEMORY_QUEUE) {
      await this.env.MEMORY_QUEUE.send({
        type: "semantic",
        record,
      });
      status = "queued";
    } else {
      if (!record.embedding && this.env.AI) {
        record.embedding = await generateEmbedding(this.env.AI, record.content);
      }
      record.hash = computeHash(record);

      await this.env.MEMORY_DB.prepare(
        'INSERT INTO semantic (id, created_at, content, embedding, "references", provenance, hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(
          record.id,
          record.createdAt,
          record.content,
          JSON.stringify(record.embedding || []),
          JSON.stringify(record.references),
          JSON.stringify(record.provenance),
          record.hash,
        )
        .run();

      if (this.env.MEMORY_VECTORS && record.embedding) {
        await this.env.MEMORY_VECTORS.insert([
          {
            id: record.id,
            values: record.embedding,
            metadata: {
              type: "semantic",
              createdAt: record.createdAt,
            },
          },
        ]);
      }
    }

    return { success: true, id: record.id, receipt, status };
  }

  async search(query: string, limit: number = 5) {
    if (!this.env.AI || !this.env.MEMORY_VECTORS) {
      throw new Error("AI/Vectorize not configured");
    }

    const embedding = await generateEmbedding(this.env.AI, query);
    const matches = await this.env.MEMORY_VECTORS.query(embedding, {
      topK: limit,
      returnMetadata: true,
    });

    const ids = matches.matches.map((m) => m.id);
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => "?").join(",");
    const { results } = await this.env.MEMORY_DB.prepare(
      `SELECT * FROM semantic WHERE id IN (${placeholders})`,
    )
      .bind(...ids)
      .all();

    return results
      .map((r: Record<string, unknown>) => {
        const match = matches.matches.find((m) => m.id === r.id);
        return {
          id: r.id,
          createdAt: r.created_at,
          content: r.content,
          embedding: r.embedding,
          hash: r.hash,
          score: match?.score || 0,
          provenance: JSON.parse(r.provenance as string),
          references: JSON.parse(r.references as string),
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Hybrid search combining keyword (D1) and semantic (vector) search
   * with re-ranking for better relevance
   */
  async hybridSearch(query: string, limit: number = 10) {
    const results: Array<{
      id: string;
      content: string;
      createdAt: number;
      score: number;
      keywordScore: number;
      semanticScore: number;
      provenance: unknown;
      references: string[];
    }> = [];

    // 1. Keyword search from D1 using LIKE
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((k) => k.length > 2);
    if (keywords.length > 0) {
      const keywordConditions = keywords
        .map(() => "LOWER(content) LIKE ?")
        .join(" OR ");
      const keywordParams = keywords.map((k) => `%${k}%`);

      try {
        const { results: keywordResults } = await this.env.MEMORY_DB.prepare(
          `SELECT id, content, created_at, provenance, "references" FROM semantic
           WHERE ${keywordConditions}
           ORDER BY created_at DESC
           LIMIT ?`,
        )
          .bind(...keywordParams, limit)
          .all();

        for (const r of keywordResults) {
          // Calculate keyword match score based on number of keywords matched
          const content = (r.content as string).toLowerCase();
          const matchedKeywords = keywords.filter((k) => content.includes(k));
          const keywordScore = matchedKeywords.length / keywords.length;

          results.push({
            id: r.id as string,
            content: r.content as string,
            createdAt: r.created_at as number,
            score: keywordScore * 0.4, // Keyword weight: 40%
            keywordScore,
            semanticScore: 0,
            provenance: JSON.parse(r.provenance as string),
            references: JSON.parse(r.references as string),
          });
        }
      } catch {
        // Keyword search failed, continue with semantic only
      }
    }

    // 2. Semantic vector search
    if (this.env.AI && this.env.MEMORY_VECTORS) {
      try {
        const embedding = await generateEmbedding(this.env.AI, query);
        const matches = await this.env.MEMORY_VECTORS.query(embedding, {
          topK: limit,
          returnMetadata: true,
        });

        const vectorIds = matches.matches.map((m) => m.id);
        if (vectorIds.length > 0) {
          const placeholders = vectorIds.map(() => "?").join(",");
          const { results: semanticResults } = await this.env.MEMORY_DB.prepare(
            `SELECT id, content, created_at, provenance, "references" FROM semantic WHERE id IN (${placeholders})`,
          )
            .bind(...vectorIds)
            .all();

          for (const r of semanticResults) {
            const match = matches.matches.find((m) => m.id === r.id);
            const semanticScore = match?.score || 0;

            // Check if already in results from keyword search
            const existing = results.find((res) => res.id === r.id);
            if (existing) {
              // Merge scores
              existing.semanticScore = semanticScore;
              existing.score =
                existing.keywordScore * 0.4 + semanticScore * 0.6;
            } else {
              results.push({
                id: r.id as string,
                content: r.content as string,
                createdAt: r.created_at as number,
                score: semanticScore * 0.6, // Semantic weight: 60%
                keywordScore: 0,
                semanticScore,
                provenance: JSON.parse(r.provenance as string),
                references: JSON.parse(r.references as string),
              });
            }
          }
        }
      } catch {
        // Semantic search failed, use keyword results only
      }
    }

    // 3. Sort by combined score and limit
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async summarize(contents: string[], query?: string) {
    if (this.env.MEMORY_QUEUE) {
      const jobId = crypto.randomUUID();
      const now = Date.now();
      await this.env.MEMORY_DB.prepare(
        "INSERT INTO jobs (id, type, status, created_at, updated_at, input) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(
          jobId,
          "summarize",
          "queued",
          now,
          now,
          JSON.stringify({ contents, query }),
        )
        .run();

      await this.env.MEMORY_QUEUE.send({
        type: "summarize",
        jobId,
        contents,
        query,
      });

      return { success: true, jobId, status: "queued" };
    }

    if (!this.env.AI) {
      throw new Error("Workers AI not configured");
    }

    const combinedContent = contents.join("\n\n---\n\n");
    const prompt = query
      ? `Based on the following search results for "${query}", provide a concise summary of the key information:\n\n${combinedContent}`
      : `Summarize the following information concisely:\n\n${combinedContent}`;

    const response = await generateChatCompletion(
      this.env.AI,
      [{ role: "user", content: prompt }],
      "You are a helpful assistant that provides concise, accurate summaries.",
      "summarization",
    );

    return { summary: response.response };
  }
}
