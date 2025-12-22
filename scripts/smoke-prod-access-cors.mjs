// Smoke check: validates Cloudflare Access service-token auth + strict credentialed CORS.
// - Never prints secrets
// - Exits non-zero on failure

const API_IDENTITY_URL =
  process.env.SMOKE_API_IDENTITY_URL || "https://api.aperion.cc/v1/identity";
const ALLOWED_ORIGIN =
  process.env.SMOKE_ALLOWED_ORIGIN || "https://chat.aperion.cc";

const CHAT_BASE_URL =
  process.env.SMOKE_CHAT_BASE_URL || "https://chat.aperion.cc";
const RUN_ACCESS_BYPASS_SMOKE = process.env.RUN_ACCESS_BYPASS_SMOKE === "1";

const tokenId = process.env.CF_ACCESS_SERVICE_TOKEN_ID;
const tokenSecret = process.env.CF_ACCESS_SERVICE_TOKEN_SECRET;

function fail(msg) {
  // Intentionally keep output minimal and secret-free.
  console.error(`smoke-prod-access-cors: FAIL: ${msg}`);
  process.exitCode = 1;
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function fetchWithTimeout(url, init, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readBodyPrefix(res, maxBytes) {
  if (!res.body || typeof res.body.getReader !== "function") return "";
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      const remaining = maxBytes - total;
      if (remaining <= 0) break;

      if (value.byteLength > remaining) {
        chunks.push(value.subarray(0, remaining));
        total += remaining;
        break;
      }

      chunks.push(value);
      total += value.byteLength;
      if (total >= maxBytes) break;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
  }

  if (chunks.length === 0) return "";
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }

  return new TextDecoder().decode(merged);
}

async function assertNoAccessRedirect(url) {
  const res = await fetchWithTimeout(
    url,
    {
      method: "GET",
      // We want to observe redirects rather than follow them.
      redirect: "manual",
      headers: {
        // Send an Origin to surface CORS/redirect edge cases.
        Origin: CHAT_BASE_URL,
      },
    },
    10000,
  );

  // Fail if any redirect.
  if (res.status >= 300 && res.status < 400) {
    throw new Error(`static bypass got redirect (${res.status}) for ${url}`);
  }

  const ok = res.status === 200 || res.status === 304;
  if (!ok) {
    const loc = getHeaderLower(res, "Location");
    throw new Error(
      `static bypass expected 200/304 for ${url} (got ${res.status}${loc ? `, Location present` : ""})`,
    );
  }

  const location = getHeaderLower(res, "Location");
  if (location) {
    const locLower = String(location).toLowerCase();
    if (
      locLower.includes("cloudflareaccess") ||
      locLower.includes("cdn-cgi/access") ||
      locLower.includes("/cdn-cgi/access")
    ) {
      throw new Error(`static bypass got Access redirect for ${url}`);
    }
  }

  // Body-based fallback: scan up to first 8KB regardless of content-type.
  const bodyPrefix = await readBodyPrefix(res, 8 * 1024);
  const bodyLower = bodyPrefix.toLowerCase();
  if (
    bodyLower.includes("cloudflareaccess") ||
    bodyLower.includes("cdn-cgi/access") ||
    bodyLower.includes("/cdn-cgi/access")
  ) {
    throw new Error(`static bypass got Access marker in body for ${url}`);
  }

  // Fail if response includes cf-access-* headers (strong signal this was mediated by Access).
  for (const k of res.headers.keys()) {
    if (String(k).toLowerCase().startsWith("cf-access-")) {
      throw new Error(`static bypass got cf-access header for ${url}`);
    }
  }
}

function getHeaderLower(res, name) {
  return res.headers.get(name) || res.headers.get(name.toLowerCase());
}

