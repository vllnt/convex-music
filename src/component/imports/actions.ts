/**
 * Import entry points + traversal. An entry point creates a control-plane request
 * (dedup-aware) then runs the traversal, which resolves the target (by provider
 * id or by name-search), fetches it via the adapter, promotes it into the
 * catalog, and drives the request through `running → completed | failed`. The
 * traversal reuses the tested token + adapter + catalog-upsert layers.
 */

import { v } from "convex/values";
import { api, internal } from "../_generated/api.js";
import type { Id } from "../_generated/dataModel.js";
import { type ActionCtx, action } from "../_generated/server.js";
import type { ArtistRef } from "../../client/types.js";
import type { Provider } from "../../shared.js";
import { getProviderToken } from "../providers/actions.js";
import { createProvider } from "../providers/registry.js";
import type { MusicProvider, ProviderTrack } from "../providers/types.js";
import {
  artistTracksMode,
  importMode,
  importPriority,
  importStatus,
  provider,
} from "../validators.js";

/** How an import artist is targeted. */
const artistTargetMode = v.union(v.literal("name"), v.literal("providerId"));

/** A credited artist ref that carries a provider id (so it can be unified). */
function hasExternalId(
  ref: ArtistRef,
): ref is ArtistRef & { externalId: string } {
  return ref.externalId !== undefined;
}

/**
 * Promote a list of provider tracks into the catalog: keep the ISRC-bearing
 * ones, recover ISRC-less ones via the adapter's batch fetch when supported
 * (else drop them), and upsert each track + its credited artists. Returns the
 * unified track ids. Shared by the playlist + album import traversals.
 */
async function promoteTracks(
  ctx: ActionCtx,
  prov: Provider,
  adapter: MusicProvider,
  tracks: ProviderTrack[],
): Promise<Array<Id<"tracks">>> {
  const promotable = tracks.filter((track) => track.value.isrc !== undefined);
  const needsEnrich = tracks.filter((track) => track.value.isrc === undefined);
  const enriched =
    needsEnrich.length > 0 && adapter.getSeveralTracks !== undefined
      ? (
          await adapter.getSeveralTracks(
            needsEnrich.map((track) => track.externalId),
          )
        ).filter((track) => track.value.isrc !== undefined)
      : [];
  return await Promise.all(
    [...promotable, ...enriched].map(async (track) => {
      const artistIds = await Promise.all(
        track.value.artists.filter(hasExternalId).map((ref) =>
          ctx.runMutation(api.catalog.mutations.upsertArtist, {
            provider: prov,
            externalId: ref.externalId,
            value: { name: ref.name, genres: [] },
          }),
        ),
      );
      return await ctx.runMutation(api.catalog.mutations.upsertTrack, {
        provider: prov,
        externalId: track.externalId,
        value: track.value,
        artistIds,
      });
    }),
  );
}

/**
 * Run an artist import: resolve the artist's provider id (directly or via
 * name-search), fetch + promote it into the catalog, and complete (or fail) the
 * request. Returns the terminal status.
 */
