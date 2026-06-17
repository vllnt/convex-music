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

/*
 * ── Durable catalog ─────────────────────────────────────────────────────────
 * The unified music database: one canonical entity per real-world identity
 * (track by ISRC, artist by resolved name), each carrying per-provider
 * `providers[]` provenance the field-source policy projects across. Generalized
 * from songtrivia's `music_*` tables; no game taxonomy.
 */

/** Lifecycle of a catalog row's freshness sync. */
export const syncStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("synced"),
  v.literal("failed"),
  v.literal("stale"),
);

/** Lifecycle of a catalog row's data-quality repair. */
export const repairStatus = v.union(
  v.literal("clean"),
  v.literal("needs_repair"),
  v.literal("repairing"),
  v.literal("failed_repair"),
);

/** Sync-status columns shared by every catalog entity. */
const syncFields = {
  syncStatus: v.optional(syncStatus),
  syncRetryCount: v.optional(v.number()),
  lastSyncError: v.optional(v.string()),
  nextSyncAt: v.optional(v.number()),
  lastSyncedAt: v.optional(v.number()),
};

/** Repair-status columns shared by every catalog entity. */
const repairFields = {
  repairStatus: v.optional(repairStatus),
  repairAttempts: v.optional(v.number()),
  repairError: v.optional(v.string()),
  lastRepairAt: v.optional(v.number()),
  repairStartedAt: v.optional(v.number()),
};

/** One provider's contribution to a unified artist (provenance). */
export const artistProviderEntry = v.object({
  provider,
  providerId: v.string(),
  imageUrl: v.optional(v.string()),
  url: v.optional(v.string()),
  popularity: v.optional(v.number()),
  genres: v.optional(v.array(v.string())),
});

/** One provider's contribution to a unified track (provenance). */
export const trackProviderEntry = v.object({
  provider,
  providerId: v.string(),
  previewUrl: v.optional(v.string()),
  coverUrl: v.optional(v.string()),
  url: v.optional(v.string()),
});

/** Columns of a unified artist row. */
export const artistFields = {
  name: v.string(),
  nameKey: v.string(),
  genres: v.array(v.string()),
  popularity: v.optional(v.number()),
  imageUrl: v.optional(v.string()),
  country: v.optional(v.string()),
  gender: v.optional(v.string()),
  debutYear: v.optional(v.number()),
  members: v.optional(v.union(v.literal("solo"), v.literal("group"))),
  providers: v.array(artistProviderEntry),
  updatedAt: v.number(),
  ...syncFields,
  ...repairFields,
};

/** Columns of a unified track row. */
export const trackFields = {
  isrc: v.string(),
  title: v.string(),
  artistIds: v.array(v.id("artists")),
  genres: v.array(v.string()),
  popularity: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  providers: v.array(trackProviderEntry),
  updatedAt: v.number(),
  ...syncFields,
  ...repairFields,
};

/** Columns of a playlist row (source-provider identity + ordered membership). */
export const playlistFields = {
  title: v.string(),
  provider,
  providerId: v.string(),
  description: v.optional(v.string()),
  coverUrl: v.optional(v.string()),
  url: v.optional(v.string()),
  owner: v.optional(v.string()),
  trackIds: v.array(v.id("tracks")),
  snapshotVersion: v.optional(v.string()),
  updatedAt: v.number(),
  ...syncFields,
  ...repairFields,
};

/** Reverse index: `(provider, providerId)` → artist (arrays aren't indexable). */
export const artistProviderLinkFields = {
  artistId: v.id("artists"),
  provider,
  providerId: v.string(),
};

/** Reverse index: `(provider, providerId)` → track. */
export const trackProviderLinkFields = {
  trackId: v.id("tracks"),
  provider,
  providerId: v.string(),
};

/** A concurrency claim on a track sync (token + lease). */
export const trackClaimFields = {
  isrc: v.string(),
  claimToken: v.string(),
  acquiredAt: v.number(),
  leaseUntil: v.number(),
};

/** Public shape of a unified artist returned by queries. */
export const artistDoc = v.object({
  _id: v.id("artists"),
  _creationTime: v.number(),
  ...artistFields,
});

/** Public shape of a unified track returned by queries. */
export const trackDoc = v.object({
  _id: v.id("tracks"),
  _creationTime: v.number(),
  ...trackFields,
});

/** Public shape of a playlist returned by queries. */
export const playlistDoc = v.object({
  _id: v.id("playlists"),
  _creationTime: v.number(),
  ...playlistFields,
});
