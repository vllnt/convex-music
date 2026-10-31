import { ConvexError } from "convex/values";

/** Reject empty strings for identifiers a caller must supply (mutations only). */
export function assertNonEmpty(value: string, name: string): void {
  if (value.length === 0) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: `${name} must not be empty`,
    });
  }
}

/** Reject `limit` values that are not positive integers (NaN, 0, negative, fractional). */
export function assertLimit(value: number | undefined, name = "limit"): void {
  if (value !== undefined && !(Number.isInteger(value) && value >= 1)) {
    throw new ConvexError({
      code: "INVALID_LIMIT",
      message: `${name} must be a positive integer`,
    });
  }
}

/** Reject token counts that are not positive integers. */
export function assertCount(value: number): void {
  if (!(Number.isInteger(value) && value >= 1)) {
    throw new ConvexError({
      code: "INVALID_COUNT",
      message: "count must be a positive integer",
    });
  }
}

/**
 * Reject a non-finite `ttlMs` (NaN would store an unsweepable, never-fresh `expiresAt`).
 * Zero and negative values stay valid: they write an already-expired entry.
 */
export function assertTtl(value: number | undefined): void {
  if (value !== undefined && !Number.isFinite(value)) {
    throw new ConvexError({
      code: "INVALID_TTL",
      message: "ttlMs must be a finite number of milliseconds",
    });
  }
}

/** Reject a source `cadenceMs` that is not a positive finite number. */
export function assertCadence(value: number | undefined): void {
  if (value !== undefined && !(Number.isFinite(value) && value > 0)) {
    throw new ConvexError({
      code: "INVALID_CADENCE",
      message: "cadenceMs must be a positive finite number of milliseconds",
    });
  }
}
