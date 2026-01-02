import { describe, expect, it } from "vitest";

import { createShortcutUrl } from "../src/shortcuts";

describe("packages/shared shortcuts", () => {
  it("creates a shortcuts:// URL with encoded params", () => {
    const url = createShortcutUrl("My Shortcut", "text", "hello world");
    expect(url).toBe(
      "shortcuts://run-shortcut?name=My%20Shortcut&input=text&text=hello%20world",
    );
  });
});
