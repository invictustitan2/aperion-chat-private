import { IRequest, error, json } from "itty-router";
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
}
