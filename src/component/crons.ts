import { cronJobs } from "convex/server";
import { api } from "./_generated/api.js";

/**
 * Component-internal scheduled maintenance. Mount-safe (each `app.use` mount runs
 * its own crons) and idempotent. `pruneExpired` is bounded to expired rows, so
 * running it hourly safely reclaims raw-cache storage. Overlapping ticks are safe:
 * the refresh sweep claims each stale row atomically (`claimNextStale`) and the
 * auto-import sweep collapses duplicate requests (dedup is serializable under
 * Convex OCC), so two concurrent sweeps never double-process the same row.
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

// Recovery watchdog: salvage rows stuck `running` past the lease (a crashed
// re-sync) back to `stale` for re-pickup. Per-kind, idempotent.
crons.interval("music:recover-artists", { hours: 1 }, api.sync.mutations.recoverStuckSyncs, {
  kind: "artist",
});
crons.interval("music:recover-tracks", { hours: 1 }, api.sync.mutations.recoverStuckSyncs, {
  kind: "track",
});

export default crons;
