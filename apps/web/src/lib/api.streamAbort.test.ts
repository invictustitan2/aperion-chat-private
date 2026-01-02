import { describe, it, expect, vi } from "vitest";
import { api } from "./api";

describe("api.chat.stream abort", () => {
  it("rejects with AbortError when aborted before fetch resolves", async () => {
    const originalFetch = globalThis.fetch;

    const fetchSpy = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (!signal) {
          reject(new Error("missing signal"));
          return;
        }

        const onAbort = () => {
          reject(new DOMException("Aborted", "AbortError"));
        };

        if (signal.aborted) {
          onAbort();
          return;
        }

        signal.addEventListener("abort", onAbort, { once: true });
      });
    });

    // @ts-expect-error test override
    globalThis.fetch = fetchSpy;

    const controller = new AbortController();

    const promise = api.chat.stream(
      "hello",
      [],
      undefined,
      () => {},
      undefined,
      undefined,
      { signal: controller.signal },
    );

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchSpy).toHaveBeenCalled();

    globalThis.fetch = originalFetch;
  });
});
