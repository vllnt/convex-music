import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel.js";
import { type MutationCtx, mutation } from "../_generated/server.js";
import { artistValue, provider, trackValue } from "../validators.js";
import type { Provider } from "../../shared.js";
import {
  type ArtistMergeState,
  type TrackMergeState,
  mergeArtist,
  mergeTrack,
} from "./merge.js";

/** Lowercased, trimmed name — the case-insensitive artist identity key. */
function nameKeyOf(name: string): string {
  return name.trim().toLowerCase();
}

/** Set-union two id lists. */
function unionIds<T extends string>(a: readonly T[], b: readonly T[]): T[] {
  return [...new Set([...a, ...b])];
}

function artistMergeState(doc: Doc<"artists">): ArtistMergeState {
  return {
    genres: doc.genres,
    popularity: doc.popularity,
    imageUrl: doc.imageUrl,
    country: doc.country,
    gender: doc.gender,
    debutYear: doc.debutYear,
    members: doc.members,
    providers: doc.providers,
  };
}

function trackMergeState(doc: Doc<"tracks">): TrackMergeState {
  return {
    genres: doc.genres,
    popularity: doc.popularity,
    durationMs: doc.durationMs,
    providers: doc.providers,
  };
}

/** Find the artist a provider id already resolves to, via the reverse index. */
async function findArtistByProvider(
  ctx: MutationCtx,
  prov: Provider,
  providerId: string,
): Promise<Id<"artists"> | null> {
  const link = await ctx.db
    .query("artistProviders")
    .withIndex("by_provider_id", (q) =>
      q.eq("provider", prov).eq("providerId", providerId),
    )
    .first();
  return link?.artistId ?? null;
}

/** Ensure exactly one `(artistId, provider)` link points at `providerId`. */
async function linkArtistProvider(
  ctx: MutationCtx,
  artistId: Id<"artists">,
  prov: Provider,
  providerId: string,
): Promise<void> {
  const links = await ctx.db
    .query("artistProviders")
    .withIndex("by_artist", (q) => q.eq("artistId", artistId))
    .collect();
  const sameProvider = links.filter((link) => link.provider === prov);
  await Promise.all(
    sameProvider
      .filter((link) => link.providerId !== providerId)
      .map((link) => ctx.db.delete(link._id)),
  );
  if (!sameProvider.some((link) => link.providerId === providerId)) {
    await ctx.db.insert("artistProviders", { artistId, provider: prov, providerId });
  }
}

/** Find the track a provider id already resolves to, via the reverse index. */
async function findTrackByProvider(
  ctx: MutationCtx,
  prov: Provider,
  providerId: string,
): Promise<Id<"tracks"> | null> {
  const link = await ctx.db
    .query("trackProviders")
    .withIndex("by_provider_id", (q) =>
      q.eq("provider", prov).eq("providerId", providerId),
    )
    .first();
  return link?.trackId ?? null;
}

/** Ensure exactly one `(trackId, provider)` link points at `providerId`. */
async function linkTrackProvider(
  ctx: MutationCtx,
  trackId: Id<"tracks">,
  prov: Provider,
  providerId: string,
): Promise<void> {
  const links = await ctx.db
    .query("trackProviders")
    .withIndex("by_track", (q) => q.eq("trackId", trackId))
    .collect();
  const sameProvider = links.filter((link) => link.provider === prov);
  await Promise.all(
    sameProvider
      .filter((link) => link.providerId !== providerId)
      .map((link) => ctx.db.delete(link._id)),
  );
  if (!sameProvider.some((link) => link.providerId === providerId)) {
    await ctx.db.insert("trackProviders", { trackId, provider: prov, providerId });
  }
}

/**
 * Upsert one provider's artist into the unified catalog. Identity resolves by the
 * existing provider link first, else by case-normalized name (`nameKey`). Merged
 * across providers via `providers[]`. Returns the artist id.
 *
 * Limitation: name-only fallback is lossy — a rename can split one artist across
 * providers, and two distinct same-named artists collapse into one. A stable
 * cross-provider id (MusicBrainz MBID) keyed ahead of name is the planned
 * hardening; until then keep one provider authoritative per artist where exact.
 */
export const upsertArtist = mutation({
  args: { provider, externalId: v.string(), value: artistValue },
  returns: v.id("artists"),
  handler: async (ctx, args): Promise<Id<"artists">> => {
    const now = Date.now();
    const nameKey = nameKeyOf(args.value.name);
    const byProviderId = await findArtistByProvider(
      ctx,
      args.provider,
      args.externalId,
    );
    const existing = byProviderId
      ? await ctx.db.get(byProviderId)
      : await ctx.db
          .query("artists")
          .withIndex("by_name_key", (q) => q.eq("nameKey", nameKey))
          .first();
    const merged = mergeArtist(
      existing ? artistMergeState(existing) : null,
      args.provider,
      args.externalId,
      args.value,
    );
    const fields = {
      name: args.value.name,
      nameKey,
      ...merged,
      updatedAt: now,
      syncStatus: "synced" as const,
      lastSyncedAt: now,
    };
    let artistId: Id<"artists">;
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      artistId = existing._id;
    } else {
      artistId = await ctx.db.insert("artists", fields);
    }
    await linkArtistProvider(ctx, artistId, args.provider, args.externalId);
    return artistId;
  },
});

