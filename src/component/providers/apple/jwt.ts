/**
 * Apple Music developer token, signed with Web Crypto (ECDSA P-256 / ES256).
 * A Convex component runs in V8 — it cannot use `jsonwebtoken` (Node `crypto`),
 * so songtrivia's `jwt.sign(...)` is re-architected here on `crypto.subtle`:
 * PKCS8 key import → JWS assembly → base64url, zero-dependency. Web Crypto emits
 * the raw `r||s` signature JWS/ES256 expects, so no DER conversion is needed.
 */

/** Inputs for an Apple Music developer token. */
export interface AppleTokenInput {
  /** Apple Developer Team ID — the `iss` claim. */
  issuer: string;
  /** MusicKit private-key id — the JWS `kid` header. */
  keyId: string;
  /** PEM-encoded PKCS8 EC P-256 private key. */
  privateKeyPem: string;
  /** Issued-at, in seconds since the epoch. */
  nowSec: number;
  /** Lifetime in seconds (default 6 months — Apple's maximum). */
  ttlSec?: number;
}

/** Apple's maximum developer-token lifetime: ~6 months in seconds. */
export const APPLE_TOKEN_MAX_TTL_SEC = 15_777_000;

/** Base64url-encode bytes (no padding), per JWS. */
function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Base64url-encode a JSON value, per JWS. */
function base64UrlJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/** Decode a PEM block to the raw DER bytes Web Crypto imports. */
function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  if (body.length === 0) {
    throw new Error("Apple private key PEM is empty");
  }
  const binary = atob(body);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return buffer;
}

/**
 * Sign an Apple Music developer token. The signed JWT authorizes Apple Music API
 * requests for ~6 months (cache it; re-signing is cheap but pointless).
 *
 * @param input - issuer/keyId/PEM + issued-at + optional ttl.
 * @param subtle - Web Crypto subtle (injectable for tests; defaults to the runtime).
 * @returns the compact JWS `header.payload.signature`.
 */
export async function signAppleDeveloperToken(
  input: AppleTokenInput,
  subtle: SubtleCrypto = crypto.subtle,
): Promise<string> {
  const ttl = input.ttlSec ?? APPLE_TOKEN_MAX_TTL_SEC;
  const header = { alg: "ES256", kid: input.keyId, typ: "JWT" };
  const payload = {
    iss: input.issuer,
    iat: input.nowSec,
    exp: input.nowSec + ttl,
  };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const key = await subtle.importKey(
    "pkcs8",
    pemToDer(input.privateKeyPem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}
