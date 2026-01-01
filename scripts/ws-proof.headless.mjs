#!/usr/bin/env node
/*
  scripts/ws-proof.headless.mjs

  Headless (server-compatible) WebSocket proof.

  Goals:
  - No GUI required.
  - No interactive Cloudflare Access login.
  - Uses Cloudflare Access service token headers to prove data-plane WS viability.
  - Writes durable JSON receipts (no secrets).

  Required env:
    SURFACE=browser|api
    WS_URL=wss://...

    One of the following pairs:
      CF_ACCESS_SERVICE_TOKEN_ID + CF_ACCESS_SERVICE_TOKEN_SECRET
      CF_ACCESS_CLIENT_ID        + CF_ACCESS_CLIENT_SECRET

  Optional env:
    CONNECT_TIMEOUT_MS (default: 10000)
    OBSERVE_MS         (default: 5000)
*/

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import tls from "node:tls";

function mustGetEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env var: ${name}`);
  return value;
}

function parseMs(name, defaultValue) {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return defaultValue;
  return Math.floor(n);
}

function nowIsoCompact() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

async function writeJson(filePath, obj) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function computeAccept(secWebSocketKey) {
  const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
  return crypto
    .createHash("sha1")
    .update(`${secWebSocketKey}${GUID}`)
    .digest("base64");
}

function maskPayload(payload, maskKey) {
  const out = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) {
    out[i] = payload[i] ^ maskKey[i % 4];
  }
  return out;
}

function buildClientFrame({ opcode, payload }) {
  const fin = 0x80;
  const b0 = fin | (opcode & 0x0f);

  const maskedBit = 0x80;
  const len = payload.length;

  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = b0;
    header[1] = maskedBit | len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = b0;
    header[1] = maskedBit | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = b0;
    header[1] = maskedBit | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  const maskKey = crypto.randomBytes(4);
  const masked = maskPayload(payload, maskKey);

  return Buffer.concat([header, maskKey, masked]);
}

function tryParseServerFrame(buffer) {
  if (buffer.length < 2) return null;

  const b0 = buffer[0];
  const b1 = buffer[1];

  const fin = (b0 & 0x80) !== 0;
  const opcode = b0 & 0x0f;
  const masked = (b1 & 0x80) !== 0;
  let len = b1 & 0x7f;

  // Server-to-client frames MUST NOT be masked.
  if (masked) {
    return { error: "server_sent_masked_frame" };
  }

  let offset = 2;
  if (len === 126) {
    if (buffer.length < offset + 2) return null;
    len = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (len === 127) {
    if (buffer.length < offset + 8) return null;
    const big = buffer.readBigUInt64BE(offset);
    if (big > BigInt(Number.MAX_SAFE_INTEGER)) {
      return { error: "frame_too_large" };
    }
    len = Number(big);
    offset += 8;
  }

  if (buffer.length < offset + len) return null;
  const payload = buffer.subarray(offset, offset + len);
  const rest = buffer.subarray(offset + len);

  return { fin, opcode, payload, rest };
}

async function proveHeadless({ wsUrl, headers, connectTimeoutMs, observeMs }) {
  const startedAt = Date.now();

  const url = new URL(wsUrl);
  if (url.protocol !== "wss:") {
    throw new Error(`WS_URL must be wss:// (got ${url.protocol})`);
  }

  const host = url.hostname;
  const port = url.port ? Number(url.port) : 443;
  const pathAndQuery = `${url.pathname}${url.search}`;

  const secKey = crypto.randomBytes(16).toString("base64");
  const expectedAccept = computeAccept(secKey);

  const requestLines = [
    `GET ${pathAndQuery} HTTP/1.1`,
    `Host: ${host}`,
    "Connection: Upgrade",
    "Upgrade: websocket",
    "Sec-WebSocket-Version: 13",
    `Sec-WebSocket-Key: ${secKey}`,
  ];

  for (const [k, v] of Object.entries(headers)) {
    if (!v) continue;
    requestLines.push(`${k}: ${v}`);
  }

  requestLines.push("\r\n");
  const req = requestLines.join("\r\n");

  const socket = tls.connect({
    host,
    port,
    servername: host,
    ALPNProtocols: ["http/1.1"],
  });

  let responseHead = "";
  let upgraded = false;
  let openTimeMs = null;
  let accept = "";
  let acceptOk = false;

  let serverClosed = false;
  let closeEvent = null;
  let firstFrame = { received: false, opcode: null, bytes: 0, kind: null };
  let pongReceived = false;

  let frameBuf = Buffer.alloc(0);

  const abort = (err) => {
    try {
      socket.destroy(err instanceof Error ? err : new Error(String(err)));
    } catch {
      // ignore
    }
  };

  const connectTimeout = setTimeout(() => {
    abort(new Error(`timeout after ${connectTimeoutMs}ms`));
  }, connectTimeoutMs);

  const result = await new Promise((resolve, reject) => {
    socket.on("error", (err) => {
      clearTimeout(connectTimeout);
      reject(err);
    });

    socket.on("secureConnect", () => {
      socket.write(req);
    });

    socket.on("end", () => {
      serverClosed = true;
    });

    socket.on("close", () => {
      serverClosed = true;
    });

    socket.on("data", (chunk) => {
      if (!upgraded) {
        responseHead += chunk.toString("utf8");
        const idx = responseHead.indexOf("\r\n\r\n");
        if (idx === -1) return;

        const head = responseHead.slice(0, idx);
        const lines = head.split("\r\n");
        const statusLine = lines[0] || "";
        const status = Number(statusLine.split(" ")[1] || "0");

        const hdrs = {};
        for (const line of lines.slice(1)) {
          const i = line.indexOf(":");
          if (i === -1) continue;
          const k = line.slice(0, i).trim().toLowerCase();
          const v = line.slice(i + 1).trim();
          hdrs[k] = v;
        }

        accept = hdrs["sec-websocket-accept"] || "";
        acceptOk = accept === expectedAccept;

        if (status !== 101) {
          clearTimeout(connectTimeout);
          reject(new Error(`upgrade failed (http_status=${status})`));
          return;
        }
        if (!acceptOk) {
          clearTimeout(connectTimeout);
          reject(new Error("upgrade failed (sec-websocket-accept mismatch)"));
          return;
        }

        upgraded = true;
        openTimeMs = Date.now() - startedAt;

        // Any bytes after header terminator are WS frame bytes.
        const rest = Buffer.from(responseHead.slice(idx + 4), "utf8");
        frameBuf = Buffer.concat([frameBuf, rest]);

        // Send a ping frame. (Client frames must be masked.)
        const pingPayload = Buffer.from("ping", "utf8");
        socket.write(buildClientFrame({ opcode: 0x9, payload: pingPayload }));

        // Observe for frames / stable connection.
        const observeTimer = setTimeout(() => {
          resolve({ ok: true });
        }, observeMs);

        // After upgrade, keep parsing frames until observe timer fires or socket closes.
        const parseLoop = () => {
          while (true) {
            const parsed = tryParseServerFrame(frameBuf);
            if (!parsed) return;
            if (parsed.error) {
              clearTimeout(observeTimer);
              reject(new Error(`ws frame parse error: ${parsed.error}`));
              return;
            }

            frameBuf = parsed.rest;

            if (!firstFrame.received) {
              firstFrame.received = true;
              firstFrame.opcode = parsed.opcode;
              firstFrame.bytes = parsed.payload.length;
              firstFrame.kind =
                parsed.opcode === 0x1
                  ? "text"
                  : parsed.opcode === 0x2
                    ? "binary"
                    : parsed.opcode === 0xa
                      ? "pong"
                      : parsed.opcode === 0x9
                        ? "ping"
                        : parsed.opcode === 0x8
                          ? "close"
                          : "other";
            }

            if (parsed.opcode === 0x9) {
              // Respond to ping with pong.
              socket.write(
                buildClientFrame({ opcode: 0xa, payload: parsed.payload }),
              );
            }

            if (parsed.opcode === 0xa) {
              pongReceived = true;
            }

            if (parsed.opcode === 0x8) {
              // Close frame payload: 2-byte code + utf8 reason.
              let code = null;
              let reason = "";
              if (parsed.payload.length >= 2) {
                code = parsed.payload.readUInt16BE(0);
                reason = parsed.payload.subarray(2).toString("utf8");
              }
              closeEvent = {
                code: code ?? 1005,
                reason,
                wasClean: true,
              };

              clearTimeout(observeTimer);
              resolve({ ok: true });
              return;
            }
          }
        };

        // Rebind handler for post-upgrade frame parsing.
        socket.removeAllListeners("data");
        socket.on("data", (buf) => {
          frameBuf = Buffer.concat([frameBuf, buf]);
          parseLoop();
        });

        socket.on("error", (err) => {
          clearTimeout(observeTimer);
          reject(err);
        });

        socket.on("close", () => {
          clearTimeout(observeTimer);
          resolve({ ok: true });
        });

        parseLoop();
        return;
      }
    });
  });

  clearTimeout(connectTimeout);

  // Attempt graceful close.
  try {
    const closePayload = Buffer.alloc(2);
    closePayload.writeUInt16BE(1000, 0);
    socket.write(buildClientFrame({ opcode: 0x8, payload: closePayload }));
  } catch {
    // ignore
  }

  try {
    socket.end();
  } catch {
    // ignore
  }

  const totalTimeMs = Date.now() - startedAt;

  const stableOpen = upgraded && !serverClosed;
  const connected =
    Boolean(upgraded) && (pongReceived || firstFrame.received || stableOpen);

  if (!closeEvent && serverClosed) {
    closeEvent = { code: 1006, reason: "", wasClean: false };
  }

  return {
    ok: Boolean(result.ok),
    connected,
    open_time_ms: openTimeMs,
    handshake: {
      http_status: 101,
      sec_websocket_accept: accept,
      accept_ok: acceptOk,
    },
    pong_received: pongReceived,
    first_frame: firstFrame,
    close_event: closeEvent,
    total_time_ms: totalTimeMs,
  };
}

