import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel.js";
import { query } from "../_generated/server.js";
import {
  albumDoc,
  artistDoc,
  playlistDoc,
  provider,
  trackDoc,
} from "../validators.js";
import { orderByDailyRotation, utcDateBucket } from "./browse_order.js";
import { projectField } from "./field_source_policy.js";

/** Single-source field policy: pick one provider's value (`from`) or the first
 * available in preference order (`prefer`). Applies to any per-provider field
 * (artist image, track preview). */
const fieldSourcePolicy = v.union(
  v.object({ from: provider }),
  v.object({ prefer: v.array(provider) }),
);

/** Default rows scanned by `selectEligible` before ordering. */
const DEFAULT_SCAN_LIMIT = 1000;
/** Default search result cap. */
const DEFAULT_SEARCH_LIMIT = 20;

/** Fetch one unified artist by id. */
export const getArtist = query({
  args: { id: v.id("artists") },
  returns: v.union(v.null(), artistDoc),
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

/** Fetch one unified track by id. */
export const getTrack = query({
  args: { id: v.id("tracks") },
  returns: v.union(v.null(), trackDoc),
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

/** Fetch one playlist by id. */
export const getPlaylist = query({
  args: { id: v.id("playlists") },
  returns: v.union(v.null(), playlistDoc),
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

/** Fetch one album by id. */
export const getAlbum = query({
  args: { id: v.id("albums") },
  returns: v.union(v.null(), albumDoc),
  handler: async (ctx, args) => await ctx.db.get(args.id),
});

/** Resolve an album by its source-provider identity. */
export const getAlbumByProvider = query({
  args: { provider, providerId: v.string() },
  returns: v.union(v.null(), albumDoc),
  handler: async (ctx, args) =>
    await ctx.db
      .query("albums")
      .withIndex("by_provider", (q) =>
        q.eq("provider", args.provider).eq("providerId", args.providerId),
      )
      .unique(),
});

/** Resolve a track by ISRC (the canonical track identity). */
export const getTrackByIsrc = query({
  args: { isrc: v.string() },
  returns: v.union(v.null(), trackDoc),
  handler: async (ctx, args) =>
    await ctx.db
      .query("tracks")
      .withIndex("by_isrc", (q) => q.eq("isrc", args.isrc))
      .unique(),
});

/** Resolve the unified artist a provider id maps to (via the reverse index). */
export const getArtistByProvider = query({
  args: { provider, providerId: v.string() },
  returns: v.union(v.null(), artistDoc),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("artistProviders")
      .withIndex("by_provider_id", (q) =>
        q.eq("provider", args.provider).eq("providerId", args.providerId),
      )
      .first();
    return link === null ? null : await ctx.db.get(link.artistId);
  },
});

/** Resolve the unified track a provider id maps to (via the reverse index). */
export const getTrackByProvider = query({
  args: { provider, providerId: v.string() },
  returns: v.union(v.null(), trackDoc),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("trackProviders")
      .withIndex("by_provider_id", (q) =>
        q.eq("provider", args.provider).eq("providerId", args.providerId),
      )
      .first();
    return link === null ? null : await ctx.db.get(link.trackId);
  },
});

/**
 * Resolve an artist's profile image per a source policy (artist-image-auto-sync):
 * the field-source policy applied to `imageUrl`, picking from the artist's
 * per-provider provenance, falling back to the canonical image. Resolved via the
 * provider reverse index; `null` if the provider id is unknown.
 */
export const getArtistImage = query({
  args: { provider, providerId: v.string(), policy: v.optional(fieldSourcePolicy) },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("artistProviders")
      .withIndex("by_provider_id", (q) =>
        q.eq("provider", args.provider).eq("providerId", args.providerId),
      )
      .first();
    const artist = link === null ? null : await ctx.db.get(link.artistId);
    return artist === null
      ? null
      : (projectField(
          artist.providers,
          args.policy,
          (entry) => entry.imageUrl,
          artist.imageUrl,
        ) ?? null);
  },
});

/**
 * Project a track's preview URL per a field-source policy, resolved by a
 * provider id (via the reverse index). The track-preview analog of
 * `getArtistImage` — heardzic/bandzic pick their preferred provider's clip.
 * `null` when the provider id is unknown or no chosen provider has a preview.
 */
export const getTrackPreview = query({
  args: { provider, providerId: v.string(), policy: v.optional(fieldSourcePolicy) },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("trackProviders")
      .withIndex("by_provider_id", (q) =>
        q.eq("provider", args.provider).eq("providerId", args.providerId),
      )
      .first();
    const track = link === null ? null : await ctx.db.get(link.trackId);
    return track === null
      ? null
      : (projectField(
          track.providers,
          args.policy,
          (entry) => entry.previewUrl,
          undefined,
        ) ?? null);
  },
});

/** Full-text search artists by name. */
export const searchArtists = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  returns: v.array(artistDoc),
  handler: async (ctx, args) =>
    await ctx.db
      .query("artists")
      .withSearchIndex("search_name", (q) => q.search("name", args.query))
      .take(args.limit ?? DEFAULT_SEARCH_LIMIT),
});

/** Full-text search tracks by title. */
export const searchTracks = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  returns: v.array(trackDoc),
  handler: async (ctx, args) =>
    await ctx.db
      .query("tracks")
      .withSearchIndex("search_title", (q) => q.search("title", args.query))
      .take(args.limit ?? DEFAULT_SEARCH_LIMIT),
});

/**
 * Select up to `limit` catalog rows of a kind, excluding `excludeIds`, ordered by
 * a stable rotation. Default `salt` is the UTC day (rotates daily); pass a custom
 * `salt` for a different deterministic shuffle. The selection primitive for daily
 * pickers — the daily-puzzle assignment (freeze, no-repeat) stays host-side.
 *
 * The eligible universe is the first `scanLimit` rows (creation order); rows past
 * it are not selectable. Keep a catalog under `scanLimit`, or raise it, so the
 * rotation draws from the whole catalog rather than a fixed prefix.
 */
export const selectEligible = query({
  args: {
    kind: v.union(v.literal("artist"), v.literal("track")),
    limit: v.number(),
    excludeIds: v.optional(v.array(v.string())),
    salt: v.optional(v.string()),
    scanLimit: v.optional(v.number()),
  },
  returns: v.array(v.union(artistDoc, trackDoc)),
  handler: async (
    ctx,
    args,
  ): Promise<Array<Doc<"artists"> | Doc<"tracks">>> => {
    const salt = args.salt ?? utcDateBucket(Date.now());
    const exclude = new Set(args.excludeIds ?? []);
    const scanLimit = args.scanLimit ?? DEFAULT_SCAN_LIMIT;
    const candidates: Array<Doc<"artists"> | Doc<"tracks">> =
      args.kind === "artist"
        ? await ctx.db.query("artists").take(scanLimit)
        : await ctx.db.query("tracks").take(scanLimit);
    const eligible = candidates.filter((row) => !exclude.has(row._id));
    return orderByDailyRotation(eligible, salt).slice(0, args.limit);
  },
});