/**
 * Upsert one provider's track into the unified catalog (identity by ISRC; merged
 * across providers). `artistIds` are the resolved catalog artist ids to relate.
 * Throws if the track has no ISRC (the identity guard). Returns the track id.
 */
export const upsertTrack = mutation({
  args: {
    provider,
    externalId: v.string(),
    value: trackValue,
    artistIds: v.optional(v.array(v.id("artists"))),
  },
  returns: v.id("tracks"),
  handler: async (ctx, args): Promise<Id<"tracks">> => {
    if (args.value.isrc === undefined) {
      throw new Error("upsertTrack requires the track to carry an ISRC");
    }
    const isrc = args.value.isrc;
    const now = Date.now();
    // ISRC-mismatch guard (catalog-store.1): if this provider id already maps to
    // a track with a DIFFERENT ISRC, the provider disagrees on identity — throw
    // rather than silently re-point the link (which would orphan provenance).
    const priorLink = await findTrackByProvider(
      ctx,
      args.provider,
      args.externalId,
    );
    const priorTrack = priorLink ? await ctx.db.get(priorLink) : null;
    if (priorTrack && priorTrack.isrc !== isrc) {
      throw new Error(
        `provider ${args.provider} id ${args.externalId} changed ISRC ` +
          `${priorTrack.isrc} -> ${isrc}; refusing to silently re-link`,
      );
    }
    const existing = await ctx.db
      .query("tracks")
      .withIndex("by_isrc", (q) => q.eq("isrc", isrc))
      .unique();
    const merged = mergeTrack(
      existing ? trackMergeState(existing) : null,
      args.provider,
      args.externalId,
      args.value,
    );
    const artistIds = unionIds(
      existing?.artistIds ?? [],
      args.artistIds ?? [],
    );
    const fields = {
      isrc,
      title: args.value.title,
      artistIds,
      ...merged,
      updatedAt: now,
      syncStatus: "synced" as const,
      lastSyncedAt: now,
    };
    let trackId: Id<"tracks">;
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      trackId = existing._id;
    } else {
      trackId = await ctx.db.insert("tracks", fields);
    }
    await linkTrackProvider(ctx, trackId, args.provider, args.externalId);
    return trackId;
  },
});

/**
 * Upsert a playlist by its source-provider identity. `trackIds` is the resolved
 * ordered membership (replace semantics; diff-aware membership is `catalog-store.7`).
 */
export const upsertPlaylist = mutation({
  args: {
    provider,
    providerId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    coverUrl: v.optional(v.string()),
    url: v.optional(v.string()),
    owner: v.optional(v.string()),
    trackIds: v.array(v.id("tracks")),
  },
  returns: v.id("playlists"),
  handler: async (ctx, args): Promise<Id<"playlists">> => {
    const now = Date.now();
    const existing = await ctx.db
      .query("playlists")
      .withIndex("by_provider", (q) =>
        q.eq("provider", args.provider).eq("providerId", args.providerId),
      )
      .unique();
    const fields = {
      title: args.title,
      provider: args.provider,
      providerId: args.providerId,
      description: args.description,
      coverUrl: args.coverUrl,
      url: args.url,
      owner: args.owner,
      trackIds: args.trackIds,
      updatedAt: now,
      syncStatus: "synced" as const,
      lastSyncedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("playlists", fields);
  },
});

/** Upsert an album by source-provider identity (provider + providerId). */
export const upsertAlbum = mutation({
  args: {
    provider,
    providerId: v.string(),
    title: v.string(),
    artistIds: v.array(v.id("artists")),
    releaseDate: v.optional(v.string()),
    coverUrl: v.optional(v.string()),
    url: v.optional(v.string()),
    trackCount: v.optional(v.number()),
    trackIds: v.array(v.id("tracks")),
  },
  returns: v.id("albums"),
  handler: async (ctx, args): Promise<Id<"albums">> => {
    const now = Date.now();
    const existing = await ctx.db
      .query("albums")
      .withIndex("by_provider", (q) =>
        q.eq("provider", args.provider).eq("providerId", args.providerId),
      )
      .unique();
    const fields = {
      title: args.title,
      provider: args.provider,
      providerId: args.providerId,
      artistIds: args.artistIds,
      releaseDate: args.releaseDate,
      coverUrl: args.coverUrl,
      url: args.url,
      trackCount: args.trackCount,
      trackIds: args.trackIds,
      updatedAt: now,
      syncStatus: "synced" as const,
      lastSyncedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("albums", fields);
  },
});
