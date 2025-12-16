import { computeHash } from "@aperion/shared";
import { ChatMessage, generateChatCompletion } from "../lib/ai";
import { generateAssistantReply } from "../lib/gemini";
import { TOOLS, executeTool } from "../lib/tools";
import { PreferencesService } from "./PreferencesService";
import { SemanticService } from "./SemanticService";
import { Env } from "../types";

type UsedMemory = {
  type: "semantic";
  id: string;
  score?: number;
  excerpt: string;
};

export class ChatService {
  constructor(private env: Env) {}

  private async selectRelevantMemories(
    query: string,
    limit = 5,
  ): Promise<UsedMemory[]> {
    const q = query.trim();
    if (!q) return [];

    // Prefer semantic hybrid search when AI/Vectorize are configured.
    try {
      const semantic = new SemanticService(this.env);
      const results = await semantic.hybridSearch(q, limit);
      return results.slice(0, limit).map((r) => ({
        type: "semantic" as const,
        id: String(r.id),
        score: r.score,
        excerpt: String(r.content).slice(0, 280),
      }));
    } catch {
      // fall through
    }

    // Fallback: keyword search directly in D1.
    const tokens = q
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
      .slice(0, 6);

    if (tokens.length === 0) return [];

    const where = tokens.map(() => "LOWER(content) LIKE ?").join(" OR ");
    const params = tokens.map((t) => `%${t}%`);

    const { results } = await this.env.MEMORY_DB.prepare(
      `SELECT id, content FROM semantic WHERE ${where} ORDER BY created_at DESC LIMIT ?`,
    )
      .bind(...params, limit)
      .all();

    return (
      (results as Array<Record<string, unknown>> | undefined | null)
        ?.slice(0, limit)
        .map((r) => ({
          type: "semantic" as const,
          id: String(r.id),
          excerpt: String(r.content ?? "").slice(0, 280),
        })) || []
    );
  }

  async processMessage(
    userMessage: string,
    history: ChatMessage[] = [],
    modelProvider: "workers-ai" | "gemini" = "workers-ai",
    conversationId?: string,
  ) {
    const SYSTEM_PROMPT = `You are Aperion, a helpful and intelligent AI assistant. You are part of a memory-augmented chat system that remembers conversations. Be concise, friendly, and helpful. If you don't know something, say so.`;

    // Fetch user tone preference.
    // Preferred source: preferences table (key: ai.tone)
    // Fallback: legacy identity.preferred_tone (key: 'user_preferences')
    let preferredTone: string | null = null;
    try {
      const pref = await new PreferencesService(this.env).get("ai.tone");
      if (typeof pref?.value === "string" && pref.value.trim()) {
        preferredTone = pref.value.trim();
      }
    } catch {
      // ignore (e.g., missing table in older deployments)
    }

    if (!preferredTone) {
      try {
        const prefResult = await this.env.MEMORY_DB.prepare(
          "SELECT preferred_tone FROM identity WHERE key = 'user_preferences'",
        ).first<{ preferred_tone: string }>();
        if (prefResult?.preferred_tone?.trim()) {
          preferredTone = prefResult.preferred_tone.trim();
        }
      } catch {
        // ignore
      }
    }

    let systemPrompt = SYSTEM_PROMPT;
    if (preferredTone) {
      systemPrompt += `\n\nPreferred tone: ${preferredTone}. Adjust your responses accordingly.`;
    }

    // Context Management (Basic Truncation)
    const messages: ChatMessage[] = [
      ...(history || []).slice(-10),
      { role: "user" as const, content: userMessage },
    ];

    // Contextual Memory Injection (P0 baseline): retrieve a few relevant semantic memories.
    const usedMemories = await this.selectRelevantMemories(userMessage, 5);
    if (usedMemories.length > 0) {
      const memoryBlock = usedMemories
        .map((m, idx) => `(${idx + 1}) [semantic:${m.id}] ${m.excerpt}`)
        .join("\n");
      systemPrompt += `\n\nRelevant memories (cite as [semantic:<id>] when used):\n${memoryBlock}`;
    }

    let finalResponse = "";

    if (modelProvider === "gemini") {
      if (!this.env.GEMINI_API_KEY) {
        throw new Error("Gemini API Key not configured");
      }
      // Gemini Path (No tools for now)
      // Construct prompt with history manually or if gemini lib supports history
      // generateAssistantReply currently takes `userText`. It doesn't seem to take history in my previous check.
      // Let's optimize: pass full context as string or update gemini lib.
      // For now, simpler: pass last message + system prompt instructions
      const prompt = `${systemPrompt}\n\nContext:\n${messages.map((m) => `${m.role}: ${m.content}`).join("\n")}\n\nUser: ${userMessage}`;

      finalResponse = await generateAssistantReply(prompt, {
        GEMINI_API_KEY: this.env.GEMINI_API_KEY,
        GEMINI_MODEL: this.env.GEMINI_MODEL,
      });
    } else {
      // Workers AI Path (With Tools)
      const MAX_TURNS = 5;
      let turn = 0;

      while (turn < MAX_TURNS) {
        const result = await generateChatCompletion(
          this.env.AI,
          messages,
          systemPrompt,
          "chat",
          TOOLS,
        );

        if (result.response) {
          finalResponse = result.response;
        }

        if (result.tool_calls && result.tool_calls.length > 0) {
          messages.push({
            role: "assistant",
            content: result.response || "",
          });

          for (const call of result.tool_calls) {
            try {
              const resultText = await executeTool(
                call.name,
                call.arguments,
                this.env,
              );
              messages.push({
                role: "user",
                content: `Tool '${call.name}' output: ${resultText}`,
              });
            } catch (e: unknown) {
              const errorMsg = e instanceof Error ? e.message : String(e);
              messages.push({
                role: "user",
                content: `Tool '${call.name}' failed: ${errorMsg}`,
              });
            }
          }
        } else {
          break;
        }
        turn++;
      }
    }

    if (!finalResponse) {
      finalResponse = "I'm having trouble thinking right now.";
    }

    // Persist
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    const provenance = JSON.stringify({
      source_type: "model",
      source_id: modelProvider,
      timestamp,
      confidence: 1.0,
      // Use existing provenance field for citations.
      derived_from: usedMemories.map((m) => m.id),
    });

    await this.env.MEMORY_DB.prepare(
      "INSERT INTO episodic (id, created_at, content, provenance, hash, conversation_id) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        timestamp,
        finalResponse,
        provenance,
        computeHash(finalResponse),
        conversationId || null,
      )
      .run();

    return {
      id,
      response: finalResponse,
      timestamp,
      usedMemories,
    };
  }
}
