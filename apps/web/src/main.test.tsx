// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./index.css", () => ({}));

vi.mock("./lib/errorLog", () => {
  return {
    installGlobalErrorHandlers: vi.fn(),
  };
});

vi.mock("./App", () => ({
  default: () => React.createElement("div", null, "app"),
}));

vi.mock("./components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

const renderMock = vi.fn();
vi.mock("react-dom/client", () => ({
  default: {
    createRoot: () => ({ render: renderMock }),
  },
  createRoot: () => ({ render: renderMock }),
}));

describe("entrypoints", () => {
  it("imports main.tsx without throwing and renders root", async () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations: vi.fn(async () => []),
        register: vi.fn(async () => ({})),
      },
    });

    await import("./main");
    expect(renderMock).toHaveBeenCalledTimes(1);
  });
});
