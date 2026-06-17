/**
 * Deterministic daily-rotation ordering (songtrivia's `browse_order`). An FNV-1a
 * hash over `dateBucket:id` gives a stable-within-a-UTC-day, rotates-at-midnight
 * order — stable-but-rotating browse with zero host state. Used by the
 * `selectEligible` daily-rotation mode.
 */

const FNV_32_OFFSET = 0x811c9dc5;
const FNV_32_PRIME = 0x01000193;

/** The UTC day bucket (`YYYY-MM-DD`) for a timestamp. */
export function utcDateBucket(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** FNV-1a hash of `dateBucket:id` as an unsigned 32-bit int. */
export function dailyRotationHash(dateBucket: string, id: string): number {
  let hash = FNV_32_OFFSET;
  const input = `${dateBucket}:${id}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, FNV_32_PRIME);
  }
  return hash >>> 0;
}

/**
 * Order items by their daily-rotation hash (ascending). Stable within a UTC day,
 * rotates daily. Equal hashes (astronomically rare for distinct ids) keep input
 * order via the stable sort.
 *
 * @param items - rows carrying a string `_id`.
 * @param dateBucket - the UTC day bucket (see {@link utcDateBucket}).
 */
export function orderByDailyRotation<T extends { _id: string }>(
  items: readonly T[],
  dateBucket: string,
): T[] {
  return items
    .map((item) => ({ item, key: dailyRotationHash(dateBucket, item._id) }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item);
}
