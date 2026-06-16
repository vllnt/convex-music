import { v } from "convex/values";
import { mutation } from "./_generated/server.js";
import type { Doc } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";
import { cacheValue, entityKind, provider } from "./validators.js";
import { NEVER_EXPIRES } from "../shared.js";

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
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("cacheEntries", fields);
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
    await ctx.db.delete(existing._id);
    return true;
  },
});

/** Delete every expired entry. Idempotent; safe to run on a schedule. */
export const pruneExpired = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("cacheEntries")
      .withIndex("by_expiry", (q) => q.lte("expiresAt", now))
      .collect();
    for (const entry of expired) {
      await ctx.db.delete(entry._id);
    }
    return expired.length;
  },
});
