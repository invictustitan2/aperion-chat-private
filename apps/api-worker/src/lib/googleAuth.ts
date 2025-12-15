import {
  base64ToBytes,
  bytesToBase64Url,
  jsonToBase64Url,
  utf8ToBytes,
} from "./base64";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return ab;
}

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

type GoogleEnv = {
  GOOGLE_APPLICATION_CREDENTIALS_JSON?: string;
};

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

let cachedToken: CachedToken | undefined;

function pemToDer(pem: string): Uint8Array {
  const lines = pem
    .trim()
    .split("\n")
    .filter((l) => !l.startsWith("-----"));
  const b64 = lines.join("");
  return base64ToBytes(b64);
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pkcs8 = pemToDer(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    toArrayBuffer(pkcs8),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
}

async function signJwtRS256(
  payload: Record<string, unknown>,
  privateKeyPem: string,
) {
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = jsonToBase64Url(header);
  const encodedPayload = jsonToBase64Url(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importPrivateKey(privateKeyPem);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    toArrayBuffer(utf8ToBytes(signingInput)),
  );
  const encodedSig = bytesToBase64Url(new Uint8Array(sig));
  return `${signingInput}.${encodedSig}`;
}

function loadServiceAccount(env: GoogleEnv): ServiceAccountKey {
  if (!env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    throw new Error(
      "Missing GOOGLE_APPLICATION_CREDENTIALS_JSON (service account JSON as a secret string)",
    );
  }
  return JSON.parse(
    env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
  ) as ServiceAccountKey;
}

export async function getGoogleAccessToken(env: GoogleEnv): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAtMs - 60_000) {
    return cachedToken.accessToken;
  }

  const sa = loadServiceAccount(env);
  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;

  const jwt = await signJwtRS256(
    {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp,
    },
    sa.private_key,
  );

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google token exchange failed: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  cachedToken = {
    accessToken: data.access_token,
    expiresAtMs: now + (data.expires_in ?? 3600) * 1000,
  };

  return cachedToken.accessToken;
}
