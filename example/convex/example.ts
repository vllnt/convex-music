import { v } from "convex/values";
import { api, components } from "./_generated/api.js";
import { action, mutation, query } from "./_generated/server.js";
import { Music } from "../../src/client/index.js";
import {
  artistValue,
  cacheValue,
  entityKind,
  importEntityType,
  importMode,
  importPriority,
  importStatus,
  importTargetMode,
  provider,
  providerSecrets,
  trackValue,
} from "../../src/component/validators.js";

/** Convex exposes the host deployment's env vars on `process.env`. */
declare const process: { env: Record<string, string | undefined> };

/**
 * A host cannot re-validate component row ids (`v.id("artists")`) — those tables
 * live in the component, not the host — so host wrappers returning component docs
 * declare a loose return validator. The typed shape is preserved by the `Music`
 * client method return types; consumers read the typed value, not this validator.
 */
const componentDoc = v.any();

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
  returns: componentDoc,
  handler: (ctx, args) => music.get(ctx, args),
});

export const getByIsrc = query({
  args: { isrc: v.string() },
  returns: v.array(componentDoc),
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
  returns: componentDoc,
  handler: (ctx, args) => music.getArtist(ctx, args.id),
});

export const getTrack = query({
  args: { id: v.string() },
  returns: componentDoc,
  handler: (ctx, args) => music.getTrack(ctx, args.id),
});

export const getPlaylist = query({
  args: { id: v.string() },
  returns: componentDoc,
  handler: (ctx, args) => music.getPlaylist(ctx, args.id),
});

export const getTrackByIsrc = query({
  args: { isrc: v.string() },
  returns: componentDoc,
  handler: (ctx, args) => music.getTrackByIsrc(ctx, args.isrc),
});

export const getArtistImage = query({
  args: {
    provider,
    providerId: v.string(),
    policy: v.optional(
      v.union(
        v.object({ from: provider }),
        v.object({ prefer: v.array(provider) }),
      ),
    ),
  },
  returns: v.union(v.null(), v.string()),
  handler: (ctx, args) =>
    ctx.runQuery(components.music.catalog.queries.getArtistImage, args),
});

export const searchArtists = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  returns: v.array(componentDoc),
  handler: (ctx, args) => music.searchArtists(ctx, args.query, args.limit),
});

export const searchTracks = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  returns: v.array(componentDoc),
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
  returns: v.array(componentDoc),
  handler: (ctx, args) => music.selectEligible(ctx, args),
});

export const fetchArtist = action({
  args: { provider, externalId: v.string(), force: v.optional(v.boolean()) },
  returns: componentDoc,
  handler: (ctx, args) => music.fetchArtist(ctx, args),
});

export const fetchTrack = action({
  args: { provider, externalId: v.string(), force: v.optional(v.boolean()) },
  returns: componentDoc,
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

export const configure = mutation({
  args: { provider, secrets: providerSecrets },
  returns: v.null(),
  handler: (ctx, args) => music.configure(ctx, args.provider, args.secrets),
});

const importRequestArgs = {
  entityType: importEntityType,
  requestType: importMode,
  targetMode: importTargetMode,
  providerScope: v.string(),
  provider: v.optional(provider),
  providerId: v.optional(v.string()),
  entityId: v.optional(v.string()),
  name: v.optional(v.string()),
  isrc: v.optional(v.string()),
  url: v.optional(v.string()),
  withTracks: v.optional(v.boolean()),
  priority: v.optional(importPriority),
};

export const createImportRequest = mutation({
  args: importRequestArgs,
  returns: v.object({ requestId: v.string(), deduped: v.boolean() }),
  handler: (ctx, args) =>
    ctx.runMutation(components.music.imports.mutations.createRequest, args),
});

export const getImportRequest = query({
  args: { requestId: v.string() },
  returns: componentDoc,
  handler: (ctx, args) =>
    ctx.runQuery(components.music.imports.queries.getRequest, {
      requestId: args.requestId,
    }),
});

export const listImportRequests = query({
  args: { status: importStatus, limit: v.optional(v.number()) },
  returns: v.array(componentDoc),
  handler: (ctx, args) =>
    ctx.runQuery(components.music.imports.queries.listRequests, args),
});

export const importArtist = action({
  args: {
    provider,
    targetMode: v.union(v.literal("name"), v.literal("providerId")),
    name: v.optional(v.string()),
    providerId: v.optional(v.string()),
    withTracks: v.optional(v.boolean()),
    mode: v.optional(importMode),
    priority: v.optional(importPriority),
  },
  returns: v.object({ requestId: v.string(), status: v.string() }),
  handler: (ctx, args) => music.importArtist(ctx, args),
});

export const importTrack = action({
  args: {
    provider,
    providerId: v.string(),
    mode: v.optional(importMode),
    priority: v.optional(importPriority),
  },
  returns: v.object({ requestId: v.string(), status: v.string() }),
  handler: (ctx, args) => music.importTrack(ctx, args),
});

export const importPlaylist = action({
  args: {
    provider,
    providerId: v.string(),
    mode: v.optional(importMode),
    priority: v.optional(importPriority),
  },
  returns: v.object({ requestId: v.string(), status: v.string() }),
  handler: (ctx, args) => music.importPlaylist(ctx, args),
});

export const addSource = mutation({
  args: {
    kind: importEntityType,
    by: importTargetMode,
    value: v.string(),
    provider: v.optional(provider),
    withTracks: v.optional(v.boolean()),
    cadenceMs: v.optional(v.number()),
    enabled: v.optional(v.boolean()),
  },
  returns: v.string(),
  handler: (ctx, args) =>
    ctx.runMutation(components.music.sources.mutations.addSource, args),
});

export const removeSource = mutation({
  args: { sourceId: v.string() },
  returns: v.null(),
  handler: (ctx, args) =>
    ctx.runMutation(components.music.sources.mutations.removeSource, {
      sourceId: args.sourceId,
    }),
});

export const setSourceEnabled = mutation({
  args: { sourceId: v.string(), enabled: v.boolean() },
  returns: v.null(),
  handler: (ctx, args) =>
    ctx.runMutation(components.music.sources.mutations.setSourceEnabled, {
      sourceId: args.sourceId,
      enabled: args.enabled,
    }),
});

export const listSources = query({
  args: { enabledOnly: v.optional(v.boolean()), limit: v.optional(v.number()) },
  returns: v.array(componentDoc),
  handler: (ctx, args) =>
    ctx.runQuery(components.music.sources.queries.listSources, args),
});

/** Host setup: read deployment env vars and configure the component once. */
export const configureFromEnv = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const env = process.env;
    await ctx.runMutation(api.example.configure, {
      provider: "spotify",
      secrets: {
        clientId: env.SPOTIFY_CLIENT_ID ?? "",
        clientSecret: env.SPOTIFY_CLIENT_SECRET ?? "",
      },
    });
    await ctx.runMutation(api.example.configure, {
      provider: "apple",
      secrets: {
        issuer: env.APPLE_MUSIC_ISSUER ?? "",
        keyId: env.APPLE_MUSIC_KID ?? "",
        privateKeyPem: env.APPLE_MUSIC_PRIVATE_KEY ?? "",
      },
    });
    return null;
  },
});
