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

test("getArtistImage resolves per the field-source policy", async () => {
  const t = setup();
  await t.mutation(api.example.upsertArtist, {
    provider: "spotify",
    externalId: "a1",
    value: { name: "Daft Punk", genres: [], imageUrl: "https://sp/img" },
  });
  await t.mutation(api.example.upsertArtist, {
    provider: "apple",
    externalId: "ap1",
    value: { name: "Daft Punk", genres: [], imageUrl: "https://ap/img" },
  });

  // {from} picks that provider's image
  expect(
    await t.query(api.example.getArtistImage, {
      provider: "spotify",
      providerId: "a1",
      policy: { from: "spotify" },
    }),
  ).toBe("https://sp/img");

  // {prefer} skips absent providers
  expect(
    await t.query(api.example.getArtistImage, {
      provider: "spotify",
      providerId: "a1",
      policy: { prefer: ["wikidata", "apple"] },
    }),
  ).toBe("https://ap/img");

  // no policy -> canonical image (last writer = apple)
  expect(
    await t.query(api.example.getArtistImage, {
      provider: "spotify",
      providerId: "a1",
    }),
  ).toBe("https://ap/img");

  // unknown provider id -> null
  expect(
    await t.query(api.example.getArtistImage, {
      provider: "deezer",
      providerId: "nope",
    }),
  ).toBeNull();
});

test("getArtistImage returns null when no image is available", async () => {
  const t = setup();
  await t.mutation(api.example.upsertArtist, {
    provider: "spotify",
    externalId: "a2",
    value: { name: "Imageless", genres: [] },
  });
  expect(
    await t.query(api.example.getArtistImage, {
      provider: "spotify",
      providerId: "a2",
      policy: { from: "spotify" },
    }),
  ).toBeNull();
});
