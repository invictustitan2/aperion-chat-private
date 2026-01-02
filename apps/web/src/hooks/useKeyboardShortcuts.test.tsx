// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useKeyboardShortcuts, ShortcutHints } from "./useKeyboardShortcuts";

function Harness() {
  const { shortcuts } = useKeyboardShortcuts();
  const loc = useLocation();
  return (
    <div>
      <div data-testid="path">{loc.pathname}</div>
      <input aria-label="msg" placeholder="message" />
      <ShortcutHints shortcuts={shortcuts} />
    </div>
  );
}

describe("useKeyboardShortcuts", () => {
  it("navigates on shortcuts and ignores input typing", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Harness />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("path").textContent).toBe("/");

    // Ctrl+M (meta shortcut) -> /memory
    fireEvent.keyDown(window, { key: "m", ctrlKey: true });
    expect(screen.getByTestId("path").textContent).toBe("/memory");

    // When typing in an input, shortcuts should not trigger (except Escape).
    const input = screen.getByLabelText("msg") as HTMLInputElement;
    input.focus();

    fireEvent.keyDown(input, { key: ",", ctrlKey: true });
    expect(screen.getByTestId("path").textContent).toBe("/memory");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(document.activeElement).not.toBe(input);
  });
});
