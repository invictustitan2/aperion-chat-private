// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Chat } from "./Chat";
import { api } from "../lib/api";

// Mock the API
vi.mock("../lib/api", () => ({
  api: {
    conversations: {
      list: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      rename: vi.fn(),
      messages: vi.fn(),
      sendMessage: vi.fn(),
    },
    preferences: {
      get: vi.fn(),
      set: vi.fn(),
    },
    chat: {
      stream: vi.fn(),
    },
    episodic: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    semantic: {
      create: vi.fn(),
    },
  },
}));

// Mock useWebSocket
vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: () => ({
    isConnected: true,
    typingUsers: [],
    sendTyping: vi.fn(),
  }),
}));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

function renderWithClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Chat Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.preferences.get).mockResolvedValue({ value: "default" });
    vi.mocked(api.conversations.list).mockResolvedValue([]);
    vi.mocked(api.episodic.list).mockResolvedValue([]);
  });

  it("renders the chat interface", async () => {
    renderWithClient(<Chat />);
    expect(
      screen.getByPlaceholderText("Type a message..."),
    ).toBeInTheDocument();
    expect(screen.getByTitle("New conversation")).toBeInTheDocument();
  });

  it("loads conversations list", async () => {
    vi.mocked(api.conversations.list).mockResolvedValue([
      {
        id: "1",
        title: "Test Conversation",
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ]);

    renderWithClient(<Chat />);

    expect(await screen.findByText("Test Conversation")).toBeInTheDocument();
  });

  it("creates a new conversation", async () => {
    vi.mocked(api.conversations.create).mockResolvedValue({
      id: "2",
      title: "New Conversation",
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    renderWithClient(<Chat />);

    const newChatBtn = screen.getByTitle("New conversation");
    fireEvent.click(newChatBtn);

    await waitFor(() => {
      expect(api.conversations.create).toHaveBeenCalled();
    });
  });

  it("sends a message", async () => {
    vi.mocked(api.episodic.create).mockResolvedValue({ id: "msg1" });
    vi.mocked(api.chat.stream).mockImplementation(
      async (prompt, history, convId, onToken, onMeta, onComplete) => {
        onToken("Hello");
        onToken(" world");
        onComplete();
      },
    );

    renderWithClient(<Chat />);

    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "Hello" } });

    const sendBtn = screen.getByLabelText("Send");
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(api.episodic.create).toHaveBeenCalledWith(
        "Hello",
        expect.objectContaining({ source_type: "user" }),
        undefined,
      );
    });
  });

  it("displays chat history", async () => {
    vi.mocked(api.episodic.list).mockResolvedValue([
      {
        id: "msg1",
        content: "Hello from user",
        createdAt: Date.now(),
        provenance: { source_type: "user" },
      },
      {
        id: "msg2",
        content: "Hello from AI",
        createdAt: Date.now(),
        provenance: { source_type: "ai" },
      },
    ]);

    renderWithClient(<Chat />);

    expect(await screen.findByText("Hello from user")).toBeInTheDocument();
    expect(await screen.findByText("Hello from AI")).toBeInTheDocument();
  });

  it("deletes a conversation", async () => {
    vi.mocked(api.conversations.list).mockResolvedValue([
      {
        id: "1",
        title: "To Delete",
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ]);
    vi.mocked(api.conversations.delete).mockResolvedValue(undefined);

    renderWithClient(<Chat />);

    await screen.findByText("To Delete");

    const deleteBtn = screen.getByTitle("Delete");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(api.conversations.delete).toHaveBeenCalledWith("1");
    });
  });

  it("renames a conversation", async () => {
    vi.mocked(api.conversations.list).mockResolvedValue([
      {
        id: "1",
        title: "Old Title",
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ]);
    vi.mocked(api.conversations.rename).mockResolvedValue({
      id: "1",
      title: "New Title",
    });

    renderWithClient(<Chat />);

    await screen.findByText("Old Title");

    const renameBtn = screen.getByTitle("Rename");
    fireEvent.click(renameBtn);

    const input = screen.getByDisplayValue("Old Title");
    fireEvent.change(input, { target: { value: "New Title" } });

    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(api.conversations.rename).toHaveBeenCalledWith("1", "New Title");
    });
  });

  it("edits a message", async () => {
    vi.mocked(api.episodic.list).mockResolvedValue([
      {
        id: "msg1",
        content: "Typo",
        createdAt: Date.now(),
        provenance: { source_type: "user" },
      },
    ]);
    vi.mocked(api.episodic.update).mockResolvedValue({
      id: "msg1",
      content: "Fixed",
    });

    renderWithClient(<Chat />);

    await screen.findByText("Typo");

    const editBtn = screen.getByTitle("Edit message");
    fireEvent.click(editBtn);

    const textarea = screen.getByDisplayValue("Typo");
    fireEvent.change(textarea, { target: { value: "Fixed" } });

    const saveBtn = screen.getByTitle("Save edit");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.episodic.update).toHaveBeenCalledWith("msg1", "Fixed");
    });
  });

  it("handles voice recording (mocked)", async () => {
    const mockMediaRecorder = {
      start: vi.fn(),
      stop: vi.fn(),
      ondataavailable: vi.fn(),
      onstop: vi.fn(),
    };

    Object.defineProperty(window.navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
      writable: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).MediaRecorder = vi.fn(() => mockMediaRecorder);

    renderWithClient(<Chat />);

    const micBtn = screen.getByTitle("Voice Chat");
    fireEvent.click(micBtn);

    await waitFor(() => {
      expect(window.navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      expect(mockMediaRecorder.start).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTitle("Stop Recording"));
    expect(mockMediaRecorder.stop).toHaveBeenCalled();
  });
});