export const runArtistImport = action({
  args: {
    requestId: v.id("importRequests"),
    provider,
    targetMode: artistTargetMode,
    name: v.string(),
    providerId: v.string(),
    withTracks: v.optional(v.boolean()),
    tracks: v.optional(artistTracksMode),
  },
  returns: v.object({ status: importStatus }),
  handler: async (ctx, args): Promise<{ status: "completed" | "failed" }> => {
    await ctx.runMutation(internal.imports.mutations.markClaimed, {
      requestId: args.requestId,
    });
    await ctx.runMutation(internal.imports.mutations.markRunning, {
      requestId: args.requestId,
    });
    try {
      let externalId = args.providerId;
      if (args.targetMode === "name") {
        const hits = await ctx.runAction(api.actions.search, {
          provider: args.provider,
          query: args.name,
          type: "artist",
        });
        const first = hits[0];
        if (first === undefined) {
          throw new Error(`no artist found for "${args.name}"`);
        }
        externalId = first.externalId;
      }
      if (externalId === "") {
        throw new Error("import by providerId requires a providerId");
      }
      const token = await getProviderToken(ctx, args.provider);
      const adapter = createProvider(args.provider, () =>
        Promise.resolve(token),
      );
      const result = await adapter.getArtist(externalId);
      const artistId = await ctx.runMutation(
        api.catalog.mutations.upsertArtist,
        {
          provider: args.provider,
          externalId: result.externalId,
          value: result.value,
        },
      );
      let trackCount = 0;
      let tracksPartial = false;
      // `tracks` is the typed depth; `withTracks: true` stays a back-compat alias
      // for `top`. none = artist only, top = top tracks, all = via albums.
      const tracksMode =
        args.tracks ?? (args.withTracks === true ? "top" : "none");
      if (tracksMode !== "none") {
        // Partial-failure tolerance: a failed tracks sub-step (e.g. a provider
        // 403 on top-tracks, or a facts-only provider rejecting albums) must NOT
        // fail the whole artist import — the artist is already promoted; record
        // the tracks as partial and complete.
        try {
          const fetched =
            tracksMode === "all"
              ? (await adapter.getArtistAlbums(externalId)).albums.flatMap(
                  (album) => album.tracks,
                )
              : await adapter.getArtistTopTracks(externalId);
          const promotable = fetched.filter(
            (track) => track.value.isrc !== undefined,
          );
          await Promise.all(
            promotable.map((track) =>
              ctx.runMutation(api.catalog.mutations.upsertTrack, {
                provider: args.provider,
                externalId: track.externalId,
                value: track.value,
                artistIds: [artistId],
              }),
            ),
          );
          trackCount = promotable.length;
        } catch {
          tracksPartial = true;
        }
      }
      await ctx.runMutation(internal.imports.mutations.markCompleted, {
        requestId: args.requestId,
        resolvedArtistId: artistId,
        resultSummary: `imported artist ${result.value.name} (+${trackCount} tracks${
          tracksPartial ? ", tracks partial" : ""
        })`,
      });
      return { status: "completed" };
    } catch (err) {
      await ctx.runMutation(internal.imports.mutations.markFailed, {
        requestId: args.requestId,
        status: "failed",
        errorSummary: String(err),
      });
      return { status: "failed" };
    }
  },
});

/**
 * Import an artist by name or provider id, promoting it into the catalog. Creates
 * a dedup-aware control-plane request, runs the traversal, and returns the
 * request id + terminal status.
 */
export const importArtist = action({
  args: {
    provider,
    targetMode: artistTargetMode,
    name: v.optional(v.string()),
    providerId: v.optional(v.string()),
    withTracks: v.optional(v.boolean()),
    tracks: v.optional(artistTracksMode),
    mode: v.optional(importMode),
    priority: v.optional(importPriority),
  },
  returns: v.object({ requestId: v.string(), status: importStatus }),
  handler: async (
    ctx,
    args,
  ): Promise<{ requestId: string; status: "completed" | "failed" }> => {
    const { requestId } = await ctx.runMutation(
      api.imports.mutations.createRequest,
      {
        entityType: "artist",
        requestType: args.mode ?? "import",
        targetMode: args.targetMode,
        providerScope: args.provider,
        provider: args.provider,
        providerId: args.providerId,
        name: args.name,
        withTracks: args.withTracks,
        priority: args.priority,
      },
    );
    const result = await ctx.runAction(api.imports.actions.runArtistImport, {
      requestId,
      provider: args.provider,
      targetMode: args.targetMode,
      name: args.name ?? "",
      providerId: args.providerId ?? "",
      withTracks: args.withTracks,
      tracks: args.tracks,
    });
    return { requestId, status: result.status };
  },
});

/**
 * Run a track import: fetch the track by provider id, resolve + promote its
 * credited artists, and complete (or fail) the request. Returns the terminal
 * status.
 */
