import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.ts");

test("the auto-import cron schedules no action when no enabled source is due", async () => {
  const t = convexTest(schema, modules);
  expect(await t.mutation(internal.sources.mutations.kickAutoImport, {})).toBe(false);
  await t.run(async (ctx) => {
    await ctx.db.insert("sources", {
      kind: "artist",
      by: "name",
      value: "Off",
      enabled: false,
      createdAt: 0,
      updatedAt: 0,
    });
    await ctx.db.insert("sources", {
      kind: "artist",
      by: "name",
      value: "Done",
      enabled: true,
      lastImportedAt: Date.now(),
      createdAt: 0,
      updatedAt: 0,
    });
  });
  expect(await t.mutation(internal.sources.mutations.kickAutoImport, {})).toBe(false);
  expect(await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
});

test("the auto-import cron schedules one action when a source is due", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("sources", { kind: "artist", by: "name", value: "New", enabled: true, createdAt: 0, updatedAt: 0 });
  });
  expect(await t.mutation(internal.sources.mutations.kickAutoImport, {})).toBe(true);
  const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  expect(scheduled).toHaveLength(1);
  expect(scheduled[0]?.name).toContain("runAutoImport");
});
