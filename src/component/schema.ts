import { defineSchema, defineTable } from "convex/server";
import { cacheEntryFields } from "./validators.js";

/**
 * Sandboxed tables — the component's own concern only. `0.1.0` ships the raw
 * provider-fetch cache (`cacheEntries`); the durable catalog tables
 * (artists/tracks/playlists) the component will own are planned (see ROADMAP).
 * Each cache row is one provider's normalized facts for one entity, keyed by an
 * opaque provider id (and ISRC for tracks). The component never reaches the
 * host's tables; the host keeps gameplay + editorial, referencing catalog rows.
 */
export default defineSchema({
  cacheEntries: defineTable(cacheEntryFields)
    .index("by_lookup", ["kind", "provider", "externalId"])
    .index("by_isrc", ["kind", "isrc"])
    .index("by_expiry", ["expiresAt"]),
});
