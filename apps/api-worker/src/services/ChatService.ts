import { computeHash } from "@aperion/shared";
import { ChatMessage, generateChatCompletion } from "../lib/ai";
import { generateAssistantReply } from "../lib/gemini";
import { TOOLS, executeTool } from "../lib/tools";
import { Env } from "../types";

export class ChatService {
  constructor(private env: Env) {}

  async processMessage(
    userMessage: string,
    history: ChatMessage[] = [],
    modelProvider: "workers-ai" | "gemini" = "workers-ai",
  ) {
    const SYSTEM_PROMPT = `You are Aperion, a helpful and intelligent AI assistant. You are part of a memory-augmented chat system that remembers conversations. Be concise, friendly, and helpful. If you don't know something, say so.`;

    // Fetch user preferences
    const prefResult = await this.env.MEMORY_DB.prepare(
      "SELECT preferred_tone FROM identity WHERE key = 'user_preferences'",
    ).first<{ preferred_tone: string }>();

    let systemPrompt = SYSTEM_PROMPT;
    if (prefResult?.preferred_tone) {
      systemPrompt += `\n\nYour preferred tone is: ${prefResult.preferred_tone}. Adjust your responses accordingly.`;
    }

    // Context Management (Basic Truncation)
    const messages: ChatMessage[] = [
      ...(history || []).slice(-10),
      { role: "user" as const, content: userMessage },
    ];

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
    });

    await this.env.MEMORY_DB.prepare(
      "INSERT INTO episodic (id, created_at, content, provenance, hash) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        timestamp,
        finalResponse,
        provenance,
        computeHash(finalResponse),
      )
      .run();

    return {
      id,
      response: finalResponse,
      timestamp,
    };
  }
}
