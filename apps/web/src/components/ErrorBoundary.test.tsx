// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders a custom fallback", () => {
    function Thrower() {
      throw new Error("boom");
    }

    render(
      <ErrorBoundary fallback={<div>fallback-ui</div>}>
        <Thrower />
      </ErrorBoundary>,
    );

    expect(screen.getByText("fallback-ui")).toBeInTheDocument();
  });

  it("can retry after an error", async () => {
    let shouldThrow = true;
    function MaybeThrow() {
      if (shouldThrow) throw new Error("boom");
      return <div>ok</div>;
    }

    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Allow the next render attempt to succeed.
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(screen.getByText("ok")).toBeInTheDocument();
  });
});
