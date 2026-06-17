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

const artist = (over: Record<string, unknown> = {}) => ({
  name: "Daft Punk",
  genres: ["house"],
  ...over,
});

const track = (over: Record<string, unknown> = {}) => ({
  title: "One More Time",
  artists: [{ name: "Daft Punk" }],
  isrc: "GBDUW0000059",
  ...over,
});

test("upsertArtist inserts, then getArtist returns the unified row (synced)", async () => {
  const t = setup();
  const id = await t.mutation(api.example.upsertArtist, {
    provider: "spotify",
    externalId: "sp1",
    value: artist({ popularity: 80, imageUrl: "https://sp/img" }),
  });
  const got = await t.query(api.example.getArtist, { id });
  expect(got).not.toBeNull();
  expect(got.name).toBe("Daft Punk");
  expect(got.popularity).toBe(80);
  expect(got.providers).toHaveLength(1);
  expect(got.syncStatus).toBe("synced");
});

test("upsertArtist merges a second provider by name (union genres, max popularity)", async () => {
  const t = setup();
  const id = await t.mutation(api.example.upsertArtist, {
    provider: "spotify",
    externalId: "sp1",
    value: artist({ genres: ["house"], popularity: 70 }),
  });
  const id2 = await t.mutation(api.example.upsertArtist, {
    provider: "apple",
    externalId: "ap1",
    value: artist({ genres: ["electronic"], popularity: 90 }),
  });
  expect(id2).toBe(id);
  const got = await t.query(api.example.getArtist, { id });
  expect(got.genres.sort()).toEqual(["electronic", "house"]);
  expect(got.popularity).toBe(90);
  expect(got.providers).toHaveLength(2);
});

test("upsertArtist re-links when the same provider reports a new external id", async () => {
  const t = setup();
  const id = await t.mutation(api.example.upsertArtist, {
    provider: "spotify",
    externalId: "old",
    value: artist(),
  });
  // same name, same provider, new external id -> resolves by name, re-links
  const id2 = await t.mutation(api.example.upsertArtist, {
    provider: "spotify",
    externalId: "new",
    value: artist(),
  });
  expect(id2).toBe(id);
  const got = await t.query(api.example.getArtist, { id });
  expect(got.providers).toHaveLength(1);
  expect(got.providers[0].providerId).toBe("new");
});

test("upsertArtist is a no-op re-link for the identical provider id", async () => {
  const t = setup();
  const id = await t.mutation(api.example.upsertArtist, {
    provider: "spotify",
    externalId: "sp1",
    value: artist(),
  });
  const again = await t.mutation(api.example.upsertArtist, {
    provider: "spotify",
    externalId: "sp1",
    value: artist({ popularity: 55 }),
  });
  expect(again).toBe(id);
  const got = await t.query(api.example.getArtist, { id });
  expect(got.providers).toHaveLength(1);
  expect(got.popularity).toBe(55);
});

test("upsertTrack requires an ISRC", async () => {
  const t = setup();
  await expect(
    t.mutation(api.example.upsertTrack, {
      provider: "spotify",
      externalId: "t1",
      value: track({ isrc: undefined }),
    }),
  ).rejects.toThrow(/ISRC/);
});

test("upsertTrack inserts + merges by ISRC, unioning artistIds + max duration", async () => {
  const t = setup();
  const artistId = await t.mutation(api.example.upsertArtist, {
    provider: "spotify",
    externalId: "sp1",
    value: artist(),
  });
  const id = await t.mutation(api.example.upsertTrack, {
    provider: "spotify",
    externalId: "t-sp",
    value: track({ durationMs: 320_000, previewUrl: "https://sp/prev" }),
    artistIds: [artistId],
  });
  const artistId2 = await t.mutation(api.example.upsertArtist, {
    provider: "apple",
    externalId: "ap1",
    value: artist({ name: "Another" }),
  });
  const id2 = await t.mutation(api.example.upsertTrack, {
    provider: "apple",
    externalId: "t-ap",
    value: track({ durationMs: 100 }),
    artistIds: [artistId2],
  });
  expect(id2).toBe(id);
  const got = await t.query(api.example.getTrackByIsrc, { isrc: "GBDUW0000059" });
  expect(got.durationMs).toBe(320_000);
  expect(got.providers).toHaveLength(2);
  expect(got.artistIds.sort()).toEqual([artistId, artistId2].sort());
  const byId = await t.query(api.example.getTrack, { id });
  expect(byId._id).toBe(id);
});

