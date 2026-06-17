/**
 * The sync + repair lifecycle logic for catalog rows (songtrivia's sync-status /
 * repair machines, generalized). Pure transition + scheduling logic; the
 * mutations + crons enforce it on the rows. Two machines:
 * - sync-status: `pending → running → synced | failed → stale` (freshness).
 * - repair-status: `clean → needs_repair → repairing → clean | failed_repair`.
 */

/** Freshness-sync states of a catalog row. */
export type SyncStatus =
  | "pending"
  | "running"
  | "synced"
  | "failed"
  | "stale";

/** Data-quality repair states of a catalog row. */
export type RepairStatus =
  | "clean"
  | "needs_repair"
  | "repairing"
  | "failed_repair";

const SYNC_TRANSITIONS: Record<SyncStatus, readonly SyncStatus[]> = {
  pending: ["running", "synced", "failed"],
  running: ["synced", "failed"],
  synced: [],
  failed: ["running", "synced", "failed", "stale"],
  stale: ["running", "synced"],
};

const REPAIR_TRANSITIONS: Record<RepairStatus, readonly RepairStatus[]> = {
  clean: ["needs_repair"],
  needs_repair: ["repairing"],
  repairing: ["clean", "needs_repair", "failed_repair"],
  failed_repair: [],
};

/** Whether `from → to` is a legal sync transition. */
export function canSyncTransition(from: SyncStatus, to: SyncStatus): boolean {
  return SYNC_TRANSITIONS[from].includes(to);
}

/** Assert a legal sync transition. */
export function assertSyncTransition(from: SyncStatus, to: SyncStatus): void {
  if (!canSyncTransition(from, to)) {
    throw new Error(`Invalid sync transition: ${from} -> ${to}`);
  }
}

/** Whether `from → to` is a legal repair transition. */
export function canRepairTransition(
  from: RepairStatus,
  to: RepairStatus,
): boolean {
  return REPAIR_TRANSITIONS[from].includes(to);
}

/** Assert a legal repair transition. */
export function assertRepairTransition(
  from: RepairStatus,
  to: RepairStatus,
): void {
  if (!canRepairTransition(from, to)) {
    throw new Error(`Invalid repair transition: ${from} -> ${to}`);
  }
}

/** Entity sync retry backoff: `[1h, 6h, 24h]` then `stale`. */
export const SYNC_RETRY_DELAYS_MS: readonly number[] = [
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];

/** Max entity sync retries before `stale`. */
export const MAX_SYNC_RETRIES = 3;

/** Max repair attempts before `failed_repair`. */
export const MAX_REPAIR_ATTEMPTS = 3;

/** Backoff before the next sync retry (last value past the end). */
export function syncRetryDelayMs(retryCount: number): number {
  return SYNC_RETRY_DELAYS_MS[retryCount] ?? 24 * 60 * 60 * 1000;
}

/** Whether another sync retry is within budget. */
export function shouldSyncRetry(retryCount: number): boolean {
  return retryCount < MAX_SYNC_RETRIES;
}

/** Staleness windows by popularity tier (songtrivia defaults). */
export const STALENESS_MS = {
  high: 7 * 24 * 60 * 60 * 1000,
  medium: 30 * 24 * 60 * 60 * 1000,
  low: 90 * 24 * 60 * 60 * 1000,
} as const;

/**
 * The freshness window for an entity by popularity: HIGH (≥70) = 7d, MEDIUM
 * (≥40) = 30d, LOW (or unknown) = 90d. Volatile-popular rows refresh faster.
 */
export function stalenessWindowMs(popularity: number | undefined): number {
  if (popularity === undefined) return STALENESS_MS.low;
  if (popularity >= 70) return STALENESS_MS.high;
  if (popularity >= 40) return STALENESS_MS.medium;
  return STALENESS_MS.low;
}

/**
 * Whether a row is past its freshness window. A row never synced (no
 * `lastSyncedAt`) is stale.
 */
export function isStale(
  lastSyncedAt: number | undefined,
  popularity: number | undefined,
  now: number,
): boolean {
  if (lastSyncedAt === undefined) return true;
  return now - lastSyncedAt > stalenessWindowMs(popularity);
}
