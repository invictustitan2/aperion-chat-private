// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, beforeEach } from "vitest";
import { Errors } from "./Errors";
import { clearErrorEntries, logApiError } from "../lib/errorLog";

describe("Errors page", () => {
  beforeEach(() => {
    clearErrorEntries();
    window.localStorage.clear();
  });

  it("shows empty state", () => {
    render(<Errors />);
    expect(
      screen.getByText("No errors recorded in this browser yet."),
    ).toBeInTheDocument();
  });

  it("renders logged API error", () => {
    logApiError({
      url: "http://localhost:8787/v1/episodic",
      method: "GET",
      status: 401,
      message: "Unauthorized",
      responseBody: '{"error":"Unauthorized"}',
    });
    render(<Errors />);
    expect(screen.getByText("Unauthorized")).toBeInTheDocument();
    expect(
      screen.getByText(/GET http:\/\/localhost:8787\/v1\/episodic/),
    ).toBeInTheDocument();
  });
});