test("upsertTrack re-links a provider's new external id for the same ISRC", async () => {
  const t = setup();
  await t.mutation(api.example.upsertTrack, {
    provider: "spotify",
    externalId: "old",
    value: track(),
  });
  const got1 = await t.query(api.example.getTrackByIsrc, {
    isrc: "GBDUW0000059",
  });
  await t.mutation(api.example.upsertTrack, {
    provider: "spotify",
    externalId: "new",
    value: track(),
  });
  const got2 = await t.query(api.example.getTrackByIsrc, {
    isrc: "GBDUW0000059",
  });
  expect(got2._id).toBe(got1._id);
  expect(got2.providers).toHaveLength(1);
  expect(got2.providers[0].providerId).toBe("new");
});

test("upsertPlaylist inserts + updates by source-provider identity", async () => {
  const t = setup();
  const trackId = await t.mutation(api.example.upsertTrack, {
    provider: "spotify",
    externalId: "t1",
    value: track(),
  });
  const id = await t.mutation(api.example.upsertPlaylist, {
    provider: "spotify",
    providerId: "pl1",
    title: "Top Hits",
    owner: "Spotify",
    trackIds: [trackId],
  });
  const got = await t.query(api.example.getPlaylist, { id });
  expect(got.title).toBe("Top Hits");
  expect(got.trackIds).toEqual([trackId]);
  const id2 = await t.mutation(api.example.upsertPlaylist, {
    provider: "spotify",
    providerId: "pl1",
    title: "Top Hits 2024",
    trackIds: [],
  });
  expect(id2).toBe(id);
  const got2 = await t.query(api.example.getPlaylist, { id });
  expect(got2.title).toBe("Top Hits 2024");
  expect(got2.trackIds).toEqual([]);
});

test("searchArtists + searchTracks find by name/title", async () => {
  const t = setup();
  await t.mutation(api.example.upsertArtist, {
    provider: "spotify",
    externalId: "sp1",
    value: artist({ name: "Daft Punk" }),
  });
  await t.mutation(api.example.upsertTrack, {
    provider: "spotify",
    externalId: "t1",
    value: track({ title: "Harder Better Faster Stronger" }),
  });
  // exercise both the default-limit and explicit-limit branches
  const artists = await t.query(api.example.searchArtists, {
    query: "Daft",
    limit: 5,
  });
  expect(artists.map((a: { name: string }) => a.name)).toContain("Daft Punk");
  const artistsDefault = await t.query(api.example.searchArtists, {
    query: "Daft",
  });
  expect(artistsDefault).toHaveLength(1);
  const tracks = await t.query(api.example.searchTracks, { query: "Harder" });
  expect(tracks).toHaveLength(1);
  const tracksLimited = await t.query(api.example.searchTracks, {
    query: "Harder",
    limit: 3,
  });
  expect(tracksLimited).toHaveLength(1);
});

test("selectEligible returns rotated rows, excludes ids, honors salt + scanLimit", async () => {
  const t = setup();
  const ids: string[] = [];
  for (const name of ["A", "B", "C", "D"]) {
    ids.push(
      await t.mutation(api.example.upsertArtist, {
        provider: "spotify",
        externalId: `sp-${name}`,
        value: artist({ name }),
      }),
    );
  }
  const picked = await t.query(api.example.selectEligible, {
    kind: "artist",
    limit: 2,
  });
  expect(picked).toHaveLength(2);

  const firstId = ids[0];
  if (firstId === undefined) throw new Error("expected seeded ids");
  const excluded = await t.query(api.example.selectEligible, {
    kind: "artist",
    limit: 10,
    excludeIds: [firstId],
    salt: "fixed-seed",
    scanLimit: 100,
  });
  expect(excluded.map((r: { _id: string }) => r._id)).not.toContain(firstId);
  expect(excluded).toHaveLength(3);

  // tracks branch
  await t.mutation(api.example.upsertTrack, {
    provider: "spotify",
    externalId: "t1",
    value: track(),
  });
  const tracks = await t.query(api.example.selectEligible, {
    kind: "track",
    limit: 5,
  });
  expect(tracks).toHaveLength(1);
});
