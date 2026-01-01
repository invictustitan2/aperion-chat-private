#!/usr/bin/env node
/*
  scripts/ws-proof.playwright.mjs

  Browser-engine WebSocket proof using Playwright (headed Chromium).

  Why:
  - Node WS clients can report close(1006) even when the server upgrades (101).
  - This script provides "real browser" evidence using actual Chromium WebSocket behavior.

  Hard rules:
  - Never print secrets.
  - Requires operator to complete Cloudflare Access login interactively.

  Inputs (env):
    SURFACE=browser|api
    WS_URL=wss://...
    AUTH_CHECK_URL=https://.../v1/identity (or equivalent)

    Optional (env):
    LOGIN_TIMEOUT_MS (default: 300000)
    OPEN_TIMEOUT_MS  (default: 15000)
    OBSERVE_MS       (default: 5000)
    MESSAGE_TIMEOUT_MS (default: 5000)
*/

import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

function mustGetEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required env var: ${name}`);
  }
  return value;
}

function parseMs(name, defaultValue) {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return defaultValue;
  return Math.floor(num);
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
  const body = JSON.stringify(obj, null, 2) + "\n";
  await fs.writeFile(filePath, body, "utf8");
}

async function ensureAccessSession(page, authCheckUrl, loginTimeoutMs) {
  const resp = await page.goto(authCheckUrl, { waitUntil: "domcontentloaded" });
  if (resp && resp.status() === 200) {
    return { ok: true, method: "initial" };
  }

  console.log(
    "ACTION: Complete Cloudflare Access login in the opened browser window; script will continue automatically.",
  );

  // Wait until Access redirects back to the auth check URL.
  await page.waitForURL((url) => url.href.startsWith(authCheckUrl), {
    timeout: loginTimeoutMs,
  });

  // Confirm we can actually load the auth check URL with HTTP 200.
  const final = await page.goto(authCheckUrl, {
    waitUntil: "domcontentloaded",
  });
  if (final && final.status() === 200) {
    return { ok: true, method: "post-login" };
  }

  return {
    ok: false,
    method: "post-login",
    status: final ? final.status() : null,
  };
}

async function run() {
  const surface = mustGetEnv("SURFACE");
  if (surface !== "browser" && surface !== "api") {
    throw new Error(`invalid SURFACE (expected browser|api): ${surface}`);
  }

  const wsUrl = mustGetEnv("WS_URL");
  const authCheckUrl = mustGetEnv("AUTH_CHECK_URL");

  const loginTimeoutMs = parseMs("LOGIN_TIMEOUT_MS", 300_000);
  const openTimeoutMs = parseMs("OPEN_TIMEOUT_MS", 15_000);
  const observeMs = parseMs("OBSERVE_MS", 5_000);
  const messageTimeoutMs = parseMs("MESSAGE_TIMEOUT_MS", 5_000);

  const serviceTokenPresent =
    Boolean(process.env.CF_ACCESS_SERVICE_TOKEN_ID) &&
    Boolean(process.env.CF_ACCESS_SERVICE_TOKEN_SECRET);

  const startedAt = Date.now();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  let connected = false;
  let openTimeMs = null;
  let closeEvent = null;
  let firstMessage = { received: false, bytes: 0, kind: null };

  const notes = [
    "Browser-engine proof uses headed Chromium with an interactive Cloudflare Access login.",
    "No WS request headers are injected; proof relies on Access session cookies.",
    "Node WS smoke close(1006) is diagnostic-only when ws:probe + this proof are green.",
  ];

  let accessSession = { ok: false, method: "unknown" };

  try {
    accessSession = await ensureAccessSession(
      page,
      authCheckUrl,
      loginTimeoutMs,
    );

    if (!accessSession.ok) {
      throw new Error(
        `failed to establish Access session (auth check not 200). status=${accessSession.status ?? "unknown"}`,
      );
    }

    const wsResult = await page.evaluate(
      ({ url, openTimeout, messageTimeout, observe }) => {
        return new Promise((resolve) => {
          const started = Date.now();

          let openedAt = null;
          let closeEvent = null;
          let firstMessage = { received: false, bytes: 0, kind: null };

          const ws = new WebSocket(url);

          const finish = () => {
            try {
              if (ws.readyState === WebSocket.OPEN)
                ws.close(1000, "proof_done");
            } catch {
              // ignore
            }

            resolve({
              connected: openedAt !== null,
              open_time_ms: openedAt === null ? null : openedAt - started,
              close_event: closeEvent,
              first_message: firstMessage,
            });
          };

          const openTimer = setTimeout(() => {
            finish();
          }, openTimeout);

          ws.addEventListener("open", () => {
            openedAt = Date.now();
            clearTimeout(openTimer);

            // Observe for a bit, but do not assume server sends a message.
            // Record whether any message arrives within messageTimeout.
            const messageTimer = setTimeout(() => {
              // Wait out the rest of observe window if longer than messageTimeout.
              const remaining = Math.max(0, observe - messageTimeout);
              setTimeout(finish, remaining);
            }, messageTimeout);

            const observeTimer = setTimeout(() => {
              clearTimeout(messageTimer);
              finish();
            }, observe);

            ws.addEventListener("message", (event) => {
              if (firstMessage.received) return;
              firstMessage.received = true;
              if (typeof event.data === "string") {
                firstMessage.kind = "string";
                firstMessage.bytes = event.data.length;
              } else if (event.data instanceof ArrayBuffer) {
                firstMessage.kind = "arraybuffer";
                firstMessage.bytes = event.data.byteLength;
              } else {
                // Could be Blob; we avoid reading it.
                firstMessage.kind = "other";
                firstMessage.bytes = 0;
              }
            });

            ws.addEventListener("close", (ev) => {
              closeEvent = {
                code: ev.code,
                reason: ev.reason,
                wasClean: ev.wasClean,
              };
              clearTimeout(messageTimer);
              clearTimeout(observeTimer);
              finish();
            });
          });

          ws.addEventListener("close", (ev) => {
            if (closeEvent) return;
            closeEvent = {
              code: ev.code,
              reason: ev.reason,
              wasClean: ev.wasClean,
            };
          });

          ws.addEventListener("error", () => {
            // Many browser WS errors don't expose detail.
            // We'll rely on the presence/absence of open + close event codes.
          });
        });
      },
      {
        url: wsUrl,
        openTimeout: openTimeoutMs,
        messageTimeout: messageTimeoutMs,
        observe: observeMs,
      },
    );

    connected = Boolean(wsResult.connected);
    openTimeMs = wsResult.open_time_ms ?? null;
    closeEvent = wsResult.close_event ?? null;
    firstMessage = wsResult.first_message ?? firstMessage;
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }

  const finishedAt = Date.now();

  const receipt = {
    receipt_version: 1,
    created_utc: new Date().toISOString(),
    surface,
    ws_url: wsUrl,
    auth_check_url: authCheckUrl,
    requires_operator_login: true,
    access_session: {
      ok: accessSession.ok,
      method: accessSession.method,
    },
    service_token_present: serviceTokenPresent,
    connected,
    open_time_ms: openTimeMs,
    first_message_received: Boolean(firstMessage.received),
    first_message: firstMessage,
    close_event: closeEvent,
    total_time_ms: finishedAt - startedAt,
    notes,
  };

  const ts = nowIsoCompact();
  const receiptPath = path.join("receipts", `ws-proof.${surface}.${ts}.json`);
  const latestPath = path.join("receipts", `ws-proof.${surface}.latest.json`);

  await writeJson(receiptPath, receipt);
  await writeJson(latestPath, receipt);

  console.log(`RECEIPT: ${receiptPath}`);
  console.log(`RECEIPT_LATEST: ${latestPath}`);
  console.log(`CONNECTED: ${connected ? "yes" : "no"}`);
}

run().catch((err) => {
  const msg =
    err && typeof err === "object" && "message" in err
      ? err.message
      : String(err);
  console.error(`ERROR: ${msg}`);
  process.exit(1);
});
