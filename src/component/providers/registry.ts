/**
 * Provider registry. Maps a provider id to a factory that builds its adapter
 * from an injected token resolver. Adding a provider = one entry here + its
 * adapter folder — no edits elsewhere (open/closed). Only registered providers
 * are usable; unknown ids throw. The token resolver + per-provider config are
 * wired by the action layer (env credentials, cached tokens).
 */

import { PROVIDER, type Provider } from "../../shared.js";
import type { FetchDeps } from "./fetch.js";
import { AppleProvider } from "./apple/impl.js";
import { SpotifyProvider } from "./spotify/impl.js";
import type { MusicProvider } from "./types.js";

/** Builds a provider adapter from a token resolver (+ optional fetch deps). */
export type ProviderFactory = (
  getToken: () => Promise<string>,
  deps?: FetchDeps,
) => MusicProvider;

/** The registered adapters. Extend this to add a provider. */
const REGISTRY: Partial<Record<Provider, ProviderFactory>> = {
  spotify: (getToken, deps) => new SpotifyProvider(getToken, undefined, deps),
  apple: (getToken, deps) => new AppleProvider(getToken, undefined, deps),
};

/** Whether an adapter is registered for a provider. */
export function isProviderRegistered(id: Provider): boolean {
  return id in REGISTRY;
}

/** The providers with a registered adapter, in declaration order. */
export function listRegisteredProviders(): Provider[] {
  return Object.values(PROVIDER).filter(isProviderRegistered);
}

/**
 * Build the adapter for a provider.
 *
 * @param id - provider id.
 * @param getToken - resolves a bearer token for that provider.
 * @param deps - injectable fetch/sleep/random (tests).
 * @throws if no adapter is registered for `id`.
 */
export function createProvider(
  id: Provider,
  getToken: () => Promise<string>,
  deps?: FetchDeps,
): MusicProvider {
  const factory = REGISTRY[id];
  if (factory === undefined) {
    throw new Error(`No adapter registered for provider "${id}"`);
  }
  return factory(getToken, deps);
}
