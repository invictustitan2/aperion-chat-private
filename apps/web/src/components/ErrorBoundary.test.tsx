// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders a custom fallback", () => {
    function Thrower() {
      throw new Error("boom");
      return null;
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
