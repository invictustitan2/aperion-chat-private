// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Identity } from "./Identity";
import { api } from "../lib/api";

// Mock the API
vi.mock("../lib/api", () => ({
  api: {
    identity: {
      list: vi.fn(),
      create: vi.fn(),
    },
  },
}));

function renderWithClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("Identity Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the header and loading state", () => {
    vi.mocked(api.identity.list).mockReturnValue(new Promise(() => {})); // Pending promise
    renderWithClient(<Identity />);

    expect(screen.getByText("Identity & Preferences")).toBeInTheDocument();
    expect(screen.getByText("Loading identities...")).toBeInTheDocument();
  });

  it("renders empty state", async () => {
    vi.mocked(api.identity.list).mockResolvedValue([]);
    renderWithClient(<Identity />);

    expect(
      await screen.findByText("No identities stored yet."),
    ).toBeInTheDocument();
  });

  it("renders identity list and preferences", async () => {
    const mockIdentities = [
      {
        key: "user_preferences",
        value: { preferredTone: "formal" },
        preferredTone: "formal",
        memoryRetentionDays: 60,
        interfaceTheme: "light",
      },
      {
        key: "user_name",
        value: "Alice",
        lastVerified: Date.now(),
      },
    ];
    vi.mocked(api.identity.list).mockResolvedValue(mockIdentities);

    renderWithClient(<Identity />);

    // Check preferences
    expect(
      await screen.findByDisplayValue("Formal & Concise"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("60")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Light Mode")).toBeInTheDocument();

    // Check identity list
    expect(screen.getByText("user_name")).toBeInTheDocument();
    expect(screen.getByText('"Alice"')).toBeInTheDocument();
  });

  it("updates preferences", async () => {
    vi.mocked(api.identity.list).mockResolvedValue([]);
    vi.mocked(api.identity.create).mockResolvedValue({});

    renderWithClient(<Identity />);

    const toneSelect = await screen.findByLabelText("Preferred Tone");
    fireEvent.change(toneSelect, { target: { value: "pirate" } });

    await waitFor(() => {
      expect(api.identity.create).toHaveBeenCalledWith(
        "user_preferences",
        { note: "Global user preferences" },
        expect.objectContaining({ source_type: "system" }),
        expect.objectContaining({ preferred_tone: "pirate" }),
      );
    });
  });

  it("creates a new identity", async () => {
    vi.mocked(api.identity.list).mockResolvedValue([]);
    vi.mocked(api.identity.create).mockResolvedValue({});

    renderWithClient(<Identity />);

    fireEvent.change(screen.getByPlaceholderText("Key (e.g., user_name)"), {
      target: { value: "new_key" },
    });
    fireEvent.change(
      screen.getByPlaceholderText('Value (JSON, e.g., "John Doe")'),
      {
        target: { value: '"New Value"' },
      },
    );

    fireEvent.click(screen.getByText("Add Identity"));

    await waitFor(() => {
      expect(api.identity.create).toHaveBeenCalledWith(
        "new_key",
        "New Value",
        expect.objectContaining({ source_type: "user" }),
      );
    });
  });

  it("edits an existing identity", async () => {
    const mockIdentities = [
      {
        key: "user_name",
        value: "Alice",
      },
    ];
    vi.mocked(api.identity.list).mockResolvedValue(mockIdentities);
    vi.mocked(api.identity.create).mockResolvedValue({});

    renderWithClient(<Identity />);

    // Click edit button (Save icon is used for edit in the UI code provided)
    // Wait, looking at the code:
    // <button onClick={() => startEditing(item)} ...> <Save ... /> </button>
    // This seems like a UI bug (using Save icon for Edit action), but I must test what is there.
    // I'll find the button by the icon or role.

    // Actually, let's look at the code again:
    // <button onClick={() => startEditing(item)} ...> <Save className="w-4 h-4" /> </button>
    // It renders a Save icon.

    // The edit button is likely one of them. Let's be more specific.
    // It's inside the list item.

    // Let's find the container for "user_name" and find the button inside it.
    const userKey = await screen.findByText("user_name");
    const container = userKey.closest("div.bg-gray-800\\/50"); // Escaping slash

    // Since finding by icon is hard without aria-label, I'll assume it's the button in that container.
    // But wait, there is only one button in the view mode of the item.

    // Let's add aria-label to the component in a separate step if needed, but for now let's try to find it.
    // I'll use the fact that it's the only button in the item row.

    // Actually, let's just click the button that contains the Save icon.
    // Or I can just fireEvent.click on the button if I can select it.

    // Let's try to find the button by looking for the Save icon SVG if possible, or just select all buttons and pick the right one.
    // The "Add Identity" button has text. The edit button has only an icon.

    // Let's rely on the structure.
    const editButton = container?.querySelector("button");
    fireEvent.click(editButton!);

    // Now we should be in edit mode.
    const textarea = screen.getByDisplayValue('"Alice"');
    fireEvent.change(textarea, { target: { value: '"Bob"' } });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(api.identity.create).toHaveBeenCalledWith(
        "user_name",
        "Bob",
        expect.objectContaining({ source_type: "user" }),
      );
    });
  });

  it("handles load error", async () => {
    vi.mocked(api.identity.list).mockRejectedValue(new Error("Failed to load"));
    renderWithClient(<Identity />);

    expect(
      await screen.findByText("Error: Failed to load"),
    ).toBeInTheDocument();
  });
});
