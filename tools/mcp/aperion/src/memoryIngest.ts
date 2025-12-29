import { appendReceipt } from "./receipts.js";

function timeoutMsSignal(ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(t) };
}

export async function memoryIngestReceipt(opts: {
  repoRoot: string;
  content: string;
  url?: string;
}) {
  const url =
    opts.url ??
    process.env.APERION_MEMORY_INGEST_URL ??
    "http://127.0.0.1:8787/v1/receipts";

  const { signal, cancel } = timeoutMsSignal(1500);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: opts.content }),
      signal,
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);

    return {
      ok: true as const,
      mode: "remote" as const,
      url,
      response: text.slice(0, 10_000),
    };
  } catch (err) {
    const fallback = appendReceipt({
      repoRoot: opts.repoRoot,
      relativePath: undefined,
      content: opts.content,
    });

    return {
      ok: false as const,
      mode: "local" as const,
      url,
      error: err instanceof Error ? err.message : String(err),
      fallback: { relativePath: fallback.relativePath },
    };
  } finally {
    cancel();
  }
}
