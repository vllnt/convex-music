/**
 * Spotify auth + base URL. Client-credentials OAuth: exchange the app id/secret
 * for a bearer token (~1h). The token is cached by the action layer (a provider
 * token table / action-cache); this module just performs the exchange.
 */

import {
  DEFAULT_RETRY_CONFIG,
  type FetchDeps,
  type RetryConfig,
  defaultFetchDeps,
  fetchJson,
} from "../fetch.js";
import type { SpotifyTokenResponse } from "./types.js";

/** Spotify Web API base. */
export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

/** Spotify token endpoint. */
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

/** A fetched Spotify access token and its lifetime. */
export interface SpotifyToken {
  accessToken: string;
  expiresInSec: number;
}

/**
 * Exchange client credentials for an access token.
 *
 * @param clientId - `SPOTIFY_CLIENT_ID`.
 * @param clientSecret - `SPOTIFY_CLIENT_SECRET`.
 * @param cfg - retry/timeout policy.
 * @param deps - injectable fetch/sleep/random.
 */
export async function fetchSpotifyToken(
  clientId: string,
  clientSecret: string,
  cfg: RetryConfig = DEFAULT_RETRY_CONFIG,
  deps: FetchDeps = defaultFetchDeps,
): Promise<SpotifyToken> {
  const res = await fetchJson<SpotifyTokenResponse>(
    "spotify",
    SPOTIFY_TOKEN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: "grant_type=client_credentials",
    },
    cfg,
    deps,
  );
  return { accessToken: res.access_token, expiresInSec: res.expires_in };
}
