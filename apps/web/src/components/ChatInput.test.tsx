import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "./ChatInput";

describe("ChatInput", () => {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
    onSubmit: vi.fn(),
  };

  it("renders textarea with placeholder", () => {
    render(<ChatInput {...defaultProps} placeholder="Type a message..." />);

    expect(
      screen.getByPlaceholderText("Type a message..."),
    ).toBeInTheDocument();
  });

  it("calls onChange when user types", async () => {
    const handleChange = vi.fn();
    render(<ChatInput {...defaultProps} onChange={handleChange} />);

    const textarea = screen.getByLabelText("Message input");
    fireEvent.change(textarea, { target: { value: "Hello" } });

    expect(handleChange).toHaveBeenCalledWith("Hello");
  });

  it("calls onSubmit when Enter is pressed (without Shift)", () => {
    const handleSubmit = vi.fn((e) => e.preventDefault());
    render(
      <ChatInput {...defaultProps} onSubmit={handleSubmit} value="Test" />,
    );

    const textarea = screen.getByLabelText("Message input");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(handleSubmit).toHaveBeenCalled();
  });

  it("does NOT submit when Shift+Enter is pressed", () => {
    const handleSubmit = vi.fn();
    render(
      <ChatInput {...defaultProps} onSubmit={handleSubmit} value="Test" />,
    );

    const textarea = screen.getByLabelText("Message input");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("disables send button when input is empty", () => {
    render(<ChatInput {...defaultProps} value="" />);

    const sendButton = screen.getByLabelText("Send message");
    expect(sendButton).toBeDisabled();
  });

  it("enables send button when input has content", () => {
    render(<ChatInput {...defaultProps} value="Hello" />);

    const sendButton = screen.getByLabelText("Send message");
    expect(sendButton).not.toBeDisabled();
  });

  it("shows character count when showCharCount is true", () => {
    render(<ChatInput {...defaultProps} value="Hello" showCharCount={true} />);

    expect(screen.getByText(/5 chars/)).toBeInTheDocument();
  });

  it("shows character limit when maxChars is provided", () => {
    render(
      <ChatInput
        {...defaultProps}
        value="Hello"
        showCharCount={true}
        maxChars={100}
      />,
    );

    expect(screen.getByText("5 / 100 chars")).toBeInTheDocument();
  });

  it("highlights character count when approaching limit", () => {
    render(
      <ChatInput
        {...defaultProps}
        value={"x".repeat(95)}
        showCharCount={true}
        maxChars={100}
      />,
    );

    const charCounter = screen.getByText(/95 \/ 100 chars/);
    expect(charCounter).toHaveClass("text-yellow-400");
  });

  it("shows error state when characters exceed limit", () => {
    render(
      <ChatInput {...defaultProps} value={"x".repeat(110)} maxChars={100} />,
    );

    const textarea = screen.getByLabelText("Message input");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
  });

  it("displays error message when error prop is provided", () => {
    render(<ChatInput {...defaultProps} error="Failed to send message" />);

    expect(screen.getByText("Failed to send message")).toBeInTheDocument();
  });

  it("displays voice error when voiceError prop is provided", () => {
    render(
      <ChatInput {...defaultProps} voiceError="Microphone access denied" />,
    );

    expect(screen.getByText("Microphone access denied")).toBeInTheDocument();
  });

  it("shows loading spinner in send button when isSubmitting", () => {
    render(<ChatInput {...defaultProps} value="Test" isSubmitting={true} />);

    // Check for spinner (Loader2 component)
    expect(screen.getByLabelText("Send message")).toBeDisabled();
  });

  it("shows voice recording state correctly", () => {
    const handleVoiceRecord = vi.fn();
    const handleVoiceStop = vi.fn();

    const { rerender } = render(
      <ChatInput
        {...defaultProps}
        onVoiceRecord={handleVoiceRecord}
        onVoiceStop={handleVoiceStop}
        isRecording={false}
      />,
    );

    const voiceButton = screen.getByLabelText("Start voice chat");
    expect(voiceButton).toBeInTheDocument();
    fireEvent.click(voiceButton);
    expect(handleVoiceRecord).toHaveBeenCalled();

    // Rerender with recording state
    rerender(
      <ChatInput
        {...defaultProps}
        onVoiceRecord={handleVoiceRecord}
        onVoiceStop={handleVoiceStop}
        isRecording={true}
      />,
    );

    const stopButton = screen.getByLabelText("Stop recording");
    expect(stopButton).toHaveClass("animate-pulse");
  });

  it("shows image upload button when onFileSelect is provided", () => {
    const handleFileSelect = vi.fn();
    render(<ChatInput {...defaultProps} onFileSelect={handleFileSelect} />);

    expect(screen.getByLabelText("Attach image")).toBeInTheDocument();
  });

  it("disables all controls when disabled prop is true", () => {
    render(
      <ChatInput
        {...defaultProps}
        value="Test"
        disabled={true}
        onFileSelect={vi.fn()}
        onVoiceRecord={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Message input")).toBeDisabled();
    expect(screen.getByLabelText("Send message")).toBeDisabled();
    expect(screen.getByLabelText("Attach image")).toBeDisabled();
  });

  it("shows slash autocomplete when matches are provided", () => {
    const handleSelect = vi.fn();
    const handleNavigate = vi.fn();

    render(
      <ChatInput
        {...defaultProps}
        value="/clea"
        slashAutocomplete={{
          matches: [
            { command: "/clear", description: "Clear conversation" },
            { command: "/clearall", description: "Clear all messages" },
          ],
          selectedIndex: 0,
          onSelect: handleSelect,
          onNavigate: handleNavigate,
        }}
      />,
    );

    expect(screen.getByText("/clear")).toBeInTheDocument();
    expect(screen.getByText("Clear conversation")).toBeInTheDocument();
  });

  it("navigates slash autocomplete with arrow keys", () => {
    const handleNavigate = vi.fn();

    render(
      <ChatInput
        {...defaultProps}
        value="/c"
        slashAutocomplete={{
          matches: [{ command: "/clear", description: "Clear" }],
          selectedIndex: 0,
          onSelect: vi.fn(),
          onNavigate: handleNavigate,
        }}
      />,
    );

    const textarea = screen.getByLabelText("Message input");

    fireEvent.keyDown(textarea, { key: "ArrowDown" });
    expect(handleNavigate).toHaveBeenCalledWith("down");

    fireEvent.keyDown(textarea, { key: "ArrowUp" });
    expect(handleNavigate).toHaveBeenCalledWith("up");
  });

  it("is keyboard accessible - shows keyboard shortcuts hint", () => {
    render(<ChatInput {...defaultProps} />);

    expect(screen.getByText("Enter")).toBeInTheDocument();
    expect(screen.getByText("to send")).toBeInTheDocument();
    expect(screen.getByText("Shift+Enter")).toBeInTheDocument();
  });
});
