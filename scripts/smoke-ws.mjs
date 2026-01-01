#!/usr/bin/env node

import { WebSocket } from "undici";

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

  const ws = new WebSocket(wsUrl, [], { headers });

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
    // ErrorEvent shape varies; try to surface something actionable.
    const name = typeof evt?.name === "string" ? evt.name : "ErrorEvent";
    const msg = typeof evt?.message === "string" ? evt.message : "";
    const err = evt?.error;
    const errMsg = err && typeof err.message === "string" ? err.message : "";
    const errCode =
      err && typeof err.code !== "undefined" ? String(err.code) : "";

    const parts = [
      `name=${name}`,
      msg ? `message=${JSON.stringify(msg)}` : "",
      errCode ? `code=${errCode}` : "",
      errMsg ? `error=${JSON.stringify(errMsg)}` : "",
    ].filter(Boolean);

    log(`event: error ${parts.join(" ") || String(evt)}`);
  });
}

main().catch((e) => {
  log(`error: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
