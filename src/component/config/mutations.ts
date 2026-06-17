import { v } from "convex/values";
import { mutation } from "../_generated/server.js";
import { provider, providerSecrets } from "../validators.js";

/**
 * Store (or replace) a provider's credentials. The host reads its own deployment
 * env vars and calls this once at setup — a Convex component is sandboxed from
 * the deployment's env, so credentials must be passed in explicitly. They live
 * in the component's own sandboxed table and never leave it.
 */
export const configure = mutation({
  args: { provider, secrets: providerSecrets },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("providerConfig")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .unique();
    if (existing === null) {
      await ctx.db.insert("providerConfig", {
        provider: args.provider,
        secrets: args.secrets,
      });
    } else {
      await ctx.db.patch(existing._id, { secrets: args.secrets });
    }
    return null;
  },
});
