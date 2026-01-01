#!/usr/bin/env node

import crypto from "node:crypto";
import tls from "node:tls";
import { Agent, WebSocket } from "undici";

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

// Cloudflare + WebSockets are reliably HTTP/1.1. Some Node HTTP stacks may
// attempt HTTP/2 via ALPN, which can surface as close(1006). Force HTTP/1.1
// to better match browser behavior.
const dispatcher = new Agent({
  connect: {
    ALPNProtocols: ["http/1.1"],
  },
});

function computeAccept(secWebSocketKey) {
  // RFC 6455
  const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
  return crypto
    .createHash("sha1")
    .update(`${secWebSocketKey}${GUID}`)
    .digest("base64");
}

async function handshakeOnly(wsUrlString, extraHeaders) {
  const url = new URL(wsUrlString);
  if (url.protocol !== "wss:") {
    throw new Error(`handshakeOnly only supports wss:// (got ${url.protocol})`);
  }

  const host = url.hostname;
  const port = url.port ? Number(url.port) : 443;
  const path = `${url.pathname}${url.search}`;

  const secKey = crypto.randomBytes(16).toString("base64");
  const expectedAccept = computeAccept(secKey);

  const lines = [
    `GET ${path} HTTP/1.1`,
    `Host: ${host}`,
    "Connection: Upgrade",
    "Upgrade: websocket",
    "Sec-WebSocket-Version: 13",
    `Sec-WebSocket-Key: ${secKey}`,
  ];

  for (const [k, v] of Object.entries(extraHeaders || {})) {
    if (!v) continue;
    lines.push(`${k}: ${v}`);
  }

  lines.push("\r\n");
  const req = lines.join("\r\n");

  const timeoutMs = Number(process.env.TIMEOUT_MS || 10_000);

  return await new Promise((resolve, reject) => {
    const socket = tls.connect({
      host,
      port,
      servername: host,
      ALPNProtocols: ["http/1.1"],
    });

    const timer = setTimeout(() => {
      try {
        socket.destroy(new Error(`timeout after ${timeoutMs}ms`));
      } catch {
        // ignore
      }
    }, timeoutMs);

    let buf = "";
    socket.setEncoding("utf8");

    socket.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    socket.on("secureConnect", () => {
      socket.write(req);
    });

    socket.on("data", (chunk) => {
      buf += chunk;
      const idx = buf.indexOf("\r\n\r\n");
      if (idx === -1) return;

      const head = buf.slice(0, idx);
      const lines = head.split("\r\n");
      const statusLine = lines[0] || "";
      const status = Number(statusLine.split(" ")[1] || "0");

      const headers = {};
      for (const line of lines.slice(1)) {
        const i = line.indexOf(":");
        if (i === -1) continue;
        const k = line.slice(0, i).trim().toLowerCase();
        const v = line.slice(i + 1).trim();
        headers[k] = v;
      }

      clearTimeout(timer);
      try {
        socket.destroy();
      } catch {
        // ignore
      }

      resolve({
        status,
        accept: headers["sec-websocket-accept"] || "",
        acceptOk: (headers["sec-websocket-accept"] || "") === expectedAccept,
      });
    });
  });
}

function log(line) {
  process.stdout.write(`${line}\n`);
}

async function main() {
  log(`ws url: ${wsUrl}`);
  if (headers["CF-Access-Client-Id"]) {
    const idLen = String(serviceTokenId).length;
    const secretLen = String(serviceTokenSecret).length;
    log(
      `auth: using Access service token headers (id len=${idLen}, secret len=${secretLen})`,
    );
  } else {
    log("auth: none (expected to fail behind Access)");
  }

  let opened = false;
  const ws = new WebSocket(wsUrl, [], { headers, dispatcher });

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
    opened = true;
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
    // If undici surfaces an abnormal close without ever opening, do a
    // deterministic handshake-only check to distinguish "can upgrade" from
    // "cannot reach/upgrade".
    if (!opened && evt.code === 1006) {
      handshakeOnly(wsUrl, headers)
        .then((res) => {
          log(
            `handshake_only: http_status=${res.status} accept_ok=${res.acceptOk ? "yes" : "no"}`,
          );
          process.exitCode = res.status === 101 && res.acceptOk ? 0 : 2;
        })
        .catch((e) => {
          log(
            `handshake_only: error=${e instanceof Error ? e.message : String(e)}`,
          );
          process.exitCode = 2;
        });
      return;
    }

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
