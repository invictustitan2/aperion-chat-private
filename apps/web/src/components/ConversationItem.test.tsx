import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConversationItem, type Conversation } from "./ConversationItem";

describe("ConversationItem", () => {
  const mockConversation: Conversation = {
    id: "conv-1",
    title: "Test Conversation",
    updatedAt: Date.now() - 300000, // 5 minutes ago
    lastMessage: "This is the last message preview",
  };

  const defaultProps = {
    conversation: mockConversation,
    isActive: false,
    onClick: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onStartRename: vi.fn(),
    onCancelRename: vi.fn(),
  };

  it("renders conversation title and metadata", () => {
    render(<ConversationItem {...defaultProps} />);

    expect(screen.getByText("Test Conversation")).toBeInTheDocument();
    expect(
      screen.getByText("This is the last message preview"),
    ).toBeInTheDocument();
    expect(screen.getByText(/5m ago/)).toBeInTheDocument();
  });

  it("applies active styling when isActive is true", () => {
    render(<ConversationItem {...defaultProps} isActive={true} />);

    const button = screen.getByRole("button", { current: "page" });
    expect(button).toHaveClass("text-emerald-300");
  });

  it("calls onClick when conversation is clicked", () => {
    const handleClick = vi.fn();
    render(<ConversationItem {...defaultProps} onClick={handleClick} />);

    const button = screen.getByTitle("Test Conversation");
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalled();
  });

  it("shows rename input when isRenaming is true", () => {
    render(
      <ConversationItem
        {...defaultProps}
        isRenaming={true}
        renameDraft="New Title"
      />,
    );

    const input = screen.getByLabelText("Rename conversation");
    expect(input).toHaveValue("New Title");
  });

  it("saves rename on Enter key", () => {
    const handleRename = vi.fn();
    render(
      <ConversationItem
        {...defaultProps}
        isRenaming={true}
        renameDraft="New Title"
        onRename={handleRename}
      />,
    );

    const input = screen.getByLabelText("Rename conversation");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(handleRename).toHaveBeenCalledWith("conv-1", "New Title");
  });

  it("cancels rename on Escape key", () => {
    const handleCancelRename = vi.fn();
    render(
      <ConversationItem
        {...defaultProps}
        isRenaming={true}
        onCancelRename={handleCancelRename}
      />,
    );

    const input = screen.getByLabelText("Rename conversation");
    fireEvent.keyDown(input, { key: "Escape" });

    expect(handleCancelRename).toHaveBeenCalled();
  });

  it("shows rename and delete buttons on hover", () => {
    render(<ConversationItem {...defaultProps} />);

    expect(
      screen.getByLabelText("Rename Test Conversation"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Delete Test Conversation"),
    ).toBeInTheDocument();
  });

  it("calls onStartRename when rename button is clicked", () => {
    const handleStartRename = vi.fn();
    render(
      <ConversationItem {...defaultProps} onStartRename={handleStartRename} />,
    );

    const renameButton = screen.getByLabelText("Rename Test Conversation");
    fireEvent.click(renameButton);

    expect(handleStartRename).toHaveBeenCalledWith(
      "conv-1",
      "Test Conversation",
    );
  });

  it("calls onDelete when delete button is clicked", () => {
    const handleDelete = vi.fn();
    render(<ConversationItem {...defaultProps} onDelete={handleDelete} />);

    const deleteButton = screen.getByLabelText("Delete Test Conversation");
    fireEvent.click(deleteButton);

    expect(handleDelete).toHaveBeenCalledWith("conv-1");
  });

  it("is keyboard accessible - rename button is focusable", () => {
    render(<ConversationItem {...defaultProps} />);

    const renameButton = screen.getByLabelText("Rename Test Conversation");
    renameButton.focus();

    expect(document.activeElement).toBe(renameButton);
  });

  it("is keyboard accessible - delete button is focusable", () => {
    render(<ConversationItem {...defaultProps} />);

    const deleteButton = screen.getByLabelText("Delete Test Conversation");
    deleteButton.focus();

    expect(document.activeElement).toBe(deleteButton);
  });
});
