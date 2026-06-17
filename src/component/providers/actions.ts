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

/** Spotify token TTL — Spotify tokens last ~1h; cache 55m. */
const SPOTIFY_TOKEN_TTL_MS = 55 * 60 * 1000;
/** Apple developer-token cache TTL — well under the 6-month JWT `exp`. */
const APPLE_TOKEN_TTL_MS = 150 * 24 * 60 * 60 * 1000;

/** Load a provider's configured credentials, or throw if unconfigured. */
async function loadSecrets(
  ctx: ActionCtx,
  prov: Provider,
): Promise<Record<string, string>> {
  const secrets = await ctx.runQuery(
    internal.config.queries.getProviderSecrets,
    { provider: prov },
  );
  if (secrets === null) {
    throw new Error(
      `No credentials configured for provider "${prov}". Call configure() first.`,
    );
  }
  return secrets;
}

/** Read a required credential from a secrets map; throws if unset or empty. */
function requireSecret(secrets: Record<string, string>, key: string): string {
  const value = secrets[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required credential: ${key}`);
  }
  return value;
}

/** Fetch a Spotify client-credentials token (cached by action-cache). */
export const spotifyTokenFetch = internalAction({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    const secrets = await loadSecrets(ctx, "spotify");
    const { accessToken } = await fetchSpotifyToken(
      requireSecret(secrets, "clientId"),
      requireSecret(secrets, "clientSecret"),
    );
    return accessToken;
  },
});

/** Sign an Apple Music developer token (cached by action-cache). */
export const appleTokenSign = internalAction({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    const secrets = await loadSecrets(ctx, "apple");
    return signAppleDeveloperToken({
      issuer: requireSecret(secrets, "issuer"),
      keyId: requireSecret(secrets, "keyId"),
      privateKeyPem: requireSecret(secrets, "privateKeyPem"),
      nowSec: Math.floor(Date.now() / 1000),
    });
  },
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
 * The ctx `ActionCache.fetch` expects. action-cache 0.3.0 types it with a
 * query-context `runQuery`, which convex >=1.41 widened with a
 * `transactionLimits` option that an action-context `runQuery` does not carry —
 * a cosmetic 3rd-party type seam. The cache only runs its own internal action,
 * so the action ctx is correct at runtime; we bridge the type at the boundary.
 */
type TokenCacheCtx = Parameters<typeof spotifyTokenCache.fetch>[0];

/**
 * Resolve a cached bearer token for a provider, for use as an adapter's
 * `getToken`. No-auth providers return an empty token.
 */
export async function getProviderToken(
  ctx: ActionCtx,
  prov: Provider,
): Promise<string> {
  const cacheCtx = ctx as unknown as TokenCacheCtx;
  if (prov === "spotify") return await spotifyTokenCache.fetch(cacheCtx, {});
  if (prov === "apple") return await appleTokenCache.fetch(cacheCtx, {});
  // No-auth providers (MusicBrainz / Wikidata / Deezer) carry their own headers
  // (e.g. User-Agent) instead of a bearer token.
  return "";
}
