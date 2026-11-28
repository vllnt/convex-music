import type { TestConvex } from "convex-test";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { expectTypeOf, test } from "vitest";
import type { register } from "./test.js";

// Compile-time checks, run by `pnpm typecheck:ci`: a host app passes its own
// `convexTest(hostSchema, modules)` instance to `register`. The runtime
// counterpart is `example/convex/register.test.ts`.
type RegisterTarget = Parameters<typeof register>[0];

const indexedSchema = defineSchema({
  notes: defineTable({ body: v.string() }).index("by_body", ["body"]),
});

const validatedSchema = defineSchema(
  { notes: defineTable({ body: v.string() }) },
  { schemaValidation: true },
);

const unvalidatedSchema = defineSchema(
  { notes: defineTable({ body: v.string() }) },
  { schemaValidation: false },
);

const multiTableSchema = defineSchema({
  notes: defineTable({ body: v.string(), rank: v.number() })
    .index("by_body", ["body"])
    .index("by_rank_body", ["rank", "body"]),
  tags: defineTable({ name: v.string(), noteId: v.id("notes") }).index(
    "by_note",
    ["noteId"],
  ),
});

test("register accepts a host schema with its own indexed table", () => {
  expectTypeOf<TestConvex<typeof indexedSchema>>().toExtend<RegisterTarget>();
});

test("register accepts host schemas with and without schema validation", () => {
  expectTypeOf<TestConvex<typeof validatedSchema>>().toExtend<RegisterTarget>();
  expectTypeOf<
    TestConvex<typeof unvalidatedSchema>
  >().toExtend<RegisterTarget>();
});

test("register accepts a host schema with several tables and indexes", () => {
  expectTypeOf<
    TestConvex<typeof multiTableSchema>
  >().toExtend<RegisterTarget>();
});

test("register takes an optional mount name", () => {
  expectTypeOf<Parameters<typeof register>[1]>().toEqualTypeOf<
    string | undefined
  >();
});
