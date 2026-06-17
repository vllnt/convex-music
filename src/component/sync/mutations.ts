import { v } from "convex/values";
import { type MutationCtx, mutation } from "../_generated/server.js";
import type { Doc } from "../_generated/dataModel.js";
import { isStale } from "./lifecycle.js";

/** Default rows scanned per markStale run. */
const DEFAULT_LIMIT = 200;

/** A synced catalog row carrying the fields staleness needs. */
type Syncable = Doc<"artists"> | Doc<"tracks">;

/** Mark a batch of synced rows whose freshness window has elapsed as `stale`. */
async function markStaleRows(
  ctx: MutationCtx,
  rows: Syncable[],
  now: number,
): Promise<number> {
  const stale = rows.filter((row) =>
    isStale(row.lastSyncedAt, row.popularity, now),
  );
  await Promise.all(
    stale.map((row) =>
      ctx.db.patch(row._id, { syncStatus: "stale", updatedAt: now }),
    ),
  );
  return stale.length;
}

/**
 * Flip past-freshness-window catalog rows from `synced` to `stale` for a kind.
 * The freshness window scales by popularity (volatile-popular rows go stale
 * sooner). Returns how many were newly marked. The auto-import sweep re-syncs
 * stale rows; this is the detection half. Idempotent + bounded; mount-safe.
 */
export const markStale = mutation({
  args: {
    kind: v.union(v.literal("artist"), v.literal("track")),
    limit: v.optional(v.number()),
    now: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const at = args.now ?? Date.now();
    const take = args.limit ?? DEFAULT_LIMIT;
    if (args.kind === "artist") {
      const rows = await ctx.db
        .query("artists")
        .withIndex("by_sync", (q) => q.eq("syncStatus", "synced"))
        .take(take);
      return await markStaleRows(ctx, rows, at);
    }
    const rows = await ctx.db
      .query("tracks")
      .withIndex("by_sync", (q) => q.eq("syncStatus", "synced"))
      .take(take);
    return await markStaleRows(ctx, rows, at);
  },
});

/** Default lease before a `running` row is considered stuck (10 min). */
const DEFAULT_SYNC_LEASE_MS = 10 * 60 * 1000;

/**
 * Mark a catalog row as `running` for the duration of a sync — a lightweight
 * lease so a crashed re-sync can be recovered. Patched by id (the row exists).
 */
export const markSyncRunning = mutation({
  args: { id: v.union(v.id("artists"), v.id("tracks")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      syncStatus: "running",
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Recover rows stuck in `running` past the lease (a re-sync that crashed before
 * completing) by salvaging them back to `stale` for re-pickup. Bounded +
 * idempotent; returns how many were recovered.
 */
export const recoverStuckSyncs = mutation({
  args: {
    kind: v.union(v.literal("artist"), v.literal("track")),
    leaseMs: v.optional(v.number()),
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const at = args.now ?? Date.now();
    const cutoff = at - (args.leaseMs ?? DEFAULT_SYNC_LEASE_MS);
    const take = args.limit ?? DEFAULT_LIMIT;
    const rows: Syncable[] =
      args.kind === "artist"
        ? await ctx.db
            .query("artists")
            .withIndex("by_sync", (q) => q.eq("syncStatus", "running"))
            .take(take)
        : await ctx.db
            .query("tracks")
            .withIndex("by_sync", (q) => q.eq("syncStatus", "running"))
            .take(take);
    const stuck = rows.filter((row) => row.updatedAt < cutoff);
    await Promise.all(
      stuck.map((row) =>
        ctx.db.patch(row._id, { syncStatus: "stale", updatedAt: at }),
      ),
    );
    return stuck.length;
  },
});
