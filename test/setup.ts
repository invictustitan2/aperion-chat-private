// Single, repo-wide Vitest setup.
// Keeps config sprawl low by conditionally applying DOM-only setup.

import { afterEach } from "vitest";

afterEach(() => {
  // Placeholder hook: safe for all environments.
});

if (typeof window !== "undefined" && typeof document !== "undefined") {
  // JSDOM-only setup.
  await import("@testing-library/jest-dom");
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => {
    cleanup();
  });
}
