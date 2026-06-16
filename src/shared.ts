/** Shared constants + types used by both `client/` and `component/`. */

/**
 * Music data providers the catalog can aggregate. Opaque to the host — adding a
 * provider never changes the public API, only which adapter fills the cache.
 */
export const PROVIDER = {
  spotify: "spotify",
  apple: "apple",
  musicbrainz: "musicbrainz",
  wikidata: "wikidata",
  deezer: "deezer",
} as const;

/** A supported provider id. */
export type Provider = (typeof PROVIDER)[keyof typeof PROVIDER];

/** The catalog entities the component caches. */
export const ENTITY_KIND = {
  track: "track",
  artist: "artist",
  album: "album",
} as const;

/** A cached entity kind. */
export type EntityKind = (typeof ENTITY_KIND)[keyof typeof ENTITY_KIND];

/**
 * Sentinel `expiresAt` for an entry with no TTL. A real timestamp (not
 * `undefined`) so the `by_expiry` index never sweeps a never-expiring row.
 */
export const NEVER_EXPIRES = Number.MAX_SAFE_INTEGER;
