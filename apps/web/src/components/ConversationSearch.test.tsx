import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConversationSearch } from "./ConversationSearch";

describe("ConversationSearch", () => {
  it("renders search input with placeholder", () => {
    render(<ConversationSearch onSearchChange={vi.fn()} />);

    expect(
      screen.getByPlaceholderText("Search conversations..."),
    ).toBeInTheDocument();
  });

  it("calls onSearchChange when user types", () => {
    const handleSearchChange = vi.fn();
    render(<ConversationSearch onSearchChange={handleSearchChange} />);

    const input = screen.getByPlaceholderText("Search conversations...");
    fireEvent.change(input, { target: { value: "test query" } });

    expect(handleSearchChange).toHaveBeenCalledWith("test query");
  });

  it("shows clear button when input has value", () => {
    render(<ConversationSearch onSearchChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("Search conversations...");

    // Initially no clear button
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();

    // Type something
    fireEvent.change(input, { target: { value: "test" } });

    // Now clear button should appear
    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();
  });

  it("clears search when clear button is clicked", () => {
    const handleSearchChange = vi.fn();
    render(<ConversationSearch onSearchChange={handleSearchChange} />);

    const input = screen.getByPlaceholderText(
      "Search conversations...",
    ) as HTMLInputElement;

    // Type something
    fireEvent.change(input, { target: { value: "test" } });
    expect(input.value).toBe("test");

    // Click clear
    const clearButton = screen.getByLabelText("Clear search");
    fireEvent.click(clearButton);

    expect(input.value).toBe("");
    expect(handleSearchChange).toHaveBeenCalledWith("");
  });

  it("uses custom placeholder when provided", () => {
    render(
      <ConversationSearch
        onSearchChange={vi.fn()}
        placeholder="Find a chat..."
      />,
    );

    expect(screen.getByPlaceholderText("Find a chat...")).toBeInTheDocument();
  });

  it("is keyboard accessible - input can be focused", () => {
    render(<ConversationSearch onSearchChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("Search conversations...");
    input.focus();

    expect(document.activeElement).toBe(input);
  });
});
