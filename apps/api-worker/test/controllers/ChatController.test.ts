/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatController } from "../../src/controllers/ChatController";
import { ChatService } from "../../src/services/ChatService";
import { EpisodicService } from "../../src/services/EpisodicService";
import type { Env } from "../../src/types";
import { createMockEnv } from "../bindings/mockBindings";

// Mock ChatService
vi.mock("../../src/services/ChatService", () => {
  return {
    ChatService: vi.fn().mockImplementation(() => ({
      processMessage: vi.fn(),
    })),
  };
});

vi.mock("../../src/services/EpisodicService", () => {
  return {
    EpisodicService: vi.fn().mockImplementation(() => ({
      create: vi.fn().mockResolvedValue({ success: true, id: "e1" }),
    })),
  };
});

// Mock renderer
vi.mock("../../src/lib/renderer", () => ({
  renderChatToPdf: vi.fn().mockResolvedValue({ buffer: new ArrayBuffer(8) }),
}));

describe("ChatController", () => {
  let mockRequest: any;
  let mockEnv: Env;
  // let mockService: any;

  beforeEach(() => {
    mockRequest = {
      json: vi.fn(),
    };
    mockEnv = createMockEnv();
    // mockService = new ChatService(mockEnv);
    (ChatService as any).mockClear();
    // Re-instantiate mock to capture the instance that Controller will create?
    // Actually vi.mock factory returns the class constructor.
    // When Controller calls new ChatService(), it gets a mock instance.
    // We need to access that instance's methods to mock return values.
  });

  it("should return 400 for invalid input", async () => {
    mockRequest.json.mockResolvedValue({ message: "" }); // Empty message is invalid

    const response = await ChatController.chat(mockRequest, mockEnv);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect((body as any).error).toContain("Invalid input");
  });

  it("should process valid message and return result", async () => {
    mockRequest.json.mockResolvedValue({
      message: "Hello",
      history: [],
      model: "workers-ai",
    });

    const mockProcessMessage = vi.fn().mockResolvedValue({
      id: "msg-1",
      response: "Hi there",
      timestamp: 123456,
    });

    // Setup the mock implementation for the NEXT instance created
    (ChatService as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => ({
        processMessage: mockProcessMessage,
      }),
    );

    const response = await ChatController.chat(mockRequest, mockEnv);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      id: "msg-1",
      response: "Hi there",
      timestamp: 123456,
    });
    expect(mockProcessMessage).toHaveBeenCalledWith(
      "Hello",
      [],
      "workers-ai",
      undefined,
    );
  });

  it("should handle service errors", async () => {
    mockRequest.json.mockResolvedValue({
      message: "Hello",
      history: [],
    });

    (ChatService as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => ({
        processMessage: vi.fn().mockRejectedValue(new Error("Service error")),
      }),
    );

    const response = await ChatController.chat(mockRequest, mockEnv);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect((body as any).error).toContain(
      "Chat completion failed: Service error",
    );
  });

  describe("export", () => {
    it("should export PDF", async () => {
      mockRequest.json.mockResolvedValue({ html: "<html>Same</html>" });

      const response = await ChatController.export(mockRequest, mockEnv);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
    });
  });

  describe("stream", () => {
    it("should stream SSE tokens and persist assistant response", async () => {
      mockRequest.json.mockResolvedValue({
        message: "Hello",
        history: [],
      });

      const encoder = new TextEncoder();
      const aiStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('{"response":"Hi"}\n'));
          controller.enqueue(encoder.encode('{"response":" there"}\n'));
          controller.enqueue(encoder.encode("data: [DONE]\n"));
          controller.close();
        },
      });

      const env = createMockEnv({
        AI: {
          run: vi.fn().mockResolvedValue(aiStream),
        } as any,
      });

      const response = await ChatController.stream(mockRequest, env);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/event-stream");

      const bodyText = await response.text();
      expect(bodyText).toContain('data: {"token":"Hi"}');
      expect(bodyText).toContain('data: {"token":" there"}');
      expect(bodyText).toContain("data: [DONE]");

      const episodicCtor = EpisodicService as unknown as ReturnType<
        typeof vi.fn
      >;
      const episodicInstance = episodicCtor.mock.results[0]?.value;
      expect(episodicInstance.create).toHaveBeenCalled();
      const callArg = episodicInstance.create.mock.calls[0][0];
      expect(callArg.content).toBe("Hi there");
      expect(callArg.provenance.source_type).toBe("model");
    });
  });
});
