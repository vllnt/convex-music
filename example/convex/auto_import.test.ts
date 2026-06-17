/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import schema from "./schema.js";
import { register } from "../../src/test.js";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}

interface Route {
  match: RegExp;
  body: unknown;
}

function stubFetch(routes: Route[]): void {
  vi.stubGlobal("fetch", (url: string | URL): Promise<Response> => {
    const target = String(url);
    const route = routes.find((r) => r.match.test(target));
    return Promise.resolve(
      new Response(JSON.stringify(route?.body ?? {}), {
        status: route === undefined ? 404 : 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });
}

const TOKEN: Route = {
  match: /accounts\.spotify\.com\/api\/token/,
  body: { access_token: "tok", token_type: "Bearer", expires_in: 3600 },
};
const ARTIST = (id: string): Route => ({
  match: new RegExp(`/v1/artists/${id}$`),
  body: { id, name: `Artist ${id}`, genres: [] },
});

async function configure(t: ReturnType<typeof setup>): Promise<void> {
  await t.mutation(api.example.configure, {
    provider: "spotify",
    secrets: { clientId: "id", clientSecret: "secret" },
  });
}

afterEach(() => vi.unstubAllGlobals());

test("runAutoImport imports due sources by kind + skips provider-less ones", async () => {
  const t = setup();
  await configure(t);
  stubFetch([
    TOKEN,
    ARTIST("a1"),
    {
      match: /\/v1\/search\?.*q=daft/,
      body: { artists: { items: [{ id: "a1", name: "Daft Punk", genres: [] }] } },
    },
    {
      match: /\/v1\/tracks\/t1/,
      body: {
        id: "t1",
        name: "Track",
        artists: [{ id: "a1", name: "X" }],
        external_ids: { isrc: "GBDUW0000059" },
      },
    },
    {
      match: /\/v1\/playlists\/p1/,
      body: {
        id: "p1",
        name: "PL",
        tracks: {
          items: [
            {
              track: {
                id: "t2",
                name: "PLTrack",
                artists: [{ id: "a1", name: "X" }],
                external_ids: { isrc: "USPLT0000001" },
              },
            },
          ],
        },
      },
    },
  ]);
  await t.mutation(api.example.addSource, {
    kind: "artist",
    by: "name",
    value: "daft",
    provider: "spotify",
  });
  await t.mutation(api.example.addSource, {
    kind: "track",
    by: "providerId",
    value: "t1",
    provider: "spotify",
  });
  await t.mutation(api.example.addSource, {
    kind: "playlist",
    by: "providerId",
    value: "p1",
    provider: "spotify",
  });
  await t.mutation(api.example.addSource, {
    kind: "artist",
    by: "name",
    value: "no-provider",
  });

  const first = await t.action(api.example.runAutoImport, { now: 1000 });
  expect(first).toEqual({ imported: 3, skipped: 1 });

  // re-run with defaults (no now/limit): one-shot sources are no longer due
  const second = await t.action(api.example.runAutoImport, {});
  expect(second).toEqual({ imported: 0, skipped: 1 });
});

test("runAutoImport respects cadence (isDue)", async () => {
  const t = setup();
  await configure(t);
  stubFetch([TOKEN, ARTIST("a1")]);
  await t.mutation(api.example.addSource, {
    kind: "artist",
    by: "providerId",
    value: "a1",
    provider: "spotify",
    cadenceMs: 1000,
  });

  expect((await t.action(api.example.runAutoImport, { now: 10_000 })).imported).toBe(1);
  // within cadence -> not due
  expect((await t.action(api.example.runAutoImport, { now: 10_500 })).imported).toBe(0);
  // past cadence -> due again
  expect((await t.action(api.example.runAutoImport, { now: 12_000 })).imported).toBe(1);
});

test("a source with no cadence is one-shot", async () => {
  const t = setup();
  await configure(t);
  stubFetch([TOKEN, ARTIST("a2")]);
  await t.mutation(api.example.addSource, {
    kind: "artist",
    by: "providerId",
    value: "a2",
    provider: "spotify",
  });
  expect((await t.action(api.example.runAutoImport, { now: 1000 })).imported).toBe(1);
  expect(
    (await t.action(api.example.runAutoImport, { now: 9_999_999 })).imported,
  ).toBe(0);
});

const FAR_FUTURE = Date.now() + 365 * 24 * 60 * 60 * 1000;

test("runRefresh re-syncs stale artists from their providers", async () => {
  const t = setup();
  await configure(t);
  await t.mutation(api.example.upsertArtist, {
    provider: "spotify",
    externalId: "a1",
    value: { name: "Daft Punk", genres: [] },
  });
  await t.mutation(api.example.markStale, { kind: "artist", now: FAR_FUTURE });
  stubFetch([TOKEN, ARTIST("a1")]);
  expect((await t.action(api.example.runRefresh, { kind: "artist" })).refreshed).toBe(1);
});

test("runRefresh re-syncs stale tracks + no-ops when none are stale", async () => {
  const t = setup();
  await configure(t);
  // nothing stale yet
  expect((await t.action(api.example.runRefresh, { kind: "track" })).refreshed).toBe(0);
  await t.mutation(api.example.upsertTrack, {
    provider: "spotify",
    externalId: "tr1",
    value: { title: "X", artists: [], isrc: "GBTEST000099" },
  });
  await t.mutation(api.example.markStale, { kind: "track", now: FAR_FUTURE });
  stubFetch([
    TOKEN,
    {
      match: /\/v1\/tracks\/tr1/,
      body: { id: "tr1", name: "X", artists: [], external_ids: { isrc: "GBTEST000099" } },
    },
  ]);
  expect((await t.action(api.example.runRefresh, { kind: "track" })).refreshed).toBe(1);
});
