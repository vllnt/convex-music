import { defineSchema, defineTable } from "convex/server";
import {
  artistFields,
  artistProviderLinkFields,
  cacheEntryFields,
  playlistFields,
  trackClaimFields,
  trackFields,
  trackProviderLinkFields,
} from "./validators.js";

/**
 * Sandboxed tables — the component's own concern only. Two layers:
 * - `cacheEntries`: the raw provider-fetch cache (one provider's normalized facts
 *   per entity, TTL'd, keyed by provider id + ISRC for tracks).
 * - `artists` / `tracks` / `playlists`: the durable catalog — one unified
 *   canonical entity per identity (track by ISRC, artist by name) with per-provider
 *   `providers[]` provenance, sync + repair lifecycle columns. `*Providers` are
 *   reverse indexes (`(provider, providerId)` → row) since Convex can't index
 *   inside arrays. `trackClaims` guards concurrent track syncs.
 *
 * The component never reaches the host's tables; the host keeps gameplay +
 * editorial, referencing catalog rows by id / ISRC.
 */
export default defineSchema({
  cacheEntries: defineTable(cacheEntryFields)
    .index("by_lookup", ["kind", "provider", "externalId"])
    .index("by_isrc", ["kind", "isrc"])
    .index("by_expiry", ["expiresAt"]),

  artists: defineTable(artistFields)
    .index("by_name_key", ["nameKey"])
    .index("by_sync", ["syncStatus", "nextSyncAt"])
    .index("by_next_sync", ["nextSyncAt"])
    .index("by_repair", ["repairStatus"])
    .searchIndex("search_name", { searchField: "name" }),

  tracks: defineTable(trackFields)
    .index("by_isrc", ["isrc"])
    .index("by_sync", ["syncStatus", "nextSyncAt"])
    .index("by_next_sync", ["nextSyncAt"])
    .index("by_repair", ["repairStatus"])
    .searchIndex("search_title", { searchField: "title" }),

  playlists: defineTable(playlistFields)
    .index("by_provider", ["provider", "providerId"])
    .index("by_sync", ["syncStatus", "nextSyncAt"]),

  artistProviders: defineTable(artistProviderLinkFields)
    .index("by_provider_id", ["provider", "providerId"])
    .index("by_artist", ["artistId"]),

  trackProviders: defineTable(trackProviderLinkFields)
    .index("by_provider_id", ["provider", "providerId"])
    .index("by_track", ["trackId"]),

  trackClaims: defineTable(trackClaimFields)
    .index("by_isrc", ["isrc"])
    .index("by_lease", ["leaseUntil"]),
});
