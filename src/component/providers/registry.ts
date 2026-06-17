/**
 * Provider registry. Maps each provider id to a factory that builds its adapter
 * from an injected token resolver. Adding a provider = a new `Provider` union
 * member + its entry here (TypeScript enforces exhaustiveness — a missing entry
 * is a compile error) + its adapter folder; no edits elsewhere (open/closed).
 * The token resolver + per-provider config are wired by the action layer
 * (no-auth providers ignore the token and carry their own headers).
 */

import type { Provider } from "../../shared.js";
import type { FetchDeps } from "./fetch.js";
import { AppleProvider } from "./apple/impl.js";
import { DeezerProvider } from "./deezer/impl.js";
import { MusicBrainzProvider } from "./musicbrainz/impl.js";
import { SpotifyProvider } from "./spotify/impl.js";
import { WikidataProvider } from "./wikidata/impl.js";
import type { MusicProvider } from "./types.js";

/** Builds a provider adapter from a token resolver (+ optional fetch deps). */
export type ProviderFactory = (
  getToken: () => Promise<string>,
  deps?: FetchDeps,
) => MusicProvider;

/** The registered adapters — one per `Provider` (exhaustive by type). */
const REGISTRY: Record<Provider, ProviderFactory> = {
  spotify: (getToken, deps) => new SpotifyProvider(getToken, undefined, deps),
  apple: (getToken, deps) => new AppleProvider(getToken, undefined, deps),
  // No-auth: ignore the token (User-Agent / public REST).
  musicbrainz: (_getToken, deps) => new MusicBrainzProvider(undefined, deps),
  deezer: (_getToken, deps) => new DeezerProvider(undefined, deps),
  wikidata: (_getToken, deps) => new WikidataProvider(undefined, deps),
};

/**
 * Build the adapter for a provider.
 *
 * @param id - provider id.
 * @param getToken - resolves a bearer token (ignored by no-auth providers).
 * @param deps - injectable fetch/sleep/random (tests).
 */
export function createProvider(
  id: Provider,
  getToken: () => Promise<string>,
  deps?: FetchDeps,
): MusicProvider {
  return REGISTRY[id](getToken, deps);
}
