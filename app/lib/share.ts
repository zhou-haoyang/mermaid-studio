// Encode/decode a shareable snapshot into the URL hash. JSON → deflate (pako)
// → base64url, prefixed `pako:` (compact, URL-safe, mermaid.live-style).

import { deflate, inflate } from "pako";

const PREFIX = "pako:";

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Serialize a snapshot to a `#`-less hash string (e.g. `pako:eNq...`). */
export function encodeShare(snapshot: unknown): string {
  const json = JSON.stringify(snapshot);
  const deflated = deflate(json);
  return PREFIX + bytesToBase64url(deflated);
}

/** Parse a hash (with or without leading `#`) back into a snapshot, or null. */
export function decodeShare<T = unknown>(hash: string): T | null {
  try {
    const raw = hash.replace(/^#/, "");
    if (!raw.startsWith(PREFIX)) return null;
    const bytes = base64urlToBytes(raw.slice(PREFIX.length));
    const json = new TextDecoder().decode(inflate(bytes));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
