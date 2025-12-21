#!/usr/bin/env node

const wsUrl = process.env.WS_URL || "wss://api.aperion.cc/v1/ws";

const serviceTokenId =
  process.env.CF_ACCESS_SERVICE_TOKEN_ID ||
  process.env.CF_ACCESS_CLIENT_ID ||
  "";
const serviceTokenSecret =
  process.env.CF_ACCESS_SERVICE_TOKEN_SECRET ||
  process.env.CF_ACCESS_CLIENT_SECRET ||
  "";

const headers = {};
if (serviceTokenId && serviceTokenSecret) {
  headers["CF-Access-Client-Id"] = serviceTokenId;
  headers["CF-Access-Client-Secret"] = serviceTokenSecret;
}

function log(line) {
  process.stdout.write(`${line}\n`);
}

async function main() {
  log(`ws url: ${wsUrl}`);
  if (headers["CF-Access-Client-Id"]) {
    log("auth: using Access service token headers");
  } else {
    log("auth: none (expected to fail behind Access)");
  }

  if (typeof WebSocket === "undefined") {
    throw new Error(
      "Global WebSocket is not available. Use Node.js 20+ (which provides WebSocket via undici).",
    );
  }

  const ws = new WebSocket(wsUrl, { headers });

  const timeoutMs = Number(process.env.TIMEOUT_MS || 10_000);
  const timeout = setTimeout(() => {
    log(`timeout: no open/close within ${timeoutMs}ms`);
    try {
      ws.close();
    } catch {
      // ignore
    }
    process.exitCode = 2;
  }, timeoutMs);

  ws.addEventListener("open", () => {
    log("event: open");
    // Immediately close to keep this a smoke test.
    ws.close(1000, "smoke test");
  });

  ws.addEventListener("close", (evt) => {
    clearTimeout(timeout);
    log(`event: close code=${evt.code} reason=${JSON.stringify(evt.reason)}`);

    // Expected outcomes:
    // - Behind Access with no auth, many clients surface handshake denial as an error + close(1006).
    // - If a socket is established but the DO denies it, policy close is 1008.
    // - With valid Access auth, open should succeed and close should be 1000 (from our client).
    process.exitCode = 0;
  });

  ws.addEventListener("error", (evt) => {
    // Node's WebSocket error object isn't standardized; print what we can.
    log(`event: error ${String(evt?.message || evt)}`);
  });
}

main().catch((e) => {
  log(`error: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
