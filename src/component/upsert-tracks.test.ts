import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api.js";
import schema from "./schema.js";
import { UPSERT_TRACKS_BATCH } from "./catalog/mutations.js";

const modules = import.meta.glob("./**/*.ts");

function track(index: number, isrc = `US${String(index).padStart(10, "0")}`) {
  return { externalId: `t${String(index)}`, value: { title: `Track ${String(index)}`, artists: [], genres: [], isrc } };
}

test("upsertTracks writes a batch in one call and reports per-track errors", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.catalog.mutations.upsertTracks, {
    provider: "spotify",
    tracks: [track(1, "USAAA0000001")],
  });
  const results = await t.mutation(internal.catalog.mutations.upsertTracks, {
    provider: "spotify",
    tracks: [track(1, "USBBB0000001"), track(2), track(3)],
  });
  expect(results[0]).toEqual({ error: expect.stringMatching(/changed ISRC/) });
  expect(results.slice(1).every((result) => "trackId" in result)).toBe(true);
  const rows = await t.run((ctx) => ctx.db.query("tracks").collect());
  expect(rows.map((row) => row.isrc).sort()).toEqual(
    ["USAAA0000001", track(2).value.isrc, track(3).value.isrc].sort(),
  );
});

test("upsertTracks rejects a batch over the cap", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.mutation(internal.catalog.mutations.upsertTracks, {
      provider: "spotify",
      tracks: Array.from({ length: UPSERT_TRACKS_BATCH + 1 }, (_, i) => track(i)),
    }),
  ).rejects.toThrow(/at most 50 tracks/);
});

test("markStarted moves a queued request to running in one call", async () => {
  const t = convexTest(schema, modules);
  const requestId = await t.run((ctx) =>
    ctx.db.insert("importRequests", {
      entityType: "artist",
      requestType: "import",
      targetMode: "providerId",
      providerScope: "spotify",
      provider: "spotify",
      providerId: "a1",
      priority: "normal",
      status: "queued",
      dedupeKey: "mark-started-test",
      retryCount: 0,
      requestedAt: 1,
      updatedAt: 1,
    }),
  );
  await t.mutation(internal.imports.mutations.markStarted, { requestId });
  const row = await t.run((ctx) => ctx.db.get("importRequests", requestId));
  expect(row?.status).toBe("running");
  expect(row?.startedAt).toBeTypeOf("number");
  await expect(
    t.mutation(internal.imports.mutations.markStarted, { requestId }),
  ).rejects.toThrow(/Invalid import transition/);
});
