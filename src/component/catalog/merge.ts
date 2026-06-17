/**
 * Identity-merge: fold a provider's normalized facts into a unified catalog
 * entity's columns (layer-1-raw → layer-2-unified, `catalog-store.4`). Pure: the
 * mutation does the db read/write + ISRC keying; this computes the new field set.
 * One entity holds every provider's contribution in `providers[]` so the
 * field-source policy can project across them.
 */

import type {
  NormalizedArtist,
  NormalizedTrack,
} from "../../client/types.js";
import type { Provider } from "../../shared.js";

/** A provider's contribution to a unified artist. */
export interface ArtistProviderEntry {
  provider: Provider;
  providerId: string;
  imageUrl?: string;
  url?: string;
  popularity?: number;
  genres?: string[];
}

/** A provider's contribution to a unified track. */
export interface TrackProviderEntry {
  provider: Provider;
  providerId: string;
  previewUrl?: string;
  coverUrl?: string;
  url?: string;
}

/** The merged artist columns (excluding identity + lifecycle). */
export interface ArtistMergeState {
  genres: string[];
  popularity?: number;
  imageUrl?: string;
  country?: string;
  gender?: string;
  debutYear?: number;
  members?: "solo" | "group";
  providers: ArtistProviderEntry[];
}

/** The merged track columns (excluding identity + relations + lifecycle). */
export interface TrackMergeState {
  genres: string[];
  popularity?: number;
  durationMs?: number;
  providers: TrackProviderEntry[];
}

/** Set-union two genre lists, preserving first-seen order. */
function unionGenres(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])];
}

/** The larger of two optional numbers (undefined acts as absent). */
function maxDefined(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}

/** Replace this provider's entry in the provenance list, or append it. */
function upsertEntry<T extends { provider: Provider }>(
  entries: readonly T[],
  entry: T,
): T[] {
  const next = entries.filter((existing) => existing.provider !== entry.provider);
  next.push(entry);
  return next;
}

/**
 * Merge a provider artist into the unified artist state. Scalars prefer the
 * incoming value, falling back to what's already known; genres union; popularity
 * takes the max across providers; the provider's slice lands in `providers[]`.
 */
export function mergeArtist(
  existing: ArtistMergeState | null,
  provider: Provider,
  externalId: string,
  value: NormalizedArtist,
): ArtistMergeState {
  const base: ArtistMergeState = existing ?? { genres: [], providers: [] };
  const entry: ArtistProviderEntry = {
    provider,
    providerId: externalId,
    imageUrl: value.imageUrl,
    url: value.url,
    popularity: value.popularity,
    genres: value.genres,
  };
  return {
    genres: unionGenres(base.genres, value.genres),
    popularity: maxDefined(base.popularity, value.popularity),
    imageUrl: value.imageUrl ?? base.imageUrl,
    country: value.country ?? base.country,
    gender: value.gender ?? base.gender,
    debutYear: value.debutYear ?? base.debutYear,
    members: value.members ?? base.members,
    providers: upsertEntry(base.providers, entry),
  };
}

/**
 * Merge a provider track into the unified track state. ISRC keys the row (the
 * mutation enforces it), so this only folds genres/popularity/duration + the
 * provider's media-url slice.
 */
export function mergeTrack(
  existing: TrackMergeState | null,
  provider: Provider,
  externalId: string,
  value: NormalizedTrack,
): TrackMergeState {
  const base: TrackMergeState = existing ?? { genres: [], providers: [] };
  const entry: TrackProviderEntry = {
    provider,
    providerId: externalId,
    previewUrl: value.previewUrl,
    coverUrl: value.coverUrl,
    url: value.url,
  };
  return {
    genres: base.genres,
    popularity: base.popularity,
    durationMs: maxDefined(base.durationMs, value.durationMs),
    providers: upsertEntry(base.providers, entry),
  };
}