export const runTrackImport = action({
  args: {
    requestId: v.id("importRequests"),
    provider,
    providerId: v.string(),
  },
  returns: v.object({ status: importStatus }),
  handler: async (ctx, args): Promise<{ status: "completed" | "failed" }> => {
    await ctx.runMutation(internal.imports.mutations.markClaimed, {
      requestId: args.requestId,
    });
    await ctx.runMutation(internal.imports.mutations.markRunning, {
      requestId: args.requestId,
    });
    try {
      if (args.providerId === "") {
        throw new Error("track import requires a providerId");
      }
      const token = await getProviderToken(ctx, args.provider);
      const adapter = createProvider(args.provider, () =>
        Promise.resolve(token),
      );
      const result = await adapter.getTrack(args.providerId);
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
      await ctx.runMutation(internal.imports.mutations.markCompleted, {
        requestId: args.requestId,
        resolvedTrackId: trackId,
        resultSummary: `imported track ${result.value.title}`,
      });
      return { status: "completed" };
    } catch (err) {
      await ctx.runMutation(internal.imports.mutations.markFailed, {
        requestId: args.requestId,
        status: "failed",
        errorSummary: String(err),
      });
      return { status: "failed" };
    }
  },
});

/**
 * Import a track by provider id, promoting it + its credited artists into the
 * catalog. Returns the request id + terminal status.
 */
export const importTrack = action({
  args: {
    provider,
    providerId: v.string(),
    mode: v.optional(importMode),
    priority: v.optional(importPriority),
  },
  returns: v.object({ requestId: v.string(), status: importStatus }),
  handler: async (
    ctx,
    args,
  ): Promise<{ requestId: string; status: "completed" | "failed" }> => {
    const { requestId } = await ctx.runMutation(
      api.imports.mutations.createRequest,
      {
        entityType: "track",
        requestType: args.mode ?? "import",
        targetMode: "providerId",
        providerScope: args.provider,
        provider: args.provider,
        providerId: args.providerId,
        priority: args.priority,
      },
    );
    const result = await ctx.runAction(api.imports.actions.runTrackImport, {
      requestId,
      provider: args.provider,
      providerId: args.providerId,
    });
    return { requestId, status: result.status };
  },
});

/**
 * Run a playlist import: fetch the playlist, promote its ISRC-bearing tracks (+
 * their credited artists) into the catalog, store the playlist with its resolved
 * membership, and complete (or fail) the request. ISRC-less tracks are skipped
 * (they can't be unified).
 */
