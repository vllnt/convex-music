import { v } from "convex/values";
import { api } from "../_generated/api.js";
import type { Doc } from "../_generated/dataModel.js";
import { internalMutation, mutation } from "../_generated/server.js";
import { assertCadence, assertNonEmpty } from "../guards.js";
import { importEntityType, importTargetMode, provider } from "../validators.js";

/** Register an import source the engine keeps synced. Enabled by default. */
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
  returns: v.id("sources"),
  handler: async (ctx, args) => {
    assertNonEmpty(args.value, "value");
    assertCadence(args.cadenceMs);
    const now = Date.now();
    return await ctx.db.insert("sources", {
      kind: args.kind,
      by: args.by,
      value: args.value,
      provider: args.provider,
      withTracks: args.withTracks,
      cadenceMs: args.cadenceMs,
      enabled: args.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Remove a registered source. */
export const removeSource = mutation({
  args: { sourceId: v.id("sources") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete("sources", args.sourceId);
    return null;
  },
});

/** Enable or disable a source (disabled sources are skipped by the sweep). */
export const setSourceEnabled = mutation({
  args: { sourceId: v.id("sources"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("sources", args.sourceId, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** Stamp a source's `lastImportedAt` after the sweep imports it. */
export const touchSource = internalMutation({
  args: { sourceId: v.id("sources"), now: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("sources", args.sourceId, {
      lastImportedAt: args.now,
      updatedAt: args.now,
    });
    return null;
  },
});

export function isDue(source: Doc<"sources">, now: number): boolean {
  if (source.lastImportedAt === undefined) return true;
  if (source.cadenceMs === undefined) return false;
  return now - source.lastImportedAt > source.cadenceMs;
}

export const kickAutoImport = internalMutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const now = Date.now();
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .take(100);
    if (!sources.some((source) => isDue(source, now))) {
      return false;
    }
    await ctx.scheduler.runAfter(0, api.sources.actions.runAutoImport, {});
    return true;
  },
});
