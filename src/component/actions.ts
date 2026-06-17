/**
 * Read-through fetch actions. Resolve a cached provider token, build the adapter,
 * fetch on miss, promote the normalized facts into the durable catalog, and
 * return the typed catalog row. Cache-through: an entity already in the catalog
 * is returned without re-fetching unless `force` is set. `search` is discovery —
 * it returns normalized provider hits without promoting them.
 */

import { v } from "convex/values";
import { api } from "./_generated/api.js";
import type { Doc } from "./_generated/dataModel.js";
import { action } from "./_generated/server.js";
import type {
  ArtistRef,
  NormalizedArtist,
  NormalizedTrack,
} from "../client/types.js";
import { getProviderToken } from "./providers/actions.js";
import { createProvider } from "./providers/registry.js";
import { artistDoc, artistValue, provider, trackDoc, trackValue } from "./validators.js";

/** A normalized search hit (provider id + value), discriminated by kind. */
type SearchHit =
  | { type: "artist"; externalId: string; value: NormalizedArtist }
  | { type: "track"; externalId: string; value: NormalizedTrack };

const searchType = v.union(v.literal("artist"), v.literal("track"));

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

/** A track/album artist ref that carries a provider id. */
function hasExternalId(
  ref: ArtistRef,
): ref is ArtistRef & { externalId: string } {
  return ref.externalId !== undefined;
}

/**
 * Fetch an artist by provider id, promoting it into the catalog. Returns the
 * unified artist row (cache-through unless `force`).
 */
export const fetchArtist = action({
  args: { provider, externalId: v.string(), force: v.optional(v.boolean()) },
  returns: v.union(v.null(), artistDoc),
  handler: async (ctx, args): Promise<Doc<"artists"> | null> => {
    if (args.force !== true) {
      const existing = await ctx.runQuery(
        api.catalog.queries.getArtistByProvider,
        { provider: args.provider, providerId: args.externalId },
      );
      if (existing !== null) return existing;
    }
    const token = await getProviderToken(ctx, args.provider);
    const adapter = createProvider(args.provider, () => Promise.resolve(token));
    const result = await adapter.getArtist(args.externalId);
    const artistId = await ctx.runMutation(
      api.catalog.mutations.upsertArtist,
      { provider: args.provider, externalId: result.externalId, value: result.value },
    );
    return await ctx.runQuery(api.catalog.queries.getArtist, { id: artistId });
  },
});

/**
 * Fetch a track by provider id, resolving + promoting its credited artists and
 * the track into the catalog. Returns the unified track row (cache-through
 * unless `force`).
 */
export const fetchTrack = action({
  args: { provider, externalId: v.string(), force: v.optional(v.boolean()) },
  returns: v.union(v.null(), trackDoc),
  handler: async (ctx, args): Promise<Doc<"tracks"> | null> => {
    if (args.force !== true) {
      const existing = await ctx.runQuery(
        api.catalog.queries.getTrackByProvider,
        { provider: args.provider, providerId: args.externalId },
      );
      if (existing !== null) return existing;
    }
    const token = await getProviderToken(ctx, args.provider);
    const adapter = createProvider(args.provider, () => Promise.resolve(token));
    const result = await adapter.getTrack(args.externalId);
    const artistIds = await Promise.all(
      result.value.artists.filter(hasExternalId).map((ref) =>
        ctx.runMutation(api.catalog.mutations.upsertArtist, {
          provider: args.provider,
          externalId: ref.externalId,
          value: { name: ref.name, genres: [] },
        }),
      ),
    );
    const trackId = await ctx.runMutation(api.catalog.mutations.upsertTrack, {
      provider: args.provider,
      externalId: result.externalId,
      value: result.value,
      artistIds,
    });
    return await ctx.runQuery(api.catalog.queries.getTrack, { id: trackId });
  },
});

/**
 * Search a provider for artists or tracks. Returns normalized hits (provider id +
 * value); does not promote — promotion happens on an explicit fetch/import.
 */
export const search = action({
  args: { provider, query: v.string(), type: searchType },
  returns: v.array(searchResult),
  handler: async (ctx, args): Promise<SearchHit[]> => {
    const token = await getProviderToken(ctx, args.provider);
    const adapter = createProvider(args.provider, () => Promise.resolve(token));
    const results = await adapter.search(args.query, args.type);
    return results.map((hit) =>
      hit.type === "artist"
        ? {
            type: hit.type,
            externalId: hit.data.externalId,
            value: hit.data.value,
          }
        : {
            type: hit.type,
            externalId: hit.data.externalId,
            value: hit.data.value,
          },
    );
  },
});
