/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  return convexTest(schema, modules);
}

test("reconcileCacheStats backfills pre-upgrade rows in bounded batches", async () => {
  vi.useFakeTimers();
  try {
    const t = setup();
    await t.run(async (ctx) => {
      for (let index = 0; index < 101; index += 1) {
        await ctx.db.insert("cacheEntries", {
          kind: "artist",
          provider: "wikidata",
          externalId: `legacy-${index}`,
          value: { name: `Legacy ${index}`, genres: [] },
          fetchedAt: 1,
          expiresAt: Number.MAX_SAFE_INTEGER,
        });
      }
    });

    expect(await t.mutation(api.mutations.reconcileCacheStats, {})).toBe(100);
    expect(await t.query(api.queries.stats, {})).toEqual({ total: 100 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.query(api.queries.stats, {})).toEqual({ total: 101 });
  } finally {
    vi.useRealTimers();
  }
});

test("cache mutations count an uncounted row exactly once", async () => {
  const t = setup();
  await t.run(async (ctx) => {
    await ctx.db.insert("cacheEntries", {
      kind: "artist",
      provider: "wikidata",
      externalId: "legacy",
      value: { name: "Legacy", genres: [] },
      fetchedAt: 1,
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
  });

  await t.mutation(api.mutations.put, {
    kind: "artist",
    provider: "wikidata",
    externalId: "legacy",
    value: { name: "Updated", genres: [] },
  });
  expect(await t.query(api.queries.stats, {})).toEqual({ total: 1 });
  expect(
    await t.mutation(api.mutations.invalidate, {
      kind: "artist",
      provider: "wikidata",
      externalId: "legacy",
    }),
  ).toBe(true);
  expect(await t.query(api.queries.stats, {})).toEqual({ total: 0 });
});

test("invalidating an uncounted legacy row never decrements the maintained total", async () => {
  const t = setup();
  await t.run(async (ctx) => {
    await ctx.db.insert("cacheEntries", {
      kind: "artist",
      provider: "wikidata",
      externalId: "invalidated-legacy",
      value: { name: "Legacy", genres: [] },
      fetchedAt: 1,
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
  });
  expect(
    await t.mutation(api.mutations.invalidate, {
      kind: "artist",
      provider: "wikidata",
      externalId: "invalidated-legacy",
    }),
  ).toBe(true);
  expect(await t.query(api.queries.stats, {})).toEqual({ total: 0 });
});

test("pruning an uncounted legacy row never decrements the maintained total", async () => {
  const t = setup();
  await t.run(async (ctx) => {
    await ctx.db.insert("cacheEntries", {
      kind: "artist",
      provider: "wikidata",
      externalId: "expired-legacy",
      value: { name: "Legacy", genres: [] },
      fetchedAt: 1,
      expiresAt: 1,
    });
  });
  expect(await t.mutation(api.mutations.pruneExpired, {})).toBe(1);
  expect(await t.query(api.queries.stats, {})).toEqual({ total: 0 });
});

test("import heartbeat rejects a request that no longer owns a running lease", async () => {
  const t = setup();
  const requestId = await t.run((ctx) =>
    ctx.db.insert("importRequests", {
      entityType: "track",
      requestType: "import",
      targetMode: "providerId",
      providerScope: "spotify",
      provider: "spotify",
      providerId: "track",
      priority: "normal",
      status: "queued",
      dedupeKey: "heartbeat-test",
      retryCount: 0,
      requestedAt: 1,
      updatedAt: 1,
    }),
  );
  await expect(
    t.mutation(internal.imports.mutations.heartbeat, { requestId }),
  ).rejects.toThrow(/IMPORT_LEASE_LOST|no longer running/);
});
