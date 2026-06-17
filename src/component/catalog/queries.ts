import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel.js";
import { query } from "../_generated/server.js";
import { artistDoc, playlistDoc, trackDoc } from "../validators.js";
import { orderByDailyRotation, utcDateBucket } from "./browse_order.js";

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
