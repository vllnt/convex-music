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

const track = (title: string) => ({ title, artists: [{ name: "An Artist" }] });
const artist = (name: string) => ({ name, genres: ["pop"] });

test("put inserts a track with a TTL; get returns it while fresh (happy path)", async () => {
  const t = setup();
  const id = await t.mutation(api.example.put, {
    kind: "track",
    provider: "spotify",
    externalId: "t1",
    isrc: "USABC1234567",
    value: track("Song One"),
    ttlMs: 60_000,
  });
  expect(typeof id).toBe("string");
  const hit = await t.query(api.example.get, {
    kind: "track",
    provider: "spotify",
    externalId: "t1",
  });
  expect(hit).not.toBeNull();
  expect(hit.value.title).toBe("Song One");
  expect(hit.expiresAt).toBeGreaterThan(Date.now());
});

test("put without a TTL never expires; get returns it", async () => {
  const t = setup();
  await t.mutation(api.example.put, {
    kind: "artist",
    provider: "musicbrainz",
    externalId: "a1",
    value: artist("Daft Punk"),
  });
  const hit = await t.query(api.example.get, {
    kind: "artist",
    provider: "musicbrainz",
    externalId: "a1",
  });
  expect(hit).not.toBeNull();
  expect(hit.value.name).toBe("Daft Punk");
  expect(hit.expiresAt).toBe(Number.MAX_SAFE_INTEGER);
});

test("put is an upsert: same key keeps the id and refreshes the value", async () => {
  const t = setup();
  const key = { kind: "track", provider: "spotify", externalId: "t1" } as const;
  const id1 = await t.mutation(api.example.put, { ...key, value: track("v1") });
  const id2 = await t.mutation(api.example.put, { ...key, value: track("v2") });
  expect(id2).toBe(id1);
  const hit = await t.query(api.example.get, key);
  expect(hit.value.title).toBe("v2");
});

test("get on an unknown key returns null", async () => {
  const t = setup();
  expect(
    await t.query(api.example.get, {
      kind: "track",
      provider: "spotify",
      externalId: "missing",
    }),
  ).toBeNull();
});

test("get on an expired entry returns null (adversarial)", async () => {
  const t = setup();
  await t.mutation(api.example.put, {
    kind: "track",
    provider: "apple",
    externalId: "stale",
    value: track("Stale"),
    ttlMs: -1_000,
  });
  expect(
    await t.query(api.example.get, {
      kind: "track",
      provider: "apple",
      externalId: "stale",
    }),
  ).toBeNull();
});

test("getByIsrc returns fresh tracks across providers and excludes expired", async () => {
  const t = setup();
  const isrc = "USXYZ7654321";
  await t.mutation(api.example.put, {
    kind: "track",
    provider: "spotify",
    externalId: "s1",
    isrc,
    value: track("Spotify copy"),
    ttlMs: 60_000,
  });
  await t.mutation(api.example.put, {
    kind: "track",
    provider: "apple",
    externalId: "a1",
    isrc,
    value: track("Apple copy"),
    ttlMs: 60_000,
  });
  await t.mutation(api.example.put, {
    kind: "track",
    provider: "deezer",
    externalId: "d1",
    isrc,
    value: track("Stale copy"),
    ttlMs: -1_000,
  });
  const fresh = await t.query(api.example.getByIsrc, { isrc });
  expect(fresh).toHaveLength(2);
  expect(fresh.map((e: { provider: string }) => e.provider).sort()).toEqual([
    "apple",
    "spotify",
  ]);
});

test("invalidate deletes an entry (true), and is a no-op on a missing key (false)", async () => {
  const t = setup();
  const key = { kind: "album", provider: "spotify", externalId: "al1" } as const;
  await t.mutation(api.example.put, {
    ...key,
    value: { title: "An Album", artists: [{ name: "An Artist" }] },
  });
  expect(await t.mutation(api.example.invalidate, key)).toBe(true);
  expect(await t.query(api.example.get, key)).toBeNull();
  expect(
    await t.mutation(api.example.invalidate, {
      kind: "album",
      provider: "spotify",
      externalId: "nope",
    }),
  ).toBe(false);
});

test("pruneExpired deletes only expired entries; stats counts what remains", async () => {
  const t = setup();
  await t.mutation(api.example.put, {
    kind: "track",
    provider: "spotify",
    externalId: "fresh",
    value: track("Fresh"),
    ttlMs: 60_000,
  });
  await t.mutation(api.example.put, {
    kind: "track",
    provider: "spotify",
    externalId: "expired",
    value: track("Expired"),
    ttlMs: -1_000,
  });
  await t.mutation(api.example.put, {
    kind: "artist",
    provider: "wikidata",
    externalId: "forever",
    value: artist("Forever"),
  });
  expect(await t.mutation(api.example.pruneExpired, {})).toBe(1);
  expect(await t.query(api.example.stats, {})).toEqual({ total: 2 });
});
