import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UILab } from "./UILab";

describe("UILab", () => {
  it("renders and supports input + error interactions", () => {
    render(<UILab />);

    // Default error message is present.
    expect(screen.getByText("This is an error message")).toBeInTheDocument();

    // Change the Search input.
    const searchInput = screen.getByLabelText("Search") as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "hello" } });
    expect(searchInput.value).toBe("hello");

    // Click the button to change the error state.
    fireEvent.click(screen.getByText("Trigger Error State"));
    expect(screen.getByText("Validation failed!")).toBeInTheDocument();
  });
});
