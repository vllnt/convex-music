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
  genres: v.array(v.string()),
  popularity: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  previewUrl: v.optional(v.string()),
  coverUrl: v.optional(v.string()),
  url: v.optional(v.string()),
  /** The track's album provider id, for `importTrack({ withAlbum })`. */
  albumId: v.optional(v.string()),
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

/**
 * Columns of an album row. Provider-keyed like a playlist (cross-provider
 * unification by (artist+title+year) is a later identity step); carries the
 * album-specific facts + its track membership.
 */
export const albumFields = {
  title: v.string(),
  provider,
  providerId: v.string(),
  artistIds: v.array(v.id("artists")),
  releaseDate: v.optional(v.string()),
  coverUrl: v.optional(v.string()),
  url: v.optional(v.string()),
  trackCount: v.optional(v.number()),
  trackIds: v.array(v.id("tracks")),
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

/** Public shape of an album returned by queries. */
export const albumDoc = v.object({
  _id: v.id("albums"),
  _creationTime: v.number(),
  ...albumFields,
});

/**
 * Provider credentials, as a string map (`clientId`/`clientSecret` for Spotify;
 * `issuer`/`keyId`/`privateKeyPem` for Apple). A Convex component is sandboxed
 * from the host deployment's env vars, so the host reads its own env and passes
 * credentials in via `configure`; the component stores them in its own
 * sandboxed table (never readable by the host or sibling components).
 */
export const providerSecrets = v.record(v.string(), v.string());

/** Columns of a stored provider-credentials row. */
export const providerConfigFields = {
  provider,
  secrets: providerSecrets,
};

/*
 * ── Import control plane ────────────────────────────────────────────────────
 * The component-owned 8-state import-request machine (songtrivia's
 * `music_imports`, generalized) over the `importRequests` table — NOT
 * `@convex-dev/workflow`; the bounded traversal runs inline.
 */

/** What an import targets. */
export const importEntityType = v.union(
  v.literal("artist"),
  v.literal("track"),
  v.literal("playlist"),
  v.literal("album"),
);

/** The kind of import work. */
export const importMode = v.union(
  v.literal("import"),
  v.literal("refresh"),
  v.literal("reimport"),
  v.literal("repair"),
);

/**
 * Artist-import track traversal depth: `none` (artist only), `top` (the
 * provider's top tracks), or `all` (every track across the artist's albums).
 */
export const artistTracksMode = v.union(
  v.literal("none"),
  v.literal("top"),
  v.literal("all"),
);

/** Queue ordering hint. */
export const importPriority = v.union(
  v.literal("high"),
  v.literal("normal"),
  v.literal("low"),
);

/** How the target is identified. */
export const importTargetMode = v.union(
  v.literal("name"),
  v.literal("url"),
  v.literal("isrc"),
  v.literal("providerId"),
  v.literal("entityId"),
);

/** The 8 lifecycle states of an import request. */
export const importStatus = v.union(
  v.literal("queued"),
  v.literal("claimed"),
  v.literal("running"),
  v.literal("retry_waiting"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("canceled"),
  v.literal("stale"),
);

/** Per-call import options (provider select + traversal depth + mode). */
export const importOptions = v.object({
  providers: v.optional(v.array(provider)),
  withTracks: v.optional(v.boolean()),
  mode: v.optional(importMode),
  priority: v.optional(importPriority),
});

/** Columns of an import-request row. */
export const importRequestFields = {
  entityType: importEntityType,
  requestType: importMode,
  targetMode: importTargetMode,
  providerScope: v.string(),
  provider: v.optional(provider),
  providerId: v.optional(v.string()),
  entityId: v.optional(v.string()),
  name: v.optional(v.string()),
  isrc: v.optional(v.string()),
  url: v.optional(v.string()),
  withTracks: v.optional(v.boolean()),
  priority: importPriority,
  status: importStatus,
  dedupeKey: v.string(),
  retryCount: v.number(),
  nextAttemptAt: v.optional(v.number()),
  resolvedArtistId: v.optional(v.id("artists")),
  resolvedTrackId: v.optional(v.id("tracks")),
  resolvedPlaylistId: v.optional(v.id("playlists")),
  resolvedAlbumId: v.optional(v.id("albums")),
  errorSummary: v.optional(v.string()),
  resultSummary: v.optional(v.string()),
  requestedAt: v.number(),
  startedAt: v.optional(v.number()),
  finishedAt: v.optional(v.number()),
  updatedAt: v.number(),
};

/** Public shape of an import request returned by queries. */
export const importRequestDoc = v.object({
  _id: v.id("importRequests"),
  _creationTime: v.number(),
  ...importRequestFields,
});

/**
 * A registered import source — the generic, host-managed "keep this synced"
 * input (artist by name, playlist by url/id, track by ISRC, …). The host's
 * curated/categorized definitions stay host-side and reconcile INTO this
 * registry; the auto-import sweep imports enabled sources.
 */
export const sourceFields = {
  kind: importEntityType,
  by: importTargetMode,
  value: v.string(),
  provider: v.optional(provider),
  withTracks: v.optional(v.boolean()),
  cadenceMs: v.optional(v.number()),
  enabled: v.boolean(),
  lastImportedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
};

/** Public shape of a registered source returned by queries. */
export const sourceDoc = v.object({
  _id: v.id("sources"),
  _creationTime: v.number(),
  ...sourceFields,
});
