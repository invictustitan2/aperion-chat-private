// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BrowserRouter } from "react-router-dom";
import { Layout } from "./Layout";
import { describe, it, expect } from "vitest";

describe("Layout", () => {
  it("renders navigation links", () => {
    render(
      <BrowserRouter>
        <Layout />
      </BrowserRouter>,
    );

    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Memory")).toBeInTheDocument();
    expect(screen.getByText("Receipts")).toBeInTheDocument();
    expect(screen.getByText("Errors")).toBeInTheDocument();
  });
});