export const runPlaylistImport = action({
  args: {
    requestId: v.id("importRequests"),
    provider,
    providerId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({ status: importStatus }),
  handler: async (ctx, args): Promise<{ status: "completed" | "failed" }> => {
    await ctx.runMutation(internal.imports.mutations.markClaimed, {
      requestId: args.requestId,
    });
    await ctx.runMutation(internal.imports.mutations.markRunning, {
      requestId: args.requestId,
    });
    try {
      if (args.providerId === "") {
        throw new Error("playlist import requires a providerId");
      }
      const token = await getProviderToken(ctx, args.provider);
      const adapter = createProvider(args.provider, () =>
        Promise.resolve(token),
      );
      const playlist = await adapter.getPlaylist(args.providerId);
      // Optional cap on how many of the playlist's tracks to import.
      const tracks =
        args.limit === undefined
          ? playlist.tracks
          : playlist.tracks.slice(0, args.limit);
      const trackIds = await promoteTracks(
        ctx,
        args.provider,
        adapter,
        tracks,
      );
      const playlistId = await ctx.runMutation(
        api.catalog.mutations.upsertPlaylist,
        {
          provider: args.provider,
          providerId: playlist.externalId,
          title: playlist.value.title,
          description: playlist.value.description,
          coverUrl: playlist.value.coverUrl,
          url: playlist.value.url,
          owner: playlist.value.owner,
          trackIds,
        },
      );
      await ctx.runMutation(internal.imports.mutations.markCompleted, {
        requestId: args.requestId,
        resolvedPlaylistId: playlistId,
        resultSummary: `imported playlist ${playlist.value.title} (${trackIds.length} tracks)`,
      });
      return { status: "completed" };
    } catch (err) {
      await ctx.runMutation(internal.imports.mutations.markFailed, {
        requestId: args.requestId,
        status: "failed",
        errorSummary: String(err),
      });
      return { status: "failed" };
    }
  },
});

/**
 * Import a playlist by provider id, promoting its tracks + storing membership.
 * Returns the request id + terminal status.
 */
export const importPlaylist = action({
  args: {
    provider,
    providerId: v.string(),
    limit: v.optional(v.number()),
    mode: v.optional(importMode),
    priority: v.optional(importPriority),
  },
  returns: v.object({ requestId: v.string(), status: importStatus }),
  handler: async (
    ctx,
    args,
  ): Promise<{ requestId: string; status: "completed" | "failed" }> => {
    const { requestId } = await ctx.runMutation(
      api.imports.mutations.createRequest,
      {
        entityType: "playlist",
        requestType: args.mode ?? "import",
        targetMode: "providerId",
        providerScope: args.provider,
        provider: args.provider,
        providerId: args.providerId,
        priority: args.priority,
      },
    );
    const result = await ctx.runAction(api.imports.actions.runPlaylistImport, {
      requestId,
      provider: args.provider,
      providerId: args.providerId,
      limit: args.limit,
    });
    return { requestId, status: result.status };
  },
});

/**
 * Run an album import: fetch the album by provider id, promote its ISRC tracks
 * (with enrichment) + its credited artists, store the album row, and complete
 * (or fail) the request. Returns the terminal status.
 */
export const runAlbumImport = action({
  args: {
    requestId: v.id("importRequests"),
    provider,
    providerId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.object({ status: importStatus }),
  handler: async (ctx, args): Promise<{ status: "completed" | "failed" }> => {
    await ctx.runMutation(internal.imports.mutations.markClaimed, {
      requestId: args.requestId,
    });
    await ctx.runMutation(internal.imports.mutations.markRunning, {
      requestId: args.requestId,
    });
    try {
      if (args.providerId === "") {
        throw new Error("album import requires a providerId");
      }
      const token = await getProviderToken(ctx, args.provider);
      const adapter = createProvider(args.provider, () =>
        Promise.resolve(token),
      );
      const album = await adapter.getAlbum(args.providerId);
      const tracks =
        args.limit === undefined
          ? album.tracks
          : album.tracks.slice(0, args.limit);
      const trackIds = await promoteTracks(
        ctx,
        args.provider,
        adapter,
        tracks,
      );
      const albumArtistIds = await Promise.all(
        album.value.artists.filter(hasExternalId).map((ref) =>
          ctx.runMutation(api.catalog.mutations.upsertArtist, {
            provider: args.provider,
            externalId: ref.externalId,
            value: { name: ref.name, genres: [] },
          }),
        ),
      );
      const albumId = await ctx.runMutation(
        api.catalog.mutations.upsertAlbum,
        {
          provider: args.provider,
          providerId: album.externalId,
          title: album.value.title,
          artistIds: albumArtistIds,
          releaseDate: album.value.releaseDate,
          coverUrl: album.value.coverUrl,
          url: album.value.url,
          trackCount: album.value.trackCount,
          trackIds,
        },
      );
      await ctx.runMutation(internal.imports.mutations.markCompleted, {
        requestId: args.requestId,
        resolvedAlbumId: albumId,
        resultSummary: `imported album ${album.value.title} (${trackIds.length} tracks)`,
      });
      return { status: "completed" };
    } catch (err) {
      await ctx.runMutation(internal.imports.mutations.markFailed, {
        requestId: args.requestId,
        status: "failed",
        errorSummary: String(err),
      });
      return { status: "failed" };
    }
  },
});

/**
 * Import an album by provider id, promoting its tracks + artists + storing the
 * album row. Returns the request id + terminal status.
 */
export const importAlbum = action({
  args: {
    provider,
    providerId: v.string(),
    limit: v.optional(v.number()),
    mode: v.optional(importMode),
    priority: v.optional(importPriority),
  },
  returns: v.object({ requestId: v.string(), status: importStatus }),
  handler: async (
    ctx,
    args,
  ): Promise<{ requestId: string; status: "completed" | "failed" }> => {
    const { requestId } = await ctx.runMutation(
      api.imports.mutations.createRequest,
      {
        entityType: "album",
        requestType: args.mode ?? "import",
        targetMode: "providerId",
        providerScope: args.provider,
        provider: args.provider,
        providerId: args.providerId,
        priority: args.priority,
      },
    );
    const result = await ctx.runAction(api.imports.actions.runAlbumImport, {
      requestId,
      provider: args.provider,
      providerId: args.providerId,
      limit: args.limit,
    });
    return { requestId, status: result.status };
  },
});
