import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { sourceDoc } from "../validators.js";

/** Default page size for a source listing. */
const DEFAULT_LIMIT = 100;

/** List registered sources — all, or only enabled ones. */
export const listSources = query({
  args: { enabledOnly: v.optional(v.boolean()), limit: v.optional(v.number()) },
  returns: v.array(sourceDoc),
  handler: async (ctx, args) => {
    if (args.enabledOnly === true) {
      return await ctx.db
        .query("sources")
        .withIndex("by_enabled", (q) => q.eq("enabled", true))
        .take(args.limit ?? DEFAULT_LIMIT);
    }
    return await ctx.db.query("sources").take(args.limit ?? DEFAULT_LIMIT);
  },
});
