import { v } from "convex/values";
import { internalQuery } from "../_generated/server.js";
import { provider, providerSecrets } from "../validators.js";

/**
 * Read a provider's stored credentials, or `null` if unconfigured. Internal —
 * credentials are read only by the component's own token actions, never exposed
 * back to the host.
 */
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