function includesToken(haystack, needle) {
  return String(haystack || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .includes(String(needle).toLowerCase());
}

async function main() {
  // Optional: validate Access bypass for early-loaded static assets.
  // Disabled by default because it requires Access policy configuration.
  if (RUN_ACCESS_BYPASS_SMOKE) {
    const urls = [
      `${CHAT_BASE_URL}/manifest.json`,
      `${CHAT_BASE_URL}/icon-192.png`,
      `${CHAT_BASE_URL}/icon-512.png`,
      `${CHAT_BASE_URL}/favicon.ico`,
    ];

    for (const url of urls) {
      await assertNoAccessRedirect(url);
    }
  }

  if (!tokenId || !tokenSecret) {
    console.log(
      "smoke-prod-access-cors: SKIP (missing CF_ACCESS_SERVICE_TOKEN_ID/SECRET)",
    );
    return;
  }

  // 1) Preflight (OPTIONS) should succeed and allow requested headers.
  {
    const res = await fetchWithTimeout(
      API_IDENTITY_URL,
      {
        method: "OPTIONS",
        headers: {
          Origin: ALLOWED_ORIGIN,
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers":
            "content-type, x-aperion-client-version",
          "CF-Access-Client-Id": tokenId,
          "CF-Access-Client-Secret": tokenSecret,
        },
      },
      10000,
    );

    assert(res.status === 204, `OPTIONS expected 204, got ${res.status}`);

    const acao = getHeaderLower(res, "Access-Control-Allow-Origin");
    const acc = getHeaderLower(res, "Access-Control-Allow-Credentials");
    const vary = getHeaderLower(res, "Vary");
    const acah = getHeaderLower(res, "Access-Control-Allow-Headers");

    assert(acao === ALLOWED_ORIGIN, "OPTIONS missing/incorrect ACAO");
    assert(acc === "true", "OPTIONS missing/incorrect Allow-Credentials");
    assert(
      includesToken(vary, "Origin") &&
        includesToken(vary, "Access-Control-Request-Headers"),
      "OPTIONS missing Vary Origin/Access-Control-Request-Headers",
    );
    assert(
      String(acah || "")
        .toLowerCase()
        .includes("content-type"),
      "OPTIONS missing allowed header content-type",
    );
    assert(
      String(acah || "")
        .toLowerCase()
        .includes("x-aperion-client-version"),
      "OPTIONS missing allowed header x-aperion-client-version",
    );
  }

  // 2) Authenticated GET with an allowed Origin should return 200 and include strict CORS headers.
  {
    const res = await fetchWithTimeout(
      API_IDENTITY_URL,
      {
        method: "GET",
        headers: {
          Origin: ALLOWED_ORIGIN,
          "CF-Access-Client-Id": tokenId,
          "CF-Access-Client-Secret": tokenSecret,
        },
      },
      10000,
    );

    assert(res.status === 200, `GET expected 200, got ${res.status}`);

    const acao = getHeaderLower(res, "Access-Control-Allow-Origin");
    const acc = getHeaderLower(res, "Access-Control-Allow-Credentials");
    const vary = getHeaderLower(res, "Vary");

    assert(acao === ALLOWED_ORIGIN, "GET missing/incorrect ACAO");
    assert(acc === "true", "GET missing/incorrect Allow-Credentials");
    assert(includesToken(vary, "Origin"), "GET missing Vary: Origin");
  }

  // 3) Authenticated GET with an unknown Origin should not include ACAO.
  {
    const res = await fetchWithTimeout(
      API_IDENTITY_URL,
      {
        method: "GET",
        headers: {
          Origin: "https://evil.com",
          "CF-Access-Client-Id": tokenId,
          "CF-Access-Client-Secret": tokenSecret,
        },
      },
      10000,
    );

    assert(
      res.status === 200,
      `GET(unknown origin) expected 200, got ${res.status}`,
    );

    const acao = getHeaderLower(res, "Access-Control-Allow-Origin");
    assert(!acao, "GET(unknown origin) should not include ACAO");
  }

  console.log("smoke-prod-access-cors: OK");
}

main().catch((e) => {
  fail(e instanceof Error ? e.message : String(e));
});
