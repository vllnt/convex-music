import { v } from "convex/values";
import type { Id } from "../_generated/dataModel.js";
import {
  type MutationCtx,
  internalMutation,
  mutation,
} from "../_generated/server.js";
import {
  importEntityType,
  importMode,
  importPriority,
  importTargetMode,
  provider,
} from "../validators.js";
import { buildDedupeKey } from "./dedupe.js";
import { ACTIVE_STATUSES } from "./state.js";

/** Find an in-flight request with this dedup key, or null. */
async function findActiveByDedupe(
  ctx: MutationCtx,
  dedupeKey: string,
): Promise<Id<"importRequests"> | null> {
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
  const existing = matches.find((m) => m !== null);
  return existing === undefined || existing === null ? null : existing._id;
}

/**
 * Create an import request, collapsing onto an existing **active** request with
 * the same dedup key (so a duplicate in-flight import doesn't double-run). A
 * `refresh` never dedups into an `import`, and a `withTracks` import never
 * collapses into a shallow one (both differ in the key).
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
    priority: v.optional(importPriority),
  },
  returns: v.object({
    requestId: v.id("importRequests"),
    deduped: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const dedupeKey = buildDedupeKey(args);
    const active = await findActiveByDedupe(ctx, dedupeKey);
    if (active !== null) {
      return { requestId: active, deduped: true };
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
    return { requestId, deduped: false };
  },
});

/*
 * Lifecycle transitions. The traversal orchestrates them in a linear, valid
 * order (`queued → claimed → running → completed|failed`), so they patch by id
 * without re-loading. The state-machine guard (`assertTransition`) is the
 * authority on legality and is unit-tested in `state.ts`.
 */

/** queued → claimed. */
export const markClaimed = internalMutation({
  args: { requestId: v.id("importRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      status: "claimed",
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** claimed → running. */
export const markRunning = internalMutation({
  args: { requestId: v.id("importRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.requestId, {
      status: "running",
      startedAt: now,
      updatedAt: now,
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
    const now = Date.now();
    await ctx.db.patch(args.requestId, {
      status: "completed",
      finishedAt: now,
      updatedAt: now,
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
    const now = Date.now();
    await ctx.db.patch(args.requestId, {
      status: args.status,
      finishedAt: now,
      updatedAt: now,
      errorSummary: args.errorSummary,
    });
    return null;
  },
});
