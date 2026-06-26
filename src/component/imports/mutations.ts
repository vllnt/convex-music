import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel.js";
import {
  type MutationCtx,
  internalMutation,
  mutation,
} from "../_generated/server.js";
import {
  artistTracksMode,
  importEntityType,
  importMode,
  importPriority,
  importStatus,
  importTargetMode,
  provider,
} from "../validators.js";
import { buildDedupeKey } from "./dedupe.js";
import { ACTIVE_STATUSES, type ImportStatus, assertTransition } from "./state.js";

/** Find an in-flight request with this dedup key, or null. */
async function findActiveByDedupe(
  ctx: MutationCtx,
  dedupeKey: string,
): Promise<Doc<"importRequests"> | null> {
  const matches = await Promise.all(
    ACTIVE_STATUSES.map((status) =>
      ctx.db
        .query("importRequests")
        .withIndex("by_dedupe_status", (q) =>
          q.eq("dedupeKey", dedupeKey).eq("status", status),
        )
        .first(),
    ),
  );
  return matches.find((m) => m !== null) ?? null;
}

/**
 * Create an import request, collapsing onto an existing **active** request with
 * the same dedup key (so a duplicate in-flight import doesn't double-run). A
 * `refresh` never dedups into an `import`, and a `withTracks` import never
 * collapses into a shallow one (both differ in the key). Returns the collapsed
 * request's current `status` so the caller can attach to it instead of re-running
 * the traversal.
 *
 * Concurrency: two simultaneous creates with the same key are serializable under
 * Convex OCC — `findActiveByDedupe` scans the `by_dedupe_status` ranges, so an
 * insert into one of those (now-)read ranges conflicts the other create, which
 * retries, sees the first row, and dedups. No duplicate active request results.
 */
export const createRequest = mutation({
  args: {
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
    tracks: v.optional(artistTracksMode),
    withAlbum: v.optional(v.boolean()),
    priority: v.optional(importPriority),
  },
  returns: v.object({
    requestId: v.id("importRequests"),
    deduped: v.boolean(),
    status: importStatus,
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    requestId: Id<"importRequests">;
    deduped: boolean;
    status: ImportStatus;
  }> => {
    const dedupeKey = buildDedupeKey(args);
    const active = await findActiveByDedupe(ctx, dedupeKey);
    if (active !== null) {
      return { requestId: active._id, deduped: true, status: active.status };
    }
    const now = Date.now();
    const requestId = await ctx.db.insert("importRequests", {
      entityType: args.entityType,
      requestType: args.requestType,
      targetMode: args.targetMode,
      providerScope: args.providerScope,
      provider: args.provider,
      providerId: args.providerId,
      entityId: args.entityId,
      name: args.name,
      isrc: args.isrc,
      url: args.url,
      withTracks: args.withTracks,
      priority: args.priority ?? "normal",
      status: "queued",
      dedupeKey,
      retryCount: 0,
      requestedAt: now,
      updatedAt: now,
    });
    return { requestId, deduped: false, status: "queued" };
  },
});

/** Optional columns a transition may also write. */
interface TransitionExtra {
  startedAt?: number;
  finishedAt?: number;
  resolvedArtistId?: Id<"artists">;
  resolvedTrackId?: Id<"tracks">;
  resolvedPlaylistId?: Id<"playlists">;
  resolvedAlbumId?: Id<"albums">;
  resultSummary?: string;
  errorSummary?: string;
}

/**
 * Read-check-set in one transaction: load the request, assert the transition is
 * legal for its CURRENT status (no blind patch-by-id), then apply it. This makes
 * an out-of-order or duplicate drive (e.g. re-running a `completed` request)
 * throw instead of silently corrupting the row, and rejects a missing request.
 */
async function applyTransition(
  ctx: MutationCtx,
  requestId: Id<"importRequests">,
  to: ImportStatus,
  extra: TransitionExtra = {},
): Promise<void> {
  const request = await ctx.db.get(requestId);
  if (request === null) {
    throw new Error(`import request not found: ${requestId}`);
  }
  assertTransition(request.status, to);
  await ctx.db.patch(requestId, { status: to, updatedAt: Date.now(), ...extra });
}

/** queued → claimed. */
export const markClaimed = internalMutation({
  args: { requestId: v.id("importRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await applyTransition(ctx, args.requestId, "claimed");
    return null;
  },
});

/** claimed → running. */
export const markRunning = internalMutation({
  args: { requestId: v.id("importRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await applyTransition(ctx, args.requestId, "running", {
      startedAt: Date.now(),
    });
    return null;
  },
});

/** running → completed, recording what was resolved. */
export const markCompleted = internalMutation({
  args: {
    requestId: v.id("importRequests"),
    resolvedArtistId: v.optional(v.id("artists")),
    resolvedTrackId: v.optional(v.id("tracks")),
    resolvedPlaylistId: v.optional(v.id("playlists")),
    resolvedAlbumId: v.optional(v.id("albums")),
    resultSummary: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await applyTransition(ctx, args.requestId, "completed", {
      finishedAt: Date.now(),
      resolvedArtistId: args.resolvedArtistId,
      resolvedTrackId: args.resolvedTrackId,
      resolvedPlaylistId: args.resolvedPlaylistId,
      resolvedAlbumId: args.resolvedAlbumId,
      resultSummary: args.resultSummary,
    });
    return null;
  },
});

/** running → failed | stale, recording the error. */
export const markFailed = internalMutation({
  args: {
    requestId: v.id("importRequests"),
    status: v.union(v.literal("failed"), v.literal("stale")),
    errorSummary: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await applyTransition(ctx, args.requestId, args.status, {
      finishedAt: Date.now(),
      errorSummary: args.errorSummary,
    });
    return null;
  },
});
