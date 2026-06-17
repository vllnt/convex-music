/**
 * The provider adapter contract. Every provider (Spotify, Apple, …) implements
 * {@link MusicProvider}, mapping its raw API responses to the component's single
 * normalized schema (`NormalizedTrack` / `NormalizedArtist` / `NormalizedAlbum`
 * from the client types — the one public contract). Each returned entity carries
 * its provider `externalId` so the cache + catalog can key and unify it. Adding a
 * provider is a new folder + a registry entry — no edits to this contract.
 */

import type {
  NormalizedAlbum,
  NormalizedArtist,
  NormalizedTrack,
} from "../../client/types.js";
import type { Provider } from "../../shared.js";

/** A provider's artist, tagged with its provider id. */
export interface ProviderArtist {
  externalId: string;
  value: NormalizedArtist;
}

/** A provider's track, tagged with its provider id. */
export interface ProviderTrack {
  externalId: string;
  value: NormalizedTrack;
}

/** A provider's album plus its (normalized) track listing. */
export interface ProviderAlbum {
  externalId: string;
  value: NormalizedAlbum;
  tracks: ProviderTrack[];
}

/** Normalized playlist metadata (membership is carried separately). */
export interface NormalizedPlaylist {
  title: string;
  description?: string;
  coverUrl?: string;
  url?: string;
  owner?: string;
}

/** A provider's playlist plus its ordered (normalized) track membership. */
export interface ProviderPlaylist {
  externalId: string;
  value: NormalizedPlaylist;
  tracks: ProviderTrack[];
}

/** A single search hit, discriminated by entity kind. */
export type ProviderSearchResult =
  | { type: "artist"; data: ProviderArtist }
  | { type: "track"; data: ProviderTrack };

/** An artist's albums, flagged when the listing was truncated. */
export interface ArtistAlbumsResult {
  albums: ProviderAlbum[];
  isPartial: boolean;
}

/**
 * One music provider behind a uniform interface. Methods take/return the
 * provider's own external ids; values are already normalized.
 */
export interface MusicProvider {
  /** The provider id this adapter serves. */
  readonly id: Provider;
  /** Fetch one artist by provider id. */
  getArtist(externalId: string): Promise<ProviderArtist>;
  /** Fetch one track by provider id. */
  getTrack(externalId: string): Promise<ProviderTrack>;
  /** Fetch one album (with its tracks) by provider id. */
  getAlbum(externalId: string): Promise<ProviderAlbum>;
  /** Fetch one playlist (with its track membership) by provider id. */
  getPlaylist(externalId: string): Promise<ProviderPlaylist>;
  /** An artist's top tracks. */
  getArtistTopTracks(externalId: string): Promise<ProviderTrack[]>;
  /** An artist's albums (bounded; `isPartial` when truncated). */
  getArtistAlbums(externalId: string): Promise<ArtistAlbumsResult>;
  /** Free-text search for artists or tracks. */
  search(
    query: string,
    type: "artist" | "track",
  ): Promise<ProviderSearchResult[]>;
  /** Resolve tracks by ISRC (cross-provider identity). */
  searchByIsrc(isrc: string): Promise<ProviderTrack[]>;
  /**
   * Batch-fetch full track objects by provider id — used to enrich tracks whose
   * ISRC was omitted by a playlist/album listing. Optional: only providers whose
   * listings drop ISRC (Spotify) implement it.
   */
  getSeveralTracks?(externalIds: string[]): Promise<ProviderTrack[]>;
}
