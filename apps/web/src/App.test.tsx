import { fireEvent, render, screen } from "@testing-library/react";
import { Outlet } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("./components/CommandPalette", () => {
  return {
    CommandPalette: (props: { isOpen: boolean; onClose: () => void }) => (
      <div>
        <div data-testid="cmdk-state">{props.isOpen ? "open" : "closed"}</div>
        <button onClick={props.onClose}>close</button>
      </div>
    ),
  };
});

vi.mock("./components/Layout", () => {
  return {
    Layout: () => (
      <div>
        <div>layout</div>
        <Outlet />
      </div>
    ),
  };
});

// Avoid pulling in real pages for this test.
vi.mock("./pages/Chat", () => ({ Chat: () => <div>chat</div> }));
vi.mock("./pages/Memory", () => ({ Memory: () => <div>memory</div> }));
vi.mock("./pages/Identity", () => ({ Identity: () => <div>identity</div> }));
vi.mock("./pages/Receipts", () => ({ Receipts: () => <div>receipts</div> }));
vi.mock("./pages/Settings", () => ({ Settings: () => <div>settings</div> }));
vi.mock("./pages/SystemStatus", () => ({
  SystemStatus: () => <div>status</div>,
}));
vi.mock("./pages/Logs", () => ({ Logs: () => <div>logs</div> }));
vi.mock("./pages/Analytics", () => ({ Analytics: () => <div>analytics</div> }));
vi.mock("./pages/Knowledge", () => ({ Knowledge: () => <div>knowledge</div> }));
vi.mock("./pages/Insights", () => ({ Insights: () => <div>insights</div> }));
vi.mock("./pages/UILab", () => ({ UILab: () => <div>ui-lab</div> }));

import App from "./App";

describe("App", () => {
  function stubMatchMedia() {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => true,
      }),
    });
  }

  it("toggles command palette on Cmd/Ctrl+K and supports onClose", async () => {
    stubMatchMedia();
    render(<App />);

    expect(screen.getByTestId("cmdk-state").textContent).toBe("closed");

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByTestId("cmdk-state").textContent).toBe("open");

    fireEvent.click(screen.getByText("close"));
    expect(screen.getByTestId("cmdk-state").textContent).toBe("closed");
  });

  it("prevents default on Cmd/Ctrl+K", async () => {
    stubMatchMedia();
    render(<App />);

    const ev = new KeyboardEvent("keydown", { key: "k", ctrlKey: true });
    const prevent = vi.spyOn(ev, "preventDefault");

    window.dispatchEvent(ev);

    expect(prevent).toHaveBeenCalled();
  });
});
