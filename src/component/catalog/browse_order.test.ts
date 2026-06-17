import { describe, expect, it } from "vitest";
import {
  dailyRotationHash,
  orderByDailyRotation,
  utcDateBucket,
} from "./browse_order.js";

describe("utcDateBucket", () => {
  it("returns the UTC YYYY-MM-DD", () => {
    expect(utcDateBucket(Date.parse("2026-06-17T13:45:00Z"))).toBe("2026-06-17");
  });
});

describe("dailyRotationHash", () => {
  it("is deterministic per (bucket, id)", () => {
    expect(dailyRotationHash("2026-06-17", "x")).toBe(
      dailyRotationHash("2026-06-17", "x"),
    );
  });

  it("rotates across day buckets", () => {
    expect(dailyRotationHash("2026-06-17", "x")).not.toBe(
      dailyRotationHash("2026-06-18", "x"),
    );
  });

  it("is an unsigned 32-bit int", () => {
    const h = dailyRotationHash("2026-06-17", "anything");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("orderByDailyRotation", () => {
  const items = [{ _id: "a" }, { _id: "b" }, { _id: "c" }, { _id: "d" }];

  it("sorts by ascending rotation hash, all items preserved", () => {
    const ordered = orderByDailyRotation(items, "2026-06-17");
    expect(new Set(ordered.map((i) => i._id))).toEqual(
      new Set(["a", "b", "c", "d"]),
    );
    const hashes = ordered.map((i) => dailyRotationHash("2026-06-17", i._id));
    expect(hashes).toEqual([...hashes].sort((x, y) => x - y));
  });

  it("is stable within a UTC day", () => {
    expect(orderByDailyRotation(items, "2026-06-17")).toEqual(
      orderByDailyRotation(items, "2026-06-17"),
    );
  });

  it("handles an empty list", () => {
    expect(orderByDailyRotation([], "2026-06-17")).toEqual([]);
  });
});
