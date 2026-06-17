import { v } from "convex/values";
import { components } from "./_generated/api.js";
import { action, mutation, query } from "./_generated/server.js";
import { Music } from "../../src/client/index.js";
import {
  artistDoc,
  artistValue,
  cacheEntryDoc,
  cacheValue,
  entityKind,
  playlistDoc,
  provider,
  trackDoc,
  trackValue,
} from "../../src/component/validators.js";

const searchResult = v.union(
  v.object({
    type: v.literal("artist"),
    externalId: v.string(),
    value: artistValue,
  }),
  v.object({
    type: v.literal("track"),
    externalId: v.string(),
    value: trackValue,
  }),
);

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

export const upsertArtist = mutation({
  args: { provider, externalId: v.string(), value: artistValue },
  returns: v.string(),
  handler: (ctx, args) => music.upsertArtist(ctx, args),
});

export const upsertTrack = mutation({
  args: {
    provider,
    externalId: v.string(),
    value: trackValue,
    artistIds: v.optional(v.array(v.string())),
  },
  returns: v.string(),
  handler: (ctx, args) => music.upsertTrack(ctx, args),
});

export const upsertPlaylist = mutation({
  args: {
    provider,
    providerId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    coverUrl: v.optional(v.string()),
    url: v.optional(v.string()),
    owner: v.optional(v.string()),
    trackIds: v.array(v.string()),
  },
  returns: v.string(),
  handler: (ctx, args) => music.upsertPlaylist(ctx, args),
});

export const getArtist = query({
  args: { id: v.string() },
  returns: v.union(v.null(), artistDoc),
  handler: (ctx, args) => music.getArtist(ctx, args.id),
});

export const getTrack = query({
  args: { id: v.string() },
  returns: v.union(v.null(), trackDoc),
  handler: (ctx, args) => music.getTrack(ctx, args.id),
});

export const getPlaylist = query({
  args: { id: v.string() },
  returns: v.union(v.null(), playlistDoc),
  handler: (ctx, args) => music.getPlaylist(ctx, args.id),
});

export const getTrackByIsrc = query({
  args: { isrc: v.string() },
  returns: v.union(v.null(), trackDoc),
  handler: (ctx, args) => music.getTrackByIsrc(ctx, args.isrc),
});

export const searchArtists = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  returns: v.array(artistDoc),
  handler: (ctx, args) => music.searchArtists(ctx, args.query, args.limit),
});

export const searchTracks = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  returns: v.array(trackDoc),
  handler: (ctx, args) => music.searchTracks(ctx, args.query, args.limit),
});

export const selectEligible = query({
  args: {
    kind: v.union(v.literal("artist"), v.literal("track")),
    limit: v.number(),
    excludeIds: v.optional(v.array(v.string())),
    salt: v.optional(v.string()),
    scanLimit: v.optional(v.number()),
  },
  returns: v.array(v.union(artistDoc, trackDoc)),
  handler: (ctx, args) => music.selectEligible(ctx, args),
});

export const fetchArtist = action({
  args: { provider, externalId: v.string(), force: v.optional(v.boolean()) },
  returns: v.union(v.null(), artistDoc),
  handler: (ctx, args) => music.fetchArtist(ctx, args),
});

export const fetchTrack = action({
  args: { provider, externalId: v.string(), force: v.optional(v.boolean()) },
  returns: v.union(v.null(), trackDoc),
  handler: (ctx, args) => music.fetchTrack(ctx, args),
});

export const search = action({
  args: {
    provider,
    query: v.string(),
    type: v.union(v.literal("artist"), v.literal("track")),
  },
  returns: v.array(searchResult),
  handler: (ctx, args) => music.search(ctx, args),
});
