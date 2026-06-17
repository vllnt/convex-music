/**
 * Optional React layer for `@vllnt/convex-music`.
 *
 * Thin, tree-shakeable hooks over `convex/react`'s `useQuery`. Each wraps the
 * host's own re-exported query ref — the component never owns the host's `api`.
 * `react` and `convex/react` are optional peer deps: a backend-only consumer
 * never imports this entry and pulls in zero React.
 *
 * No-leak: only safe surfaces are exposed — catalog rows (factual, public) and
 * the field-source-projected image/preview URLs. No secrets cross the client.
 *
 * @example
 * ```tsx
 * // convex/music.ts (host) re-exports the query refs from its wrappers, then:
 * const image = useArtistImage(api.music.getArtistImage, "spotify", "a1", { prefer: ["apple", "spotify"] });
 * ```
 */
import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import type { CatalogArtist, CatalogTrack } from "../client/types.js";
import type { Provider } from "../shared.js";

/** Single-source field policy: one provider, or the first available in order. */
export type FieldSourcePolicy = { from: Provider } | { prefer: Provider[] };

/** The host's re-exported `getArtist` query ref. */
export type ArtistRef = FunctionReference<
  "query",
  "public",
  { id: string },
  CatalogArtist | null
>;

/** The host's re-exported `getTrack` query ref. */
export type TrackRef = FunctionReference<
  "query",
  "public",
  { id: string },
  CatalogTrack | null
>;

/** The host's re-exported projection query ref (artist image / track preview). */
export type ProjectionRef = FunctionReference<
  "query",
  "public",
  { provider: Provider; providerId: string; policy?: FieldSourcePolicy },
  string | null
>;

/** The host's re-exported search query ref for a kind. */
export type SearchRef<T> = FunctionReference<
  "query",
  "public",
  { query: string; limit?: number },
  T[]
>;

/** Reactively read one unified artist by id (`undefined` while loading). */
export function useArtist(
  query: ArtistRef,
  id: string,
): CatalogArtist | null | undefined {
  return useQuery(query, { id });
}

/** Reactively read one unified track by id (`undefined` while loading). */
export function useTrack(
  query: TrackRef,
  id: string,
): CatalogTrack | null | undefined {
  return useQuery(query, { id });
}

/** Reactively project an artist's image per a field-source policy. */
export function useArtistImage(
  query: ProjectionRef,
  provider: Provider,
  providerId: string,
  policy?: FieldSourcePolicy,
): string | null | undefined {
  return useQuery(query, { provider, providerId, policy });
}

/** Reactively project a track's preview URL per a field-source policy. */
export function useTrackPreview(
  query: ProjectionRef,
  provider: Provider,
  providerId: string,
  policy?: FieldSourcePolicy,
): string | null | undefined {
  return useQuery(query, { provider, providerId, policy });
}

/** Reactively search artists by name. */
export function useSearchArtists(
  query: SearchRef<CatalogArtist>,
  search: string,
  limit?: number,
): CatalogArtist[] | undefined {
  return useQuery(query, { query: search, limit });
}

/** Reactively search tracks by title. */
export function useSearchTracks(
  query: SearchRef<CatalogTrack>,
  search: string,
  limit?: number,
): CatalogTrack[] | undefined {
  return useQuery(query, { query: search, limit });
}

export type { CatalogArtist, CatalogTrack, Provider };
