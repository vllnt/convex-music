import { defineSchema, defineTable } from "convex/server";
import { cacheEntryFields } from "./validators.js";

/**
 * Sandboxed cache tables — the component's own concern only. Each row is one
 * provider's normalized facts for one entity, keyed by an opaque provider id
 * (and ISRC for tracks). The component never models or reaches the host's
 * domain: the host keeps its own curated tables and the cache never replaces
 * them.
 */
export default defineSchema({
  cacheEntries: defineTable(cacheEntryFields)
    .index("by_lookup", ["kind", "provider", "externalId"])
    .index("by_isrc", ["kind", "isrc"])
    .index("by_expiry", ["expiresAt"]),
});
