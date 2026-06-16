import { v } from "convex/values";
import { components } from "./_generated/api.js";
import { mutation, query } from "./_generated/server.js";
import { Music } from "../../src/client/index.js";
import {
  cacheEntryDoc,
  cacheValue,
  entityKind,
  provider,
} from "../../src/component/validators.js";

/**
 * Host-app wrappers. The host owns auth: in a real app you would resolve and
 * check identity here before calling the cache write methods, then persist the
 * returned facts into your own domain tables.
 */
const music = new Music(components.music);

export const put = mutation({
  args: {
    kind: entityKind,
    provider,
    externalId: v.string(),
    isrc: v.optional(v.string()),
    value: cacheValue,
    ttlMs: v.optional(v.number()),
  },
  returns: v.string(),
  handler: (ctx, args) => music.put(ctx, args),
});

export const get = query({
  args: { kind: entityKind, provider, externalId: v.string() },
  returns: v.union(v.null(), cacheEntryDoc),
  handler: (ctx, args) => music.get(ctx, args),
});

export const getByIsrc = query({
  args: { isrc: v.string() },
  returns: v.array(cacheEntryDoc),
  handler: (ctx, args) => music.getByIsrc(ctx, args.isrc),
});

export const invalidate = mutation({
  args: { kind: entityKind, provider, externalId: v.string() },
  returns: v.boolean(),
  handler: (ctx, args) => music.invalidate(ctx, args),
});

export const pruneExpired = mutation({
  args: {},
  returns: v.number(),
  handler: (ctx) => music.pruneExpired(ctx),
});

export const stats = query({
  args: {},
  returns: v.object({ total: v.number() }),
  handler: (ctx) => music.stats(ctx),
});
