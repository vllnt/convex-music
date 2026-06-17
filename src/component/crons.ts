import { cronJobs } from "convex/server";
import { api } from "./_generated/api.js";

/**
 * Component-internal scheduled maintenance. Mount-safe (each `app.use` mount runs
 * its own crons) and idempotent. `pruneExpired` is bounded to expired rows, so
 * running it hourly safely reclaims raw-cache storage.
 */
const crons = cronJobs();

crons.interval(
  "music:prune-expired-cache",
  { hours: 1 },
  api.mutations.pruneExpired,
  {},
);

// Daily freshness sweep: flip past-window synced rows to stale (the auto-import
// sweep re-syncs them). Per-kind so each batch is bounded.
crons.interval("music:mark-stale-artists", { hours: 24 }, api.sync.mutations.markStale, {
  kind: "artist",
});
crons.interval("music:mark-stale-tracks", { hours: 24 }, api.sync.mutations.markStale, {
  kind: "track",
});

// Auto-import sweep: pull due enabled sources. Opt-in — no-op without sources, so
// a fresh mount never auto-hammers providers.
crons.interval("music:auto-import", { hours: 1 }, api.sources.actions.runAutoImport, {});

// Refresh sweep: re-sync rows the mark-stale sweep flagged. Per-kind, opt-in
// (no stale rows → no-op).
crons.interval("music:refresh-artists", { hours: 6 }, api.sources.actions.runRefresh, {
  kind: "artist",
});
crons.interval("music:refresh-tracks", { hours: 6 }, api.sources.actions.runRefresh, {
  kind: "track",
});

export default crons;
