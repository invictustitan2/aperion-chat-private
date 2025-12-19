import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AllMessagesEmptyState,
  EmptyConversationState,
  ErrorState,
  NoConversationsState,
} from "./EmptyStates";

describe("EmptyStates", () => {
  describe("NoConversationsState", () => {
    it("renders with correct message and CTA", () => {
      render(<NoConversationsState onCreate={vi.fn()} />);

      expect(screen.getByText("No conversations yet")).toBeInTheDocument();
      expect(
        screen.getByText(/Start a new conversation to begin chatting/i),
      ).toBeInTheDocument();
      expect(screen.getByText("Start Conversation")).toBeInTheDocument();
    });

    it("calls onCreate when CTA is clicked", () => {
      const handleCreate = vi.fn();
      render(<NoConversationsState onCreate={handleCreate} />);

      const button = screen.getByText("Start Conversation");
      fireEvent.click(button);

      expect(handleCreate).toHaveBeenCalled();
    });
  });

  describe("EmptyConversationState", () => {
    it("renders with correct message", () => {
      render(<EmptyConversationState />);

      expect(screen.getByText("No messages")).toBeInTheDocument();
      expect(
        screen.getByText(/This conversation is empty/i),
      ).toBeInTheDocument();
    });

    it("does not render a CTA button", () => {
      render(<EmptyConversationState />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("AllMessagesEmptyState", () => {
    it("renders welcome message", () => {
      render(<AllMessagesEmptyState />);

      expect(screen.getByText("Welcome to Aperion")).toBeInTheDocument();
      expect(
        screen.getByText(/memory-backed AI assistant/i),
      ).toBeInTheDocument();
    });
  });

  describe("ErrorState", () => {
    it("renders error message", () => {
      render(<ErrorState message="Connection failed" />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("Connection failed")).toBeInTheDocument();
    });

    it("renders retry button when onRetry is provided", () => {
      const handleRetry = vi.fn();
      render(<ErrorState message="Failed" onRetry={handleRetry} />);

      expect(screen.getByText("Try Again")).toBeInTheDocument();
    });

    it("calls onRetry when retry button is clicked", () => {
      const handleRetry = vi.fn();
      render(<ErrorState message="Failed" onRetry={handleRetry} />);

      const button = screen.getByText("Try Again");
      fireEvent.click(button);

      expect(handleRetry).toHaveBeenCalled();
    });

    it("does not render retry button when onRetry is not provided", () => {
      render(<ErrorState message="Failed" />);

      expect(screen.queryByText("Try Again")).not.toBeInTheDocument();
    });
  });
});
