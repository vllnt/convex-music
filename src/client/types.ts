import type { EntityKind, Provider } from "../shared.js";

/** A credited artist reference inside a track/album value. */
export interface ArtistRef {
  name: string;
  externalId?: string;
}

/** Normalized, provider-sourced track facts. */
export interface NormalizedTrack {
  title: string;
  artists: ArtistRef[];
  isrc?: string;
  durationMs?: number;
  previewUrl?: string;
  coverUrl?: string;
  url?: string;
}

/** Normalized, provider-sourced artist facts (fields vary by provider). */
export interface NormalizedArtist {
  name: string;
  genres: string[];
  popularity?: number;
  imageUrl?: string;
  url?: string;
  country?: string;
  gender?: string;
  debutYear?: number;
  members?: "solo" | "group";
}

/** Normalized, provider-sourced album facts. */
export interface NormalizedAlbum {
  title: string;
  artists: ArtistRef[];
  releaseDate?: string;
  coverUrl?: string;
  url?: string;
  trackCount?: number;
}

/** The normalized payload for any cached entity. */
export type CacheValue = NormalizedTrack | NormalizedArtist | NormalizedAlbum;

/**
 * The opaque key that addresses one cached entry. A `type` (not an `interface`)
 * so it satisfies Convex's `DefaultFunctionArgs` index-signature constraint.
 */
export type EntryKey = {
  kind: EntityKind;
  provider: Provider;
  externalId: string;
};

/** Arguments to cache one entity. `ttlMs` omitted means never expires. */
export type PutInput = EntryKey & {
  isrc?: string;
  value: CacheValue;
  ttlMs?: number;
};

/** A cache entry as returned by the component queries. */
export interface CacheEntry extends EntryKey {
  _id: string;
  _creationTime: number;
  isrc?: string;
  value: CacheValue;
  fetchedAt: number;
  expiresAt: number;
}

export type { EntityKind, Provider };
