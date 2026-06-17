import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_RETRIES,
  assertTransition,
  canTransition,
  importRetryDelayMs,
  isActive,
  shouldRetry,
} from "./state.js";

describe("isActive", () => {
  it("is true for in-flight statuses", () => {
    expect(isActive("queued")).toBe(true);
    expect(isActive("running")).toBe(true);
  });
  it("is false for terminal statuses", () => {
    expect(isActive("completed")).toBe(false);
    expect(isActive("canceled")).toBe(false);
  });
});

describe("canTransition", () => {
  it("allows legal transitions", () => {
    expect(canTransition("queued", "claimed")).toBe(true);
    expect(canTransition("running", "completed")).toBe(true);
    expect(canTransition("stale", "queued")).toBe(true);
  });
  it("rejects illegal transitions", () => {
    expect(canTransition("queued", "running")).toBe(false);
    expect(canTransition("completed", "queued")).toBe(false);
  });
});

describe("assertTransition", () => {
  it("passes a legal transition", () => {
    expect(() => assertTransition("claimed", "running")).not.toThrow();
  });
  it("throws on an illegal transition", () => {
    expect(() => assertTransition("completed", "running")).toThrow(
      /Invalid import transition: completed -> running/,
    );
  });
});

describe("importRetryDelayMs", () => {
  it("returns 15s, then 60s, then 60s past the end", () => {
    expect(importRetryDelayMs(0)).toBe(15_000);
    expect(importRetryDelayMs(1)).toBe(60_000);
    expect(importRetryDelayMs(2)).toBe(60_000);
    expect(importRetryDelayMs(99)).toBe(60_000);
  });
});

describe("shouldRetry", () => {
  it("retries within budget, stops at the max", () => {
    expect(shouldRetry(0)).toBe(true);
    expect(shouldRetry(MAX_IMPORT_RETRIES - 1)).toBe(true);
    expect(shouldRetry(MAX_IMPORT_RETRIES)).toBe(false);
  });
});
