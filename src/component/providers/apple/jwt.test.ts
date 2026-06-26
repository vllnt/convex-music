import { describe, expect, it } from "vitest";
import {
  APPLE_TOKEN_MAX_TTL_SEC,
  type AppleTokenInput,
  signAppleDeveloperToken,
} from "./jwt.js";

/** Generate a P-256 key pair and PEM-encode the private key (PKCS8). */
async function generatePemKeyPair(): Promise<{
  pem: string;
  publicKey: CryptoKey;
}> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", pair.privateKey),
  );
  let binary = "";
  for (const byte of pkcs8) binary += String.fromCharCode(byte);
  const b64 = btoa(binary);
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  const pem = `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`;
  return { pem, publicKey: pair.publicKey };
}

function decodeBase64Url(segment: string): Uint8Array<ArrayBuffer> {
  let b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJsonSegment(segment: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment)));
}

/** Split a compact JWS into its three segments, asserting it is well-formed. */
function jwsParts(token: string): [string, string, string] {
  const segments = token.split(".");
  expect(segments).toHaveLength(3);
  const [header, payload, signature] = segments;
  if (header === undefined || payload === undefined || signature === undefined) {
    throw new Error("malformed token");
  }
  return [header, payload, signature];
}

describe("signAppleDeveloperToken", () => {
  it("produces a verifiable ES256 JWT with the right header + claims", async () => {
    const { pem, publicKey } = await generatePemKeyPair();
    const input: AppleTokenInput = {
      issuer: "TEAM123456",
      keyId: "KEY7890AB",
      privateKeyPem: pem,
      nowSec: 1_700_000_000,
    };

    const token = await signAppleDeveloperToken(input);
    const [headerB64, payloadB64, signatureB64] = jwsParts(token);

    const header = decodeJsonSegment(headerB64);
    expect(header).toEqual({ alg: "ES256", kid: "KEY7890AB", typ: "JWT" });

    const payload = decodeJsonSegment(payloadB64);
    expect(payload).toEqual({
      iss: "TEAM123456",
      iat: 1_700_000_000,
      exp: 1_700_000_000 + APPLE_TOKEN_MAX_TTL_SEC,
    });

    const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const verified = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      decodeBase64Url(signatureB64),
      signingInput,
    );
    expect(verified).toBe(true);
  });

  it("honors a custom ttl", async () => {
    const { pem } = await generatePemKeyPair();
    const token = await signAppleDeveloperToken(
      {
        issuer: "T",
        keyId: "K",
        privateKeyPem: pem,
        nowSec: 1_000,
        ttlSec: 3_600,
      },
      crypto.subtle,
    );
    const payload = decodeJsonSegment(jwsParts(token)[1]);
    expect(payload["exp"]).toBe(1_000 + 3_600);
  });

  it("clamps a ttl beyond Apple's 6-month maximum", async () => {
    const { pem } = await generatePemKeyPair();
    const token = await signAppleDeveloperToken({
      issuer: "T",
      keyId: "K",
      privateKeyPem: pem,
      nowSec: 1_000,
      ttlSec: APPLE_TOKEN_MAX_TTL_SEC * 10,
    });
    const payload = decodeJsonSegment(jwsParts(token)[1]);
    expect(payload["exp"]).toBe(1_000 + APPLE_TOKEN_MAX_TTL_SEC);
  });

  it("rejects a malformed (non-base64) PEM", async () => {
    await expect(
      signAppleDeveloperToken({
        issuer: "T",
        keyId: "K",
        privateKeyPem:
          "-----BEGIN PRIVATE KEY-----\n!!!not base64!!!\n-----END PRIVATE KEY-----",
        nowSec: 0,
      }),
    ).rejects.toThrow("Apple private key PEM is malformed");
  });

  it("rejects an empty PEM", async () => {
    await expect(
      signAppleDeveloperToken({
        issuer: "T",
        keyId: "K",
        privateKeyPem: "-----BEGIN PRIVATE KEY-----\n\n-----END PRIVATE KEY-----",
        nowSec: 0,
      }),
    ).rejects.toThrow("Apple private key PEM is empty");
  });

  it("re-signs deterministically into the same signing input", async () => {
    const { pem } = await generatePemKeyPair();
    const input: AppleTokenInput = {
      issuer: "T",
      keyId: "K",
      privateKeyPem: pem,
      nowSec: 42,
      ttlSec: 10,
    };
    const a = await signAppleDeveloperToken(input);
    const b = await signAppleDeveloperToken(input);
    // ECDSA is randomized, so signatures differ but the header.payload match.
    expect(a.split(".").slice(0, 2)).toEqual(b.split(".").slice(0, 2));
  });
});
