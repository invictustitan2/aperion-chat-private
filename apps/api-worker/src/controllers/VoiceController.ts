import { EpisodicRecord, MemoryProvenance } from "@aperion/memory-core";
import { MemoryWriteGate } from "@aperion/policy";
import { computeHash } from "@aperion/shared";
import { IRequest, error, json } from "itty-router";
import { generateChatCompletion } from "../lib/ai";
import { bytesToBase64 } from "../lib/base64";
import { Env } from "../types";

export class VoiceController {
  static async handle(request: IRequest, env: Env) {
    // Note: request is already authenticated by `withAuth`.
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return error(
        400,
        "Expected multipart/form-data with an 'audio' file field",
      );
    }

    const form = await request.formData();
    const audio = form.get("audio");
    const conversationId = form.get("conversation_id")?.toString();
    if (!(audio instanceof File)) {
      return error(400, "Missing 'audio' file");
    }

    const bytes = new Uint8Array(await audio.arrayBuffer());
    let userText = "";

    // Use Workers AI Whisper for speech-to-text (preferred)
    if (env.AI) {
      const { transcribeWithWhisper } = await import("../lib/workersAiStt");
      userText = await transcribeWithWhisper(env.AI, bytes);
    } else {
      // Fallback to Google Cloud STT
      const { transcribeAudio } = await import("../lib/speechToText");
      userText = await transcribeAudio({ bytes }, false, {
        GOOGLE_APPLICATION_CREDENTIALS_JSON:
          env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
      });
    }

    if (!userText.trim()) {
      return error(400, "Speech-to-text produced empty transcription");
    }

    // Record episodic
    const provenance: MemoryProvenance = {
      source_type: "user",
      source_id: "operator",
      timestamp: Date.now(),
      confidence: 1.0,
    };

    const receipt = MemoryWriteGate.shouldWriteEpisodic({
      content: userText,
      provenance,
    });

    await env.MEMORY_DB.prepare(
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
      return error(
        403,
        `Policy denied: ${JSON.stringify(receipt.reasonCodes)}`,
      );
    }

    const record: EpisodicRecord = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      type: "episodic",
      content: userText,
      provenance,
      hash: "",
    };
    record.hash = computeHash(record);

    // Queue Write
    if (env.MEMORY_QUEUE) {
      await env.MEMORY_QUEUE.send({
        type: "episodic",
        record: {
          ...(record as unknown as Record<string, unknown>),
          ...(conversationId ? { conversation_id: conversationId } : {}),
        } as unknown as EpisodicRecord,
      });
    } else {
      await env.MEMORY_DB.prepare(
        "INSERT INTO episodic (id, created_at, content, provenance, hash, conversation_id) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(
          record.id,
          record.createdAt,
          record.content,
          JSON.stringify(record.provenance),
          record.hash,
          conversationId || null,
        )
        .run();
    }

    // Generate response using Workers AI (preferred) or Gemini (fallback)
    let assistantText = "";
    if (env.AI) {
      assistantText =
        (
          await generateChatCompletion(
            env.AI,
            [{ role: "user", content: userText }],
            "You are a helpful voice assistant. Provide concise, clear responses suitable for speech output.",
            "chat",
          )
        ).response || "";
    } else {
      const { generateAssistantReply } = await import("../lib/gemini");
      assistantText =
        (await generateAssistantReply(userText, {
          GEMINI_API_KEY: env.GEMINI_API_KEY,
          GEMINI_MODEL: env.GEMINI_MODEL,
        })) || "";
    }

    if (!assistantText.trim()) {
      return error(502, "LLM produced an empty response");
    }

    // Text-to-Speech: Use Google TTS (Workers AI doesn't have TTS yet)
    let audioBase64 = "";
    let useFrontendTts = true;

    if (env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        const { synthesizeSpeech } = await import("../lib/textToSpeech");
        const audioBytes = await synthesizeSpeech(assistantText, {
          GOOGLE_APPLICATION_CREDENTIALS_JSON:
            env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
        });
        if (audioBytes.length > 0) {
          audioBase64 = bytesToBase64(audioBytes);
          useFrontendTts = false;
        }
      } catch (e) {
        console.error("TTS failed, falling back to frontend synthesis:", e);
      }
    }

    return json({
      userText,
      assistantText,
      audio: audioBase64,
      episodicId: record.id,
      useFrontendTts,
      source: env.AI ? "workers-ai" : "gemini",
    });
  }
}
