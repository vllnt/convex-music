import { v } from "convex/values";
import { api } from "./_generated/api.js";
import { mutation } from "./_generated/server.js";
import type { Doc } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";
import { cacheValue, entityKind, provider } from "./validators.js";
import { NEVER_EXPIRES } from "../shared.js";

const CACHE_STATS_KEY = "all" as const;
const PRUNE_BATCH_SIZE = 100;
const STATS_BACKFILL_BATCH_SIZE = 100;

async function adjustCacheTotal(ctx: MutationCtx, delta: number): Promise<void> {
  if (delta === 0) return;
  const stats = await ctx.db
    .query("cacheStats")
    .withIndex("by_key", (q) => q.eq("key", CACHE_STATS_KEY))
    .unique();
  if (stats === null) {
    await ctx.db.insert("cacheStats", {
      key: CACHE_STATS_KEY,
      total: Math.max(0, delta),
    });
    return;
  }
  await ctx.db.patch("cacheStats", stats._id, {
    total: Math.max(0, stats.total + delta),
  });
}

async function findEntry(
  ctx: MutationCtx,
  kind: Doc<"cacheEntries">["kind"],
  prov: Doc<"cacheEntries">["provider"],
  externalId: string,
): Promise<Doc<"cacheEntries"> | null> {
  return await ctx.db
    .query("cacheEntries")
    .withIndex("by_lookup", (q) =>
      q.eq("kind", kind).eq("provider", prov).eq("externalId", externalId),
    )
    .unique();
}

/**
 * Cache (insert or refresh) one provider's normalized facts for an entity.
 * `ttlMs` omitted means the entry never expires. Returns the entry id.
 */
export const put = mutation({
  args: {
    kind: entityKind,
    provider,
    externalId: v.string(),
    isrc: v.optional(v.string()),
    value: cacheValue,
    ttlMs: v.optional(v.number()),
  },
  returns: v.id("cacheEntries"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = args.ttlMs === undefined ? NEVER_EXPIRES : now + args.ttlMs;
    const fields = {
      kind: args.kind,
      provider: args.provider,
      externalId: args.externalId,
      isrc: args.isrc,
      value: args.value,
      fetchedAt: now,
      expiresAt,
    };
    const existing = await findEntry(
      ctx,
      args.kind,
      args.provider,
      args.externalId,
    );
    if (existing !== null) {
      await ctx.db.patch("cacheEntries", existing._id, {
        ...fields,
        countedInStats: true,
      });
      if (existing.countedInStats !== true) {
        await adjustCacheTotal(ctx, 1);
      }
      return existing._id;
    }
    const id = await ctx.db.insert("cacheEntries", {
      ...fields,
      countedInStats: true,
    });
    await adjustCacheTotal(ctx, 1);
    return id;
  },
});

/** Drop a single cached entry. Returns whether a row was deleted. */
export const invalidate = mutation({
  args: { kind: entityKind, provider, externalId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await findEntry(
      ctx,
      args.kind,
      args.provider,
      args.externalId,
    );
    if (existing === null) {
      return false;
    }
    await ctx.db.delete("cacheEntries", existing._id);
    if (existing.countedInStats === true) {
      await adjustCacheTotal(ctx, -1);
    }
    return true;
  },
});

/** Count pre-upgrade cache rows in bounded, idempotent batches. */
export const reconcileCacheStats = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const uncounted = await ctx.db
      .query("cacheEntries")
      .withIndex("by_counted", (q) => q.eq("countedInStats", undefined))
      .take(STATS_BACKFILL_BATCH_SIZE);
    for (const entry of uncounted) {
      await ctx.db.patch("cacheEntries", entry._id, { countedInStats: true });
    }
    await adjustCacheTotal(ctx, uncounted.length);
    if (uncounted.length === STATS_BACKFILL_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, api.mutations.reconcileCacheStats, {});
    }
    return uncounted.length;
  },
});

/**
 * Delete one bounded batch of expired entries. A full batch immediately
 * schedules another pass so a backlog drains without one oversized mutation.
 */
export const pruneExpired = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("cacheEntries")
      .withIndex("by_expiry", (q) => q.lte("expiresAt", now))
      .take(PRUNE_BATCH_SIZE);
    for (const entry of expired) {
      await ctx.db.delete("cacheEntries", entry._id);
    }
    await adjustCacheTotal(
      ctx,
      -expired.filter((entry) => entry.countedInStats === true).length,
    );
    if (expired.length === PRUNE_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, api.mutations.pruneExpired, {});
    }
    return expired.length;
  },
});
