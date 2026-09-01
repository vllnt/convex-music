import { v } from "convex/values";
import { internalQuery } from "../_generated/server.js";
import { provider, providerSecrets } from "../validators.js";

/**
 * Read a provider's stored credentials, or `null` if unconfigured. Internal —
 * credentials are read only by the component's own token actions, never exposed
 * back to the host.
 */
export const getProviderRevision = internalQuery({
  args: { provider },
  returns: v.union(v.null(), v.number()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("providerConfig")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .unique();
    // v8 ignore next -- migration fallback for rows written before revisions existed
    return row === null ? null : (row.revision ?? 0);
  },
});

export const getProviderSecrets = internalQuery({
  args: { provider },
  returns: v.union(v.null(), providerSecrets),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("providerConfig")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .unique();
    return row === null ? null : row.secrets;
  },
});
