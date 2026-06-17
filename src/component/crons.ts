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

export default crons;
