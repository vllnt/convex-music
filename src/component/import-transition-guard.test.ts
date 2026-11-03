/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  return convexTest(schema, modules);
}

/** Args for a provider-id artist import; the transition guard fires before any provider call. */
function artistImportArgs(requestId: Id<"importRequests">) {
  return {
    requestId,
    provider: "spotify" as const,
    targetMode: "providerId" as const,
    name: "",
    providerId: "a1",
  };
}

function insertQueuedRequest(t: ReturnType<typeof setup>) {
  return t.run((ctx) =>
    ctx.db.insert("importRequests", {
      entityType: "artist",
      requestType: "import",
      targetMode: "providerId",
      providerScope: "spotify",
      provider: "spotify",
      providerId: "a1",
      priority: "normal",
      status: "queued",
      dedupeKey: "run-import-test",
      retryCount: 0,
      requestedAt: 1,
      updatedAt: 1,
    }),
  );
}

test("driving a transition on a missing request is rejected", async () => {
  const t = setup();
  const requestId = await insertQueuedRequest(t);
  await t.run((ctx) => ctx.db.delete("importRequests", requestId));
  await expect(
    t.action(
      internal.imports.actions.runArtistImport,
      artistImportArgs(requestId),
    ),
  ).rejects.toThrow(/not found/);
});

test("re-driving a completed request is rejected by the transition guard", async () => {
  const t = setup();
  const requestId = await insertQueuedRequest(t);
  // queued → claimed → running → completed, through the real lifecycle mutations
  await t.mutation(internal.imports.mutations.markClaimed, { requestId });
  await t.mutation(internal.imports.mutations.markRunning, { requestId });
  await t.mutation(internal.imports.mutations.markCompleted, { requestId });
  // a second drive of the same now-completed request: completed → claimed is illegal
  await expect(
    t.action(
      internal.imports.actions.runArtistImport,
      artistImportArgs(requestId),
    ),
  ).rejects.toThrow(/Invalid import transition/);
});
