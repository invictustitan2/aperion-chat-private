type NodeBufferCtor = {
  from(data: Uint8Array): { toString(encoding: "base64"): string };
  from(data: string, encoding: "base64"): Uint8Array;
};

function getNodeBuffer(): NodeBufferCtor | undefined {
  return (globalThis as unknown as { Buffer?: NodeBufferCtor }).Buffer;
}

export function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToBase64(bytes: Uint8Array): string {
  const NodeBuffer = getNodeBuffer();
  if (NodeBuffer) {
    return NodeBuffer.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const NodeBuffer = getNodeBuffer();
  if (NodeBuffer) {
    return new Uint8Array(NodeBuffer.from(base64, "base64"));
  }

  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function jsonToBase64Url(obj: unknown): string {
  return bytesToBase64Url(utf8ToBytes(JSON.stringify(obj)));
}
