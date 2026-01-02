import { describe, expect, it, vi } from "vitest";

vi.mock("@cloudflare/puppeteer", () => {
  return {
    default: {
      launch: vi.fn(async () => {
        const page = {
          setContent: vi.fn(async () => undefined),
          addStyleTag: vi.fn(async () => undefined),
          pdf: vi.fn(async () => new Uint8Array([1, 2, 3])),
        };
        return {
          newPage: vi.fn(async () => page),
          close: vi.fn(async () => undefined),
        };
      }),
    },
  };
});

describe("renderChatToPdf", () => {
  it("throws if BROWSER binding is missing", async () => {
    const { renderChatToPdf } = await import("./renderer");
    await expect(
      renderChatToPdf("<p>x</p>", {} as unknown as { BROWSER?: unknown }),
    ).rejects.toThrow(/BROWSER binding is not configured/);
  });

  it("renders html to a pdf buffer", async () => {
    const { renderChatToPdf } = await import("./renderer");
    const pdf = await renderChatToPdf("<p>hello</p>", {
      BROWSER: {},
    } as unknown as { BROWSER: unknown });
    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(Array.from(pdf)).toEqual([1, 2, 3]);
  });
});
