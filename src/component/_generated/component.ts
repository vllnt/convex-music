/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

type EntityKind = "track" | "artist" | "album";
type Provider = "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
type ArtistRef = { name: string; externalId?: string };
type TrackValue = {
  title: string;
  artists: Array<ArtistRef>;
  isrc?: string;
  durationMs?: number;
  previewUrl?: string;
  coverUrl?: string;
  url?: string;
};
type ArtistValue = {
  name: string;
  genres: Array<string>;
  popularity?: number;
  imageUrl?: string;
  url?: string;
  country?: string;
  gender?: string;
  debutYear?: number;
  members?: "solo" | "group";
};
type AlbumValue = {
  title: string;
  artists: Array<ArtistRef>;
  releaseDate?: string;
  coverUrl?: string;
  url?: string;
  trackCount?: number;
};
type CacheValue = TrackValue | ArtistValue | AlbumValue;
type CacheEntryDoc = {
  _id: string;
  _creationTime: number;
  kind: EntityKind;
  provider: Provider;
  externalId: string;
  isrc?: string;
  value: CacheValue;
  fetchedAt: number;
  expiresAt: number;
};
type EntryKey = { kind: EntityKind; provider: Provider; externalId: string };
type PutInput = EntryKey & {
  isrc?: string;
  value: CacheValue;
  ttlMs?: number;
};

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.music`.
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    mutations: {
      put: FunctionReference<"mutation", "internal", PutInput, string, Name>;
      invalidate: FunctionReference<
        "mutation",
        "internal",
        EntryKey,
        boolean,
        Name
      >;
      pruneExpired: FunctionReference<"mutation", "internal", {}, number, Name>;
    };
    queries: {
      get: FunctionReference<
        "query",
        "internal",
        EntryKey,
        CacheEntryDoc | null,
        Name
      >;
      getByIsrc: FunctionReference<
        "query",
        "internal",
        { isrc: string },
        Array<CacheEntryDoc>,
        Name
      >;
      stats: FunctionReference<
        "query",
        "internal",
        {},
        { total: number },
        Name
      >;
    };
  };
