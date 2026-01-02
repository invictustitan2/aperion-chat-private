// @vitest-environment jsdom
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@radix-ui/react-dialog", async () => {
  const React = await import("react");
  const passthrough = ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  );

  return {
    Root: passthrough,
    Trigger: passthrough,
    Close: passthrough,
    Portal: passthrough,
    Overlay: React.forwardRef<HTMLDivElement, Record<string, unknown>>(
      (props, ref) => <div ref={ref} {...props} />,
    ),
    Content: React.forwardRef<HTMLDivElement, Record<string, unknown>>(
      (props, ref) => <div ref={ref} data-state="open" {...props} />,
    ),
    Title: React.forwardRef<HTMLHeadingElement, Record<string, unknown>>(
      (props, ref) => <h2 ref={ref} {...props} />,
    ),
    Description: React.forwardRef<
      HTMLParagraphElement,
      Record<string, unknown>
    >((props, ref) => <p ref={ref} {...props} />),
  };
});

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./Dialog";

describe("Dialog wrappers", () => {
  it("renders modal and sheet variants", () => {
    const { rerender } = render(
      <Dialog>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Description</DialogDescription>
          </DialogHeader>
          <DialogBody>Body</DialogBody>
          <DialogFooter>Footer</DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();

    rerender(
      <Dialog>
        <DialogContent variant="sheet" sheetSide="left">
          <DialogBody>Sheet</DialogBody>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByText("Sheet")).toBeInTheDocument();
  });
});
