// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageContent } from "./MessageContent";

// Mock mermaid
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: "<svg>mock mermaid</svg>" }),
  },
}));

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

  it("renders markdown links with target blank", () => {
    render(<MessageContent content="[Link](https://example.com)" />);
    const link = screen.getByRole("link", { name: "Link" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
  });

  it("renders inline code", () => {
    render(<MessageContent content="`const x = 1`" />);
    const code = screen.getByText("const x = 1");
    expect(code.tagName).toBe("CODE");
    // Inline code shouldn't have language class
    expect(code.className).not.toContain("language-");
  });

  it("renders mermaid diagrams", async () => {
    const content = "```mermaid\ngraph TD;\nA-->B;\n```";
    render(<MessageContent content={content} />);

    expect(screen.getByText("mermaid")).toBeInTheDocument();
    expect(screen.getByText("Rendering diagram…")).toBeInTheDocument();

    await waitFor(() => {
      // We check for the mock SVG content or the container that holds it
      // Since we dangerouslySetInnerHTML, we can look for the text inside the SVG if possible
      // But our mock returns <svg>mock mermaid</svg>
      // However, the component might wrap it.
      // Let's check if the loading text disappears.
      expect(screen.queryByText("Rendering diagram…")).not.toBeInTheDocument();
    });
  });

  it("renders tables", () => {
    const content =
      "| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |";
    render(<MessageContent content={content} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Header 1")).toBeInTheDocument();
    expect(screen.getByText("Cell 1")).toBeInTheDocument();
  });
});
