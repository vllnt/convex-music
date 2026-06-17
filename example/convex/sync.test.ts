/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api.js";
import schema from "./schema.js";
import { register } from "../../src/test.js";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

test("markStale flips past-window synced rows to stale", async () => {
  const t = setup();
  await t.mutation(api.example.upsertArtist, {
    provider: "spotify",
    externalId: "a1",
    value: { name: "Daft Punk", genres: [] },
  });
  await t.mutation(api.example.upsertArtist, {
    provider: "spotify",
    externalId: "a2",
    value: { name: "Justice", genres: [] },
  });

  // fresh rows are not stale
  expect(
    await t.mutation(api.example.markStale, { kind: "artist", now: Date.now() }),
  ).toBe(0);

  // far in the future, both are past their window
  const future = Date.now() + YEAR_MS;
  expect(
    await t.mutation(api.example.markStale, { kind: "artist", now: future }),
  ).toBe(2);

  // already stale -> nothing left synced
  expect(
    await t.mutation(api.example.markStale, { kind: "artist", now: future }),
  ).toBe(0);

  // default now (no synced artists remain anyway)
  expect(await t.mutation(api.example.markStale, { kind: "artist" })).toBe(0);
});

test("markStale handles the track kind", async () => {
  const t = setup();
  await t.mutation(api.example.upsertTrack, {
    provider: "spotify",
    externalId: "t1",
    value: { title: "One More Time", artists: [], isrc: "GBDUW0000059" },
  });
  expect(
    await t.mutation(api.example.markStale, {
      kind: "track",
      now: Date.now() + YEAR_MS,
    }),
  ).toBe(1);
});

test("listStale returns the rows markStale flagged (default limit)", async () => {
  const t = setup();
  await t.mutation(api.example.upsertArtist, {
    provider: "spotify",
    externalId: "a1",
    value: { name: "Daft Punk", genres: [] },
  });
  // none stale yet
  expect(await t.query(api.example.listStale, { kind: "artist" })).toHaveLength(0);
  await t.mutation(api.example.markStale, {
    kind: "artist",
    now: Date.now() + YEAR_MS,
  });
  // no limit arg -> exercises the default-limit branch
  const stale = await t.query(api.example.listStale, { kind: "artist" });
  expect(stale).toHaveLength(1);
});
