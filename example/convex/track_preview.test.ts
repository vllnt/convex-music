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

test("getTrackPreview resolves per the field-source policy", async () => {
  const t = setup();
  // same ISRC from two providers -> one unified track, two provenance previews
  await t.mutation(api.example.upsertTrack, {
    provider: "spotify",
    externalId: "t1",
    value: { title: "One More Time", artists: [], isrc: "GBDUW0000059", genres: [], previewUrl: "https://sp/prev" },
  });
  await t.mutation(api.example.upsertTrack, {
    provider: "apple",
    externalId: "ap1",
    value: { title: "One More Time", artists: [], isrc: "GBDUW0000059", genres: [], previewUrl: "https://ap/prev" },
  });

  // {from} picks that provider's preview
  expect(
    await t.query(api.example.getTrackPreview, {
      provider: "spotify",
      providerId: "t1",
      policy: { from: "spotify" },
    }),
  ).toBe("https://sp/prev");

  // {prefer} skips absent providers
  expect(
    await t.query(api.example.getTrackPreview, {
      provider: "apple",
      providerId: "ap1",
      policy: { prefer: ["wikidata", "apple"] },
    }),
  ).toBe("https://ap/prev");

  // no policy -> no canonical preview (it is inherently per-provider) -> null
  expect(
    await t.query(api.example.getTrackPreview, { provider: "spotify", providerId: "t1" }),
  ).toBeNull();

  // unknown provider id -> null
  expect(
    await t.query(api.example.getTrackPreview, { provider: "deezer", providerId: "nope" }),
  ).toBeNull();
});

test("getTrackPreview returns null when the chosen provider has no preview", async () => {
  const t = setup();
  await t.mutation(api.example.upsertTrack, {
    provider: "spotify",
    externalId: "t2",
    value: { title: "No Preview", artists: [], isrc: "GBDUW0000060", genres: [] },
  });
  expect(
    await t.query(api.example.getTrackPreview, {
      provider: "spotify",
      providerId: "t2",
      policy: { from: "spotify" },
    }),
  ).toBeNull();
});
