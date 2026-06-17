import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { importRequestDoc, importStatus } from "../validators.js";

/** Default page size for a request listing. */
const DEFAULT_LIST_LIMIT = 50;

/** Fetch one import request by id. */
export const getRequest = query({
  args: { requestId: v.id("importRequests") },
  returns: v.union(v.null(), importRequestDoc),
  handler: async (ctx, args) => await ctx.db.get(args.requestId),
});

/** List import requests in a status, newest first. */
export const listRequests = query({
  args: { status: importStatus, limit: v.optional(v.number()) },
  returns: v.array(importRequestDoc),
  handler: async (ctx, args) =>
    await ctx.db
      .query("importRequests")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .take(args.limit ?? DEFAULT_LIST_LIMIT),
});
