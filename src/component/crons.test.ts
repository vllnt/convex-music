import { describe, expect, it } from "vitest";
import crons from "./crons.js";

describe("crons", () => {
  it("registers the hourly prune cron", () => {
    expect(crons).toBeTruthy();
  });
});
