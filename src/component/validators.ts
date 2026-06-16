import { v } from "convex/values";

/** A supported music provider. */
export const provider = v.union(
  v.literal("spotify"),
  v.literal("apple"),
  v.literal("musicbrainz"),
  v.literal("wikidata"),
  v.literal("deezer"),
);

/** A cached entity kind. */
export const entityKind = v.union(
  v.literal("track"),
  v.literal("artist"),
  v.literal("album"),
);

/** A credited artist reference inside a track/album value. */
const artistRef = v.object({
  name: v.string(),
  externalId: v.optional(v.string()),
});

/** Normalized, provider-sourced track facts. */
export const trackValue = v.object({
  title: v.string(),
  artists: v.array(artistRef),
  isrc: v.optional(v.string()),
  durationMs: v.optional(v.number()),
  previewUrl: v.optional(v.string()),
  coverUrl: v.optional(v.string()),
  url: v.optional(v.string()),
});

/** Normalized, provider-sourced artist facts (fields vary by provider). */
export const artistValue = v.object({
  name: v.string(),
  genres: v.array(v.string()),
  popularity: v.optional(v.number()),
  imageUrl: v.optional(v.string()),
  url: v.optional(v.string()),
  country: v.optional(v.string()),
  gender: v.optional(v.string()),
  debutYear: v.optional(v.number()),
  members: v.optional(v.union(v.literal("solo"), v.literal("group"))),
});

/** Normalized, provider-sourced album facts. */
export const albumValue = v.object({
  title: v.string(),
  artists: v.array(artistRef),
  releaseDate: v.optional(v.string()),
  coverUrl: v.optional(v.string()),
  url: v.optional(v.string()),
  trackCount: v.optional(v.number()),
});

/** The normalized payload for any cached entity, by kind. */
export const cacheValue = v.union(trackValue, artistValue, albumValue);

/**
 * Column validators for a stored cache entry (excluding system fields). Shared
 * between the schema and the query return validators.
 */
export const cacheEntryFields = {
  kind: entityKind,
  provider,
  externalId: v.string(),
  isrc: v.optional(v.string()),
  value: cacheValue,
  fetchedAt: v.number(),
  expiresAt: v.number(),
};

/** Public shape of a cache entry returned by queries. */
export const cacheEntryDoc = v.object({
  _id: v.id("cacheEntries"),
  _creationTime: v.number(),
  ...cacheEntryFields,
});
