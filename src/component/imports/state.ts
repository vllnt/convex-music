/**
 * The import control-plane state machine (songtrivia's 8-state `music_imports`,
 * generalized). A component-owned control-plane over the `importRequests` table —
 * NOT `@convex-dev/workflow`; the bounded traversal runs inline. Pure transition +
 * retry logic; the mutations enforce it on the request rows via `assertTransition`.
 */

/** The lifecycle states of an import request. */
export const IMPORT_STATUS = {
  queued: "queued",
  claimed: "claimed",
  running: "running",
  retryWaiting: "retry_waiting",
  completed: "completed",
  failed: "failed",
  canceled: "canceled",
  stale: "stale",
} as const;

/** An import request status. */
export type ImportStatus = (typeof IMPORT_STATUS)[keyof typeof IMPORT_STATUS];

/** Statuses an in-flight request occupies — dedup collapses only against these. */
export const ACTIVE_STATUSES: readonly ImportStatus[] = [
  "queued",
  "claimed",
  "running",
  "retry_waiting",
];

/** Allowed transitions out of each status. */
const TRANSITIONS: Record<ImportStatus, readonly ImportStatus[]> = {
  queued: ["claimed", "canceled"],
  claimed: ["running", "canceled", "failed"],
  running: ["completed", "retry_waiting", "failed", "stale", "canceled"],
  retry_waiting: ["claimed", "canceled", "failed", "stale"],
  completed: [],
  failed: ["queued"],
  canceled: [],
  stale: ["queued"],
};

/** Whether a status is one an in-flight request occupies. */
export function isActive(status: ImportStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** Whether `from → to` is a legal transition. */
export function canTransition(from: ImportStatus, to: ImportStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Assert a legal transition, throwing on an illegal one. */
export function assertTransition(from: ImportStatus, to: ImportStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid import transition: ${from} -> ${to}`);
  }
}

/** Per-request retry backoff: `2 × [15s, 60s]` then `stale`. */
export const IMPORT_RETRY_DELAYS_MS: readonly number[] = [15_000, 60_000];

/** Max automatic retries before a request goes `stale`. */
export const MAX_IMPORT_RETRIES = 2;

/** Backoff before the next retry, by prior retry count (last value past the end). */
export function importRetryDelayMs(retryCount: number): number {
  return IMPORT_RETRY_DELAYS_MS[retryCount] ?? 60_000;
}

/** Whether another retry is within budget. */
export function shouldRetry(retryCount: number): boolean {
  return retryCount < MAX_IMPORT_RETRIES;
}
