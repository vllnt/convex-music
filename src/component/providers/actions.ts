/**
 * Provider auth tokens, cached via `@convex-dev/action-cache`. Each token is
 * fetched/signed by an internal action (reading credentials from Convex env
 * vars) and cached by the child component, so read-through actions reuse a token
 * instead of re-authenticating every call. Tokens never leave the component.
 */

import { ActionCache } from "@convex-dev/action-cache";
import { v } from "convex/values";
import { components, internal } from "../_generated/api.js";
import { type ActionCtx, internalAction } from "../_generated/server.js";
import type { Provider } from "../../shared.js";
import { signAppleDeveloperToken } from "./apple/jwt.js";
import { fetchSpotifyToken } from "./spotify/client.js";

/** Convex exposes deployment env vars on `process.env` in the V8 runtime. */
declare const process: { env: Record<string, string | undefined> };

/** Spotify token TTL — Spotify tokens last ~1h; cache 55m. */
const SPOTIFY_TOKEN_TTL_MS = 55 * 60 * 1000;
/** Apple developer-token cache TTL — well under the 6-month JWT `exp`. */
const APPLE_TOKEN_TTL_MS = 150 * 24 * 60 * 60 * 1000;

/** Read a required Convex env var; throws if unset or empty. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Fetch a Spotify client-credentials token (cached by action-cache). */
export const spotifyTokenFetch = internalAction({
  args: {},
  returns: v.string(),
  handler: async (): Promise<string> => {
    const clientId = requireEnv("SPOTIFY_CLIENT_ID");
    const clientSecret = requireEnv("SPOTIFY_CLIENT_SECRET");
    const { accessToken } = await fetchSpotifyToken(clientId, clientSecret);
    return accessToken;
  },
});

/** Sign an Apple Music developer token (cached by action-cache). */
export const appleTokenSign = internalAction({
  args: {},
  returns: v.string(),
  handler: async (): Promise<string> =>
    signAppleDeveloperToken({
      issuer: requireEnv("APPLE_MUSIC_ISSUER"),
      keyId: requireEnv("APPLE_MUSIC_KID"),
      privateKeyPem: requireEnv("APPLE_MUSIC_PRIVATE_KEY"),
      nowSec: Math.floor(Date.now() / 1000),
    }),
});

const spotifyTokenCache = new ActionCache(components.actionCache, {
  action: internal.providers.actions.spotifyTokenFetch,
  name: "spotify-token",
  ttl: SPOTIFY_TOKEN_TTL_MS,
});

const appleTokenCache = new ActionCache(components.actionCache, {
  action: internal.providers.actions.appleTokenSign,
  name: "apple-token",
  ttl: APPLE_TOKEN_TTL_MS,
});

/**
 * Resolve a cached bearer token for a provider, for use as an adapter's
 * `getToken`. Throws for a provider without a token resolver.
 */
export async function getProviderToken(
  ctx: ActionCtx,
  prov: Provider,
): Promise<string> {
  if (prov === "spotify") return await spotifyTokenCache.fetch(ctx, {});
  if (prov === "apple") return await appleTokenCache.fetch(ctx, {});
  throw new Error(`No token resolver for provider "${prov}"`);
}
