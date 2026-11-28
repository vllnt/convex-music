/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { expect, test } from "vitest";
import { components } from "./_generated/api.js";
import { Music } from "../../src/client/index.js";
import { register } from "../../src/test.js";

const modules = import.meta.glob("./**/*.ts");

/** A host app with its own tables next to the mounted component. */
const hostSchema = defineSchema(
  {
    notes: defineTable({ body: v.string() }).index("by_body", ["body"]),
    tags: defineTable({ name: v.string(), noteId: v.id("notes") }).index(
      "by_note",
      ["noteId"],
    ),
  },
  { schemaValidation: true },
);

test("register mounts the component in a host app that has its own tables", async () => {
  const t = convexTest(hostSchema, modules);
  register(t);
  const music = new Music(components.music);

  await t.mutation(async (ctx) => {
    const noteId = await ctx.db.insert("notes", { body: "hello" });
    await ctx.db.insert("tags", { name: "greeting", noteId });
    await music.put(ctx, {
      kind: "track",
      provider: "spotify",
      externalId: "t1",
      value: { title: "Song", artists: [{ name: "Artist" }] },
    });
  });

  const result = await t.query(async (ctx) => {
    const note = await ctx.db
      .query("notes")
      .withIndex("by_body", (q) => q.eq("body", "hello"))
      .unique();
    const cached = await music.get(ctx, {
      kind: "track",
      provider: "spotify",
      externalId: "t1",
    });
    return { body: note?.body, stats: await music.stats(ctx), cached };
  });

  expect(result.body).toBe("hello");
  expect(result.stats.total).toBe(1);
  expect(result.cached?.value).toMatchObject({ title: "Song" });
});
