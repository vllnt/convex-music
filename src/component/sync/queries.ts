import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { artistDoc, trackDoc } from "../validators.js";

/** Default rows returned per listStale call. */
const DEFAULT_LIMIT = 100;

/**
 * List catalog rows currently marked `stale` for a kind (bounded). The
 * auto-import refresh sweep consumes this to re-sync them; also useful for
 * "what's stale" observability. Rows come from a query (always existing), so
 * the refresh runner needs no load-by-id.
 */
export const listStale = query({
  args: {
    kind: v.union(v.literal("artist"), v.literal("track")),
    limit: v.optional(v.number()),
  },
  returns: v.union(v.array(artistDoc), v.array(trackDoc)),
  handler: async (ctx, args) => {
    const take = args.limit ?? DEFAULT_LIMIT;
    if (args.kind === "artist") {
      return await ctx.db
        .query("artists")
        .withIndex("by_sync", (q) => q.eq("syncStatus", "stale"))
        .take(take);
    }
    return await ctx.db
      .query("tracks")
      .withIndex("by_sync", (q) => q.eq("syncStatus", "stale"))
      .take(take);
  },
});
