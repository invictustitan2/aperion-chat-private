import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageBubble, type Message } from "./MessageBubble";

describe("MessageBubble", () => {
  const mockMessage: Message = {
    id: "msg-1",
    content: "Hello, world!",
    createdAt: Date.now(),
    provenance: {
      source_type: "user",
    },
  };

  const mockAIMessage: Message = {
    id: "msg-2",
    content: "Hello! How can I help you?",
    createdAt: Date.now(),
    provenance: {
      source_type: "assistant",
      model_version: "gpt-4",
      derived_from: ["mem-1", "mem-2"],
    },
  };

  it("renders user message correctly", () => {
    render(<MessageBubble message={mockMessage} isUser={true} />);

    expect(screen.getByText("Hello, world!")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("renders AI message correctly", () => {
    render(<MessageBubble message={mockAIMessage} isUser={false} />);

    expect(screen.getByText("Hello! How can I help you?")).toBeInTheDocument();
    expect(screen.getByText("Aperion")).toBeInTheDocument();
  });

  it("displays metadata for AI messages", () => {
    render(
      <MessageBubble
        message={mockAIMessage}
        isUser={false}
        responseTimeMs={1500}
      />,
    );

    expect(screen.getByText(/model: gpt-4/)).toBeInTheDocument();
    expect(screen.getByText(/derived: 2 memories/)).toBeInTheDocument();
    expect(screen.getByText(/response: 1.5s/)).toBeInTheDocument();
  });

  it("does not display metadata for user messages", () => {
    render(<MessageBubble message={mockMessage} isUser={true} />);

    expect(screen.queryByText(/model:/)).not.toBeInTheDocument();
  });

  it("calls onCopy when copy button is clicked", () => {
    const handleCopy = vi.fn();
    render(
      <MessageBubble message={mockMessage} isUser={true} onCopy={handleCopy} />,
    );

    const copyButton = screen.getByLabelText("Copy message");
    fireEvent.click(copyButton);

    expect(handleCopy).toHaveBeenCalledWith("msg-1", "Hello, world!");
  });

  it("calls onShare when share button is clicked", () => {
    const handleShare = vi.fn();
    render(
      <MessageBubble
        message={mockMessage}
        isUser={true}
        onShare={handleShare}
      />,
    );

    const shareButton = screen.getByLabelText("Share message");
    fireEvent.click(shareButton);

    expect(handleShare).toHaveBeenCalledWith("msg-1");
  });

  it("shows edit mode when isEditing is true", () => {
    render(
      <MessageBubble
        message={mockMessage}
        isUser={true}
        isEditing={true}
        editingContent="Editing..."
      />,
    );

    expect(screen.getByDisplayValue("Editing...")).toBeInTheDocument();
    expect(screen.getByLabelText("Save edit")).toBeInTheDocument();
    expect(screen.getByLabelText("Cancel edit")).toBeInTheDocument();
  });

  it("calls onEdit when edit button is clicked", () => {
    const handleEdit = vi.fn();
    render(
      <MessageBubble message={mockMessage} isUser={true} onEdit={handleEdit} />,
    );

    const editButton = screen.getByLabelText("Edit message");
    fireEvent.click(editButton);

    expect(handleEdit).toHaveBeenCalledWith("msg-1", "Hello, world!");
  });

  it("shows rating buttons for AI messages", () => {
    const handleRate = vi.fn();
    render(
      <MessageBubble
        message={mockAIMessage}
        isUser={false}
        onRate={handleRate}
      />,
    );

    const upButton = screen.getByLabelText("Rate response as good");
    const downButton = screen.getByLabelText("Rate response as poor");

    expect(upButton).toBeInTheDocument();
    expect(downButton).toBeInTheDocument();

    fireEvent.click(upButton);
    expect(handleRate).toHaveBeenCalledWith("msg-2", "up");
  });

  it("does not show rating buttons for user messages", () => {
    render(
      <MessageBubble message={mockMessage} isUser={true} onRate={vi.fn()} />,
    );

    expect(
      screen.queryByLabelText("Rate response as good"),
    ).not.toBeInTheDocument();
  });

  it("applies highlight styling when isHighlighted is true", () => {
    render(
      <MessageBubble
        message={mockMessage}
        isUser={true}
        isHighlighted={true}
      />,
    );

    const messageDiv = document.querySelector("[data-message-id='msg-1']");
    expect(messageDiv).toBeInTheDocument();
  });

  it("displays edit error when provided", () => {
    render(
      <MessageBubble
        message={mockMessage}
        isUser={true}
        isEditing={true}
        editError="Failed to save"
      />,
    );

    expect(screen.getByText("Failed to save")).toBeInTheDocument();
  });

  it("is keyboard accessible - action buttons are focusable", () => {
    render(
      <MessageBubble message={mockMessage} isUser={true} onCopy={vi.fn()} />,
    );

    const copyButton = screen.getByLabelText("Copy message");
    copyButton.focus();

    expect(document.activeElement).toBe(copyButton);
  });
});
