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

const artistByName = {
  entityType: "artist" as const,
  requestType: "import" as const,
  targetMode: "name" as const,
  providerScope: "any",
  name: "Daft Punk",
  withTracks: true,
};

test("createImportRequest inserts a queued request with defaults", async () => {
  const t = setup();
  const result = await t.mutation(api.example.createImportRequest, artistByName);
  expect(result.deduped).toBe(false);
  const request = await t.query(api.example.getImportRequest, {
    requestId: result.requestId,
  });
  expect(request.status).toBe("queued");
  expect(request.priority).toBe("normal");
  expect(request.retryCount).toBe(0);
  expect(request.dedupeKey).toContain("tracks:top"); // withTracks:true → `top` depth
});

test("an identical in-flight request dedups onto the active one", async () => {
  const t = setup();
  const first = await t.mutation(api.example.createImportRequest, artistByName);
  const second = await t.mutation(api.example.createImportRequest, artistByName);
  expect(second.deduped).toBe(true);
  expect(second.requestId).toBe(first.requestId);
});

test("a different target or withTracks does not dedup", async () => {
  const t = setup();
  const a = await t.mutation(api.example.createImportRequest, artistByName);
  const b = await t.mutation(api.example.createImportRequest, {
    ...artistByName,
    name: "Justice",
  });
  const c = await t.mutation(api.example.createImportRequest, {
    ...artistByName,
    withTracks: false,
    priority: "high",
  });
  expect(b.requestId).not.toBe(a.requestId);
  expect(c.requestId).not.toBe(a.requestId);
  const cReq = await t.query(api.example.getImportRequest, {
    requestId: c.requestId,
  });
  expect(cReq.priority).toBe("high");
});

test("maintenance recovers abandoned imports and prunes terminal history", async () => {
  const t = setup();
  const first = await t.mutation(api.example.createImportRequest, artistByName);
  const cutoff = Date.now() + 10_000;
  expect(
    await t.mutation(api.example.recoverAbandonedImports, {
      status: "queued",
      before: cutoff,
      batch: 1,
    }),
  ).toBe(1);
  expect(
    (await t.query(api.example.getImportRequest, { requestId: first.requestId })).status,
  ).toBe("stale");

  const retry = await t.mutation(api.example.createImportRequest, artistByName);
  expect(retry.deduped).toBe(false);
  expect(retry.requestId).not.toBe(first.requestId);
  expect(
    await t.mutation(api.example.pruneTerminalImports, {
      status: "stale",
      before: cutoff,
      batch: 1,
    }),
  ).toBe(1);
  expect(
    await t.query(api.example.getImportRequest, { requestId: first.requestId }),
  ).toBeNull();
  expect(
    await t.mutation(api.example.recoverAbandonedImports, { status: "running" }),
  ).toBe(0);
  expect(
    await t.mutation(api.example.pruneTerminalImports, { status: "completed" }),
  ).toBe(0);
});

test.each([Number.NaN, 0, -1, 1.5, 501])(
  "import maintenance rejects invalid batch %s",
  async (batch) => {
    const t = setup();
    await expect(
      t.mutation(api.example.recoverAbandonedImports, {
        status: "running",
        batch,
      }),
    ).rejects.toThrow(/INVALID_BATCH|integer between/);
  },
);

test("listImportRequests returns queued requests newest-first", async () => {
  const t = setup();
  await t.mutation(api.example.createImportRequest, artistByName);
  await t.mutation(api.example.createImportRequest, {
    ...artistByName,
    name: "Justice",
  });
  const queued = await t.query(api.example.listImportRequests, {
    status: "queued",
    limit: 10,
  });
  expect(queued.length).toBe(2);
  const dflt = await t.query(api.example.listImportRequests, {
    status: "queued",
  });
  expect(dflt.length).toBe(2);
});