async function run() {
  const surface = mustGetEnv("SURFACE");
  if (surface !== "browser" && surface !== "api") {
    throw new Error(`invalid SURFACE (expected browser|api): ${surface}`);
  }

  const wsUrl = mustGetEnv("WS_URL");

  const serviceTokenId =
    process.env.CF_ACCESS_SERVICE_TOKEN_ID ||
    process.env.CF_ACCESS_CLIENT_ID ||
    "";
  const serviceTokenSecret =
    process.env.CF_ACCESS_SERVICE_TOKEN_SECRET ||
    process.env.CF_ACCESS_CLIENT_SECRET ||
    "";

  if (!serviceTokenId || !serviceTokenSecret) {
    const missing = [
      !serviceTokenId ? "CF_ACCESS_SERVICE_TOKEN_ID" : null,
      !serviceTokenSecret ? "CF_ACCESS_SERVICE_TOKEN_SECRET" : null,
    ].filter(Boolean);
    throw new Error(
      `missing required Cloudflare Access service token env var(s): ${missing.join(
        ", ",
      )}`,
    );
  }

  const headers = {
    "CF-Access-Client-Id": serviceTokenId,
    "CF-Access-Client-Secret": serviceTokenSecret,
  };

  const connectTimeoutMs = parseMs("CONNECT_TIMEOUT_MS", 10_000);
  const observeMs = parseMs("OBSERVE_MS", 5_000);

  const startedAt = Date.now();

  const proof = await proveHeadless({
    wsUrl,
    headers,
    connectTimeoutMs,
    observeMs,
  });

  const notes = [
    "Headless proof uses a raw TLS + RFC6455 WebSocket client with Access service token headers.",
    "This does not rely on browser cookies or interactive login.",
  ];

  const receipt = {
    receipt_version: 1,
    created_utc: new Date().toISOString(),
    mode: "headless",
    surface,
    ws_url: wsUrl,
    auth_check_url: null,
    requires_operator_login: false,
    access_session: {
      ok: true,
      method: "service-token",
    },
    service_token_present: true,
    connected: Boolean(proof.connected),
    open_time_ms: proof.open_time_ms ?? null,
    first_message_received: Boolean(proof.first_frame?.received),
    first_message: {
      received: Boolean(proof.first_frame?.received),
      bytes: Number(proof.first_frame?.bytes || 0),
      kind: proof.first_frame?.kind ?? null,
    },
    close_event: proof.close_event ?? null,
    handshake: proof.handshake,
    pong_received: Boolean(proof.pong_received),
    total_time_ms: Date.now() - startedAt,
    notes,
  };

  const ts = nowIsoCompact();
  const receiptPath = path.join("receipts", `ws-proof.${surface}.${ts}.json`);
  const latestPath = path.join("receipts", `ws-proof.${surface}.latest.json`);

  await writeJson(receiptPath, receipt);
  await writeJson(latestPath, receipt);

  // Minimal, non-secret output.
  console.log(`RECEIPT: ${receiptPath}`);
  console.log(`RECEIPT_LATEST: ${latestPath}`);
  console.log(`CONNECTED: ${receipt.connected ? "yes" : "no"}`);

  if (!receipt.connected) {
    process.exitCode = 2;
  }
}

run().catch((err) => {
  const msg =
    err && typeof err === "object" && "message" in err
      ? err.message
      : String(err);
  console.error(`ERROR: ${msg}`);
  process.exit(2);
});
