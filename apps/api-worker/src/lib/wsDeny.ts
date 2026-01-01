export function createPolicyCloseWebSocketUpgradeResponse(opts: {
  closeCode: number;
  closeReason: string;
}): Response {
  // Return a 101 response so the client receives a meaningful close code.
  // NOTE: WebSocketPair exists in the Workers runtime (workerd). In unit tests,
  // we polyfill it to validate close-code behavior without importing DO classes.
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();
  server.close(opts.closeCode, opts.closeReason);

  // Cloudflare Workers requires a 101 Switching Protocols response for WS.
  // In Node-based unit tests, the global `Response` may reject 101; fall back
  // to a non-upgrade Response so tests can still execute.
  try {
    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit);
  } catch {
    return new Response(null, {
      webSocket: client,
    } as ResponseInit);
  }
}
