// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageContent } from "./MessageContent";

describe("MessageContent", () => {
  it("renders fenced code blocks and supports expand/collapse", () => {
    const code = Array.from({ length: 13 }, (_, i) => `line${i + 1}`).join(
      "\n",
    );
    const content = `Hello\n\n\`\`\`ts\n${code}\n\`\`\`\n\nBye`;

    const { container } = render(<MessageContent content={content} />);

    const getCodeText = () =>
      (container.querySelector("code")?.textContent || "").trim();

    // Collapsed: first 12 lines visible, 13th hidden.
    expect(screen.getByText("Expand")).toBeInTheDocument();
    expect(getCodeText()).toContain("line12");
    expect(getCodeText()).not.toContain("line13");

    fireEvent.click(screen.getByText("Expand"));
    expect(screen.getByText("Collapse")).toBeInTheDocument();
    expect(getCodeText()).toContain("line13");

    fireEvent.click(screen.getByText("Collapse"));
    expect(screen.getByText("Expand")).toBeInTheDocument();
    expect(getCodeText()).not.toContain("line13");
  });
});
