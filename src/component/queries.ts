import { v } from "convex/values";
import { query } from "./_generated/server.js";
import type { Doc } from "./_generated/dataModel.js";
import { cacheEntryDoc, entityKind, provider } from "./validators.js";

/** An entry is fresh while its expiry is still in the future. */
function isFresh(entry: Doc<"cacheEntries">, now: number): boolean {
  return entry.expiresAt > now;
}

function toPublicEntry(
  entry: Doc<"cacheEntries">,
): Omit<Doc<"cacheEntries">, "countedInStats"> {
  const { countedInStats: _countedInStats, ...publicEntry } = entry;
  return publicEntry;
}

/** Fetch one cached entry by its provider key, or null if missing/expired. */
export const get = query({
  args: { kind: entityKind, provider, externalId: v.string() },
  returns: v.union(v.null(), cacheEntryDoc),
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("cacheEntries")
      .withIndex("by_lookup", (q) =>
        q
          .eq("kind", args.kind)
          .eq("provider", args.provider)
          .eq("externalId", args.externalId),
      )
      .unique();
    return entry !== null && isFresh(entry, Date.now())
      ? toPublicEntry(entry)
      : null;
  },
});

/** Every fresh cached track for an ISRC, across providers. */
export const getByIsrc = query({
  args: { isrc: v.string() },
  returns: v.array(cacheEntryDoc),
  handler: async (ctx, args) => {
    const now = Date.now();
    const entries = await ctx.db
      .query("cacheEntries")
      .withIndex("by_isrc", (q) => q.eq("kind", "track").eq("isrc", args.isrc))
      .collect();
    return entries
      .filter((entry) => isFresh(entry, now))
      .map(toPublicEntry);
  },
});

/** Maintained count of cached entries (fresh + expired). */
export const stats = query({
  args: {},
  returns: v.object({ total: v.number() }),
  handler: async (ctx) => {
    const stats = await ctx.db
      .query("cacheStats")
      .withIndex("by_key", (q) => q.eq("key", "all"))
      .unique();
    return { total: stats?.total ?? 0 };
  },
});
