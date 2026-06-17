import { describe, expect, it } from "vitest";
import {
  MAX_SYNC_RETRIES,
  STALENESS_MS,
  assertRepairTransition,
  assertSyncTransition,
  canRepairTransition,
  canSyncTransition,
  isStale,
  shouldSyncRetry,
  stalenessWindowMs,
  syncRetryDelayMs,
} from "./lifecycle.js";

describe("sync transitions", () => {
  it("allows + rejects", () => {
    expect(canSyncTransition("pending", "running")).toBe(true);
    expect(canSyncTransition("failed", "stale")).toBe(true);
    expect(canSyncTransition("synced", "running")).toBe(false);
  });
  it("asserts", () => {
    expect(() => assertSyncTransition("running", "synced")).not.toThrow();
    expect(() => assertSyncTransition("synced", "stale")).toThrow(
      /Invalid sync transition/,
    );
  });
});

describe("repair transitions", () => {
  it("allows + rejects", () => {
    expect(canRepairTransition("clean", "needs_repair")).toBe(true);
    expect(canRepairTransition("repairing", "clean")).toBe(true);
    expect(canRepairTransition("failed_repair", "clean")).toBe(false);
  });
  it("asserts", () => {
    expect(() => assertRepairTransition("needs_repair", "repairing")).not.toThrow();
    expect(() => assertRepairTransition("clean", "repairing")).toThrow(
      /Invalid repair transition/,
    );
  });
});

describe("sync retry", () => {
  it("backs off 1h, 6h, 24h, then 24h", () => {
    expect(syncRetryDelayMs(0)).toBe(60 * 60 * 1000);
    expect(syncRetryDelayMs(1)).toBe(6 * 60 * 60 * 1000);
    expect(syncRetryDelayMs(2)).toBe(24 * 60 * 60 * 1000);
    expect(syncRetryDelayMs(5)).toBe(24 * 60 * 60 * 1000);
  });
  it("budgets retries", () => {
    expect(shouldSyncRetry(0)).toBe(true);
    expect(shouldSyncRetry(MAX_SYNC_RETRIES)).toBe(false);
  });
});

describe("staleness by popularity", () => {
  it("maps popularity tiers", () => {
    expect(stalenessWindowMs(80)).toBe(STALENESS_MS.high);
    expect(stalenessWindowMs(50)).toBe(STALENESS_MS.medium);
    expect(stalenessWindowMs(10)).toBe(STALENESS_MS.low);
    expect(stalenessWindowMs(undefined)).toBe(STALENESS_MS.low);
  });
  it("isStale honors the window + treats never-synced as stale", () => {
    const now = 1_000_000_000_000;
    expect(isStale(undefined, 80, now)).toBe(true);
    expect(isStale(now - 1000, 80, now)).toBe(false);
    expect(isStale(now - STALENESS_MS.high - 1, 80, now)).toBe(true);
  });
});
