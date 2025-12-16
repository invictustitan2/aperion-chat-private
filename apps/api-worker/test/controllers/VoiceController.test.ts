/* eslint-disable @typescript-eslint/no-explicit-any */
import { MemoryWriteGate } from "@aperion/policy";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceController } from "../../src/controllers/VoiceController";
import { generateChatCompletion } from "../../src/lib/ai";
import type { Env } from "../../src/types";
import {
  createFakeD1Database,
  createFakeQueue,
  createMockEnv,
} from "../bindings/mockBindings";

// Setup mocks
vi.mock("@aperion/policy", () => ({
  MemoryWriteGate: {
    shouldWriteEpisodic: vi.fn(),
  },
}));

vi.mock("../../src/lib/ai", () => ({
  generateChatCompletion: vi.fn(),
}));

// Mock dynamic import libs
vi.mock("../../src/lib/workersAiStt", () => ({
  transcribeWithWhisper: vi.fn(),
}));
vi.mock("../../src/lib/textToSpeech", () => ({
  synthesizeSpeech: vi.fn(),
}));

describe("VoiceController", () => {
  let mockRequest: any;
  let mockEnv: Env;
  let db: ReturnType<typeof createFakeD1Database>;
  let queue: ReturnType<typeof createFakeQueue>;
  let mockFormData: FormData;
  let mockFile: File;

  beforeEach(() => {
    mockFile = new File(["test audio"], "audio.wav", { type: "audio/wav" });
    mockFormData = {
      get: vi.fn().mockReturnValue(mockFile),
      entries: vi.fn(),
    } as unknown as FormData;

    mockRequest = {
      headers: {
        get: vi.fn().mockReturnValue("multipart/form-data; boundary=---"),
      },
      formData: vi.fn().mockResolvedValue(mockFormData),
    };

    db = createFakeD1Database();
    queue = createFakeQueue();
    vi.spyOn(queue, "send");
    mockEnv = createMockEnv({
      MEMORY_DB: db,
      MEMORY_QUEUE: queue as any,
    });

    vi.clearAllMocks();
  });

  it("should return 400 if content-type is not multipart", async () => {
    mockRequest.headers.get.mockReturnValue("application/json");
    const response = await VoiceController.handle(mockRequest, mockEnv);
    expect(response.status).toBe(400);
  });

  it("should return 400 if audio file is missing", async () => {
    (mockFormData.get as any).mockReturnValue(null);
    const response = await VoiceController.handle(mockRequest, mockEnv);
    expect(response.status).toBe(400);
  });

  it("should process audio, write memory, and return response", async () => {
    // 1. STT Mock
    const { transcribeWithWhisper } =
      await import("../../src/lib/workersAiStt");
    (transcribeWithWhisper as any).mockResolvedValue("Hello world");

    // 2. Policy Mock
    (MemoryWriteGate.shouldWriteEpisodic as any).mockReturnValue({
      decision: "allow",
      timestamp: 123,
      reasonCodes: [],
      inputsHash: "hash",
    });

    // 3. AI Completion Mock
    (generateChatCompletion as any).mockResolvedValue({
      response: "Hello back",
    });

    // 4. TTS Mock (optional, if creds present)
    // Testing case where no creds -> useFrontendTts = true

    const response = await VoiceController.handle(mockRequest, mockEnv);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      userText: "Hello world",
      assistantText: "Hello back",
      useFrontendTts: true, // No TTS creds
    });

    // Verify DB Receipt
    expect(
      db.prepared.some((p) => p.query.includes("INSERT INTO receipts")),
    ).toBe(true);

    // Verify Queue Send
    expect(queue.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "episodic",
        record: expect.objectContaining({ content: "Hello world" }),
      }),
    );
  });

  it("should return 403 if policy denies", async () => {
    // STT Mock
    const { transcribeWithWhisper } =
      await import("../../src/lib/workersAiStt");
    (transcribeWithWhisper as any).mockResolvedValue("Bad content");

    (MemoryWriteGate.shouldWriteEpisodic as any).mockReturnValue({
      decision: "deny",
      reasonCodes: ["blocked"],
      timestamp: 123,
      inputsHash: "hash",
    });

    const response = await VoiceController.handle(mockRequest, mockEnv);
    expect(response.status).toBe(403);
  });
});
