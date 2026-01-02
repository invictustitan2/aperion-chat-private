import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@radix-ui/react-toast", () => {
  return {
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Viewport: React.forwardRef(
      (
        props: { children?: React.ReactNode },
        ref: React.ForwardedRef<HTMLDivElement>,
      ) => <div ref={ref} {...props} />,
    ),
    Root: React.forwardRef(
      (
        props: { open?: boolean; children?: React.ReactNode },
        ref: React.ForwardedRef<HTMLDivElement>,
      ) => (props.open ? <div ref={ref}>{props.children}</div> : null),
    ),
    Title: React.forwardRef(
      (
        props: { children?: React.ReactNode },
        ref: React.ForwardedRef<HTMLDivElement>,
      ) => <div ref={ref}>{props.children}</div>,
    ),
    Description: React.forwardRef(
      (
        props: { children?: React.ReactNode },
        ref: React.ForwardedRef<HTMLDivElement>,
      ) => <div ref={ref}>{props.children}</div>,
    ),
    Action: React.forwardRef(
      (
        props: { children?: React.ReactNode },
        ref: React.ForwardedRef<HTMLDivElement>,
      ) => <div ref={ref}>{props.children}</div>,
    ),
    Close: React.forwardRef(
      (
        props: { children?: React.ReactNode },
        ref: React.ForwardedRef<HTMLButtonElement>,
      ) => <button ref={ref}>{props.children}</button>,
    ),
  };
});

import { ToastProvider, ToastViewport, useSimpleToast } from "./Toast";

function Harness() {
  const { show, toast } = useSimpleToast();
  return (
    <ToastProvider>
      <ToastViewport />
      <button onClick={() => show({ title: "Hello" })}>show-title</button>
      <button onClick={() => show({ title: "Hello", description: "World" })}>
        show-both
      </button>
      {toast}
    </ToastProvider>
  );
}

describe("useSimpleToast", () => {
  it("renders title-only and title+description", async () => {
    render(<Harness />);

    fireEvent.click(screen.getByText("show-title"));
    expect(await screen.findByText("Hello")).toBeInTheDocument();

    fireEvent.click(screen.getByText("show-both"));
    expect(await screen.findByText("World")).toBeInTheDocument();
  });
});
