import { v } from "convex/values";
import { type MutationCtx, mutation } from "../_generated/server.js";
import type { Doc } from "../_generated/dataModel.js";
import { artistDoc, trackDoc } from "../validators.js";
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
 * Atomically claim the next `stale` catalog row of a kind for re-sync: find one
 * stale row via the index and flip it to `running` in the SAME transaction. The
 * find + claim are one mutation, so two concurrent refresh sweeps can never both
 * take the same row — Convex serializes the conflicting patch and the loser
 * re-reads (the row is now `running`, no longer `stale`) and moves on. Returns
 * the claimed row (so the caller has its `providers`), or `null` when none are
 * stale. The re-import's upsert returns it to `synced`; `recoverStuckSyncs`
 * salvages a lease whose holder crashed. Replaces a blind patch-by-id, which had
 * no compare-and-set and could double-claim across action/mutation boundaries.
 */
export const claimNextStale = mutation({
  args: { kind: v.union(v.literal("artist"), v.literal("track")) },
  returns: v.union(v.null(), artistDoc, trackDoc),
  handler: async (ctx, args) => {
    const now = Date.now();
    if (args.kind === "artist") {
      const row = await ctx.db
        .query("artists")
        .withIndex("by_sync", (q) => q.eq("syncStatus", "stale"))
        .first();
      if (row === null) return null;
      await ctx.db.patch(row._id, { syncStatus: "running", updatedAt: now });
      return row;
    }
    const row = await ctx.db
      .query("tracks")
      .withIndex("by_sync", (q) => q.eq("syncStatus", "stale"))
      .first();
    if (row === null) return null;
    await ctx.db.patch(row._id, { syncStatus: "running", updatedAt: now });
    return row;
  },
});

/**
 * Recover rows stuck in `running` past the lease (a re-sync that crashed before
 * completing) by salvaging them back to `stale` for re-pickup. Bounded +
 * idempotent; returns how many were recovered.
 *
 * Stuck = `updatedAt` older than `leaseMs` (default 10 min). A refresh re-syncs a
 * single row (one provider fetch + a few upserts) in seconds, so the lease is far
 * longer than a healthy run; only a genuinely crashed run is reclaimed. If a
 * deployment runs much slower single-row refreshes, raise `leaseMs` above that
 * duration so a still-running sync is never false-positive reclaimed.
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
