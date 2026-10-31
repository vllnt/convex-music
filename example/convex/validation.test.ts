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

const putArgs = {
  kind: "track",
  provider: "spotify",
  externalId: "t1",
  value: { title: "Song", artists: [{ name: "Artist" }] },
} as const;

test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
  "put rejects invalid ttlMs %s",
  async (ttlMs) => {
    const t = setup();
    await expect(
      t.mutation(api.example.put, { ...putArgs, ttlMs }),
    ).rejects.toThrow(/INVALID_TTL/);
    expect((await t.query(api.example.stats, {})).total).toBe(0);
  },
);

test("put rejects an empty externalId", async () => {
  const t = setup();
  await expect(
    t.mutation(api.example.put, { ...putArgs, externalId: "" }),
  ).rejects.toThrow(/INVALID_ARGUMENT/);
});

test.each([Number.NaN, 0, -1, 1.5])(
  "search and selectEligible reject invalid limit %s",
  async (limit) => {
    const t = setup();
    await expect(
      t.query(api.example.searchArtists, { query: "a", limit }),
    ).rejects.toThrow(/INVALID_LIMIT/);
    await expect(
      t.query(api.example.searchTracks, { query: "a", limit }),
    ).rejects.toThrow(/INVALID_LIMIT/);
    await expect(
      t.query(api.example.selectEligible, { kind: "artist", limit }),
    ).rejects.toThrow(/INVALID_LIMIT/);
    await expect(
      t.query(api.example.selectEligible, {
        kind: "track",
        limit: 1,
        scanLimit: limit,
      }),
    ).rejects.toThrow(/INVALID_LIMIT/);
  },
);

test("catalog upserts reject empty identifiers", async () => {
  const t = setup();
  const track = {
    title: "S",
    artists: [{ name: "A" }],
    genres: [],
    isrc: "USABC1234567",
  };
  await expect(
    t.mutation(api.example.upsertArtist, {
      provider: "spotify",
      externalId: "",
      value: { name: "A", genres: [] },
    }),
  ).rejects.toThrow(/INVALID_ARGUMENT/);
  await expect(
    t.mutation(api.example.upsertArtist, {
      provider: "spotify",
      externalId: "a1",
      value: { name: "  ", genres: [] },
    }),
  ).rejects.toThrow(/INVALID_ARGUMENT/);
  await expect(
    t.mutation(api.example.upsertTrack, {
      provider: "spotify",
      externalId: "",
      value: track,
    }),
  ).rejects.toThrow(/INVALID_ARGUMENT/);
  await expect(
    t.mutation(api.example.upsertTrack, {
      provider: "spotify",
      externalId: "t1",
      value: { ...track, isrc: "" },
    }),
  ).rejects.toThrow(/INVALID_ARGUMENT/);
  await expect(
    t.mutation(api.example.upsertPlaylist, {
      provider: "spotify",
      providerId: "",
      title: "P",
      trackIds: [],
    }),
  ).rejects.toThrow(/INVALID_ARGUMENT/);
  await expect(
    t.mutation(api.example.upsertAlbum, {
      provider: "spotify",
      providerId: "",
      title: "Al",
      artistIds: [],
      trackIds: [],
    }),
  ).rejects.toThrow(/INVALID_ARGUMENT/);
});

test("addSource rejects an empty value and an invalid cadence", async () => {
  const t = setup();
  const source = { kind: "artist", by: "name", value: "Artist" } as const;
  await expect(
    t.mutation(api.example.addSource, { ...source, value: "" }),
  ).rejects.toThrow(/INVALID_ARGUMENT/);
  for (const cadenceMs of [Number.NaN, 0, -5]) {
    await expect(
      t.mutation(api.example.addSource, { ...source, cadenceMs }),
    ).rejects.toThrow(/INVALID_CADENCE/);
  }
});

test.each([Number.NaN, 0, -1, 1.5])(
  "import and sweep actions reject invalid limit %s",
  async (limit) => {
    const t = setup();
    await expect(
      t.action(api.example.importPlaylist, {
        provider: "spotify",
        providerId: "p1",
        limit,
      }),
    ).rejects.toThrow(/INVALID_LIMIT/);
    await expect(
      t.action(api.example.importAlbum, {
        provider: "spotify",
        providerId: "al1",
        limit,
      }),
    ).rejects.toThrow(/INVALID_LIMIT/);
    await expect(
      t.action(api.example.runRefresh, { kind: "artist", limit }),
    ).rejects.toThrow(/INVALID_LIMIT/);
    await expect(
      t.action(api.example.runAutoImport, { limit }),
    ).rejects.toThrow(/INVALID_LIMIT/);
  },
);

test.each([Number.NaN, 0, -1, 1.5])(
  "consumeBudget rejects invalid count %s",
  async (count) => {
    const t = setup();
    await expect(
      t.action(api.example.consumeBudget, { budget: "refresh", count }),
    ).rejects.toThrow(/INVALID_COUNT/);
  },
);
