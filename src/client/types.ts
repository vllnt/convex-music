import type { GenericId, Infer } from "convex/values";
import type {
  albumDoc,
  artistDoc,
  playlistDoc,
  trackDoc,
} from "../component/validators.js";
import type { EntityKind, Provider } from "../shared.js";

/**
 * Replace every branded component `Id<T>` with a plain `string`. Host-side, the
 * component's row ids are opaque strings (the host doesn't own those tables), so
 * the public catalog types carry `string` ids — matching how `components.music`
 * exposes them.
 */
type StringifyIds<T> = T extends GenericId<string>
  ? string
  : T extends Array<infer U>
    ? Array<StringifyIds<U>>
    : T extends object
      ? { [K in keyof T]: StringifyIds<T[K]> }
      : T;

/** A unified catalog artist (every provider's facts merged), as returned. */
export type CatalogArtist = StringifyIds<Infer<typeof artistDoc>>;

/** A unified catalog track (keyed by ISRC), as returned. */
export type CatalogTrack = StringifyIds<Infer<typeof trackDoc>>;

/** A playlist (source-provider identity + ordered membership), as returned. */
export type CatalogPlaylist = StringifyIds<Infer<typeof playlistDoc>>;

/** An album (source-provider identity + track membership), as returned. */
export type CatalogAlbum = StringifyIds<Infer<typeof albumDoc>>;

/** A normalized search hit (provider id + value), discriminated by kind. */
export type SearchHit =
  | { type: "artist"; externalId: string; value: NormalizedArtist }
  | { type: "track"; externalId: string; value: NormalizedTrack };

/** A credited artist reference inside a track/album value. */
export interface ArtistRef {
  name: string;
  externalId?: string;
}

/** Normalized, provider-sourced track facts (fields vary by provider). */
export interface NormalizedTrack {
  title: string;
  artists: ArtistRef[];
  isrc?: string;
  /** Track genres where the provider supplies them (Apple); `[]` otherwise. */
  genres: string[];
  /** 0–100 where the provider supplies it (Spotify); scales staleness. */
  popularity?: number;
  durationMs?: number;
  previewUrl?: string;
  coverUrl?: string;
  url?: string;
  /** The track's album provider id, for `importTrack({ withAlbum })`. */
  albumId?: string;
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
