import { IRequest, error, json } from "itty-router";
import { AI_LIMITS, AI_MODELS, ChatMessage } from "../lib/ai";
import { ChatRequestSchema } from "../lib/schemas";
import { EpisodicService } from "../services/EpisodicService";
import { ChatService } from "../services/ChatService";
import { PreferencesService } from "../services/PreferencesService";
import { SemanticService } from "../services/SemanticService";
import { Env } from "../types";

export class ChatController {
  static async chat(request: IRequest, env: Env) {
    const jsonBody = await request.json();
    const parseResult = ChatRequestSchema.safeParse(jsonBody);

    if (!parseResult.success) {
      return error(
        400,
        `Invalid input: ${parseResult.error.issues.map((e) => e.message).join(", ")}`,
      );
    }

    const body = parseResult.data;

    try {
      const service = new ChatService(env);
      const result = await service.processMessage(
        body.message,
        body.history,
        body.model,
        body.conversation_id,
      );
      return json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return error(500, `Chat completion failed: ${msg}`);
    }
  }

  /**
   * Stream chat response using SSE (Server-Sent Events)
   * Returns tokens as they are generated
   */
  static async stream(request: IRequest, env: Env) {
    const jsonBody = await request.json();
    const parseResult = ChatRequestSchema.safeParse(jsonBody);

    if (!parseResult.success) {
      return error(
        400,
        `Invalid input: ${parseResult.error.issues.map((e) => e.message).join(", ")}`,
      );
    }

    const body = parseResult.data;

    let SYSTEM_PROMPT = `You are Aperion, a helpful and intelligent AI assistant. You are part of a memory-augmented chat system that remembers conversations. Be concise, friendly, and helpful. If you don't know something, say so.`;

    // Optional: tone preference from preferences table.
    try {
      const pref = await new PreferencesService(env).get("ai.tone");
      if (typeof pref?.value === "string" && pref.value.trim()) {
        SYSTEM_PROMPT += `\n\nPreferred tone: ${pref.value.trim()}. Adjust your responses accordingly.`;
      }
    } catch {
      // ignore (tests may not provide MEMORY_DB)
    }

    try {
      const limits = AI_LIMITS.chat;
      const model = AI_MODELS.chat;

      // Basic contextual memory injection for streaming path.
      // We keep this intentionally lightweight and tolerant of missing AI/Vectorize.
      let derivedFrom: string[] = [];
      try {
        const semantic = new SemanticService(env);
        const hits = await semantic.hybridSearch(body.message, 5);
        derivedFrom = hits.map((h) => String(h.id));
        if (hits.length > 0) {
          const memoryBlock = hits
            .map(
              (m, idx) =>
                `(${idx + 1}) [semantic:${m.id}] ${String(m.content).slice(0, 280)}`,
            )
            .join("\n");
          SYSTEM_PROMPT += `\n\nRelevant memories (cite as [semantic:<id>] when used):\n${memoryBlock}`;
        }
      } catch {
        // ignore
      }

      // Build messages array
      const messages: ChatMessage[] = [
        ...((body.history as ChatMessage[]) || []).slice(-limits.maxContext),
        { role: "user" as const, content: body.message },
      ];

      const fullMessages: ChatMessage[] = SYSTEM_PROMPT
        ? [{ role: "system", content: SYSTEM_PROMPT }, ...messages]
        : messages;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aiResponse = await env.AI.run(model as any, {
        messages: fullMessages,
        max_tokens: limits.maxTokens,
        stream: true,
      });

      const aiStream = aiResponse as ReadableStream<Uint8Array>;
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const reader = aiStream.getReader();
          let buffer = "";
          let assistantText = "";

          try {
            // Emit meta first so the client can display influenced-by.
            if (derivedFrom.length > 0) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ meta: { derived_from: derivedFrom } })}\n\n`,
                ),
              );
            }

            // eslint-disable-next-line no-constant-condition
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });

              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed === "data: [DONE]" || trimmed === "[DONE]") {
                  continue;
                }

                const jsonStr = trimmed.startsWith("data: ")
                  ? trimmed.slice(6)
                  : trimmed;
                if (!jsonStr.trim()) continue;

                try {
                  const parsed = JSON.parse(jsonStr) as { response?: string };
                  if (parsed.response) {
                    assistantText += parsed.response;
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ token: parsed.response })}\n\n`,
                      ),
                    );
                  }
                } catch {
                  // Fallback: forward raw line and treat as token
                  assistantText += jsonStr;
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ token: jsonStr })}\n\n`,
                    ),
                  );
                }
              }
            }

            // Persist assistant response BEFORE sending [DONE] so clients can refetch immediately.
            const content = assistantText.trim();
            if (content) {
              const episodic = new EpisodicService(env);
              await episodic.create({
                content,
                provenance: {
                  source_type: "model",
                  source_id: "workers-ai",
                  timestamp: Date.now(),
                  confidence: 1.0,
                  ...(derivedFrom.length > 0
                    ? { derived_from: derivedFrom }
                    : {}),
                },
                ...(body.conversation_id
                  ? { conversation_id: body.conversation_id }
                  : {}),
              });
            }

            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (e) {
            console.error("Streaming pipeline failed:", e);
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return error(500, `Streaming failed: ${msg}`);
    }
  }

  static async export(request: IRequest, env: Env) {
    const { html } = (await request.json()) as { html: string };
    if (!html) return error(400, "Missing html content");

    try {
      const { renderChatToPdf } = await import("../lib/renderer");
      const pdf = await renderChatToPdf(html, env);

      return new Response(pdf.buffer as ArrayBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="chat-export-${Date.now()}.pdf"`,
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return error(500, `PDF Generation failed: ${msg}`);
    }
  }

  /**
   * Analyze an image using vision AI
   * Accepts multipart/form-data with 'image' file and optional 'prompt' field
   */
  static async analyze(request: IRequest, env: Env) {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return error(400, "Expected multipart/form-data");
    }

    try {
      const formData = await request.formData();
      const imageFile = formData.get("image");
      const prompt = formData.get("prompt")?.toString();

      if (!imageFile || !(imageFile instanceof File)) {
        return error(400, "Missing image file");
      }

      const imageBuffer = await imageFile.arrayBuffer();
      const imageData = new Uint8Array(imageBuffer);

      const { analyzeImage } = await import("../lib/ai");
      const analysis = await analyzeImage(env.AI, imageData, prompt);

      return json({
        success: true,
        analysis,
        timestamp: Date.now(),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return error(500, `Image analysis failed: ${msg}`);
    }
  }
}
