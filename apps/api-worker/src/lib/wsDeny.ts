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

  // Workers runtime supports status 101 for WS upgrades; Node's undici Response
  // rejects 101 (throws RangeError). Fall back only for unit tests.
  try {
    return new Response(null, {
      status: 101,
      webSocket: client,
    } as ResponseInit);
  } catch {
    return new Response(null, { status: 200 });
  }
}
