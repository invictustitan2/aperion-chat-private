import { IRequest, error, json } from "itty-router";
import { ChatMessage, generateChatCompletionStream } from "../lib/ai";
import { ChatRequestSchema } from "../lib/schemas";
import { ChatService } from "../services/ChatService";
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

    const SYSTEM_PROMPT = `You are Aperion, a helpful and intelligent AI assistant. You are part of a memory-augmented chat system that remembers conversations. Be concise, friendly, and helpful. If you don't know something, say so.`;

    // Build messages array
    const messages: ChatMessage[] = [
      ...((body.history as ChatMessage[]) || []).slice(-10),
      { role: "user" as const, content: body.message },
    ];

    try {
      const stream = await generateChatCompletionStream(
        env.AI,
        messages,
        SYSTEM_PROMPT,
        "chat",
      );

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
