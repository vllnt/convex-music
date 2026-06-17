import { v } from "convex/values";
import { mutation } from "../_generated/server.js";
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
    await ctx.db.delete(args.sourceId);
    return null;
  },
});

/** Enable or disable a source (disabled sources are skipped by the sweep). */
export const setSourceEnabled = mutation({
  args: { sourceId: v.id("sources"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sourceId, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    });
    return null;
  },
});
