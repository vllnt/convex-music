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
const ARTIST: Route = {
  match: /\/v1\/artists\/a1$/,
  body: { id: "a1", name: "Daft Punk", genres: ["house"], popularity: 80 },
};

async function configure(t: ReturnType<typeof setup>): Promise<void> {
  await t.mutation(api.example.configure, {
    provider: "spotify",
    secrets: { clientId: "id", clientSecret: "secret" },
  });
}

afterEach(() => vi.unstubAllGlobals());

test("importArtist by providerId promotes the artist + completes the request", async () => {
  const t = setup();
  await configure(t);
  stubFetch([TOKEN, ARTIST]);
  const result = await t.action(api.example.importArtist, {
    provider: "spotify",
    targetMode: "providerId",
    providerId: "a1",
    mode: "import",
  });
  expect(result.status).toBe("completed");
  const request = await t.query(api.example.getImportRequest, {
    requestId: result.requestId,
  });
  expect(request.status).toBe("completed");
  expect(request.resolvedArtistId).toBeDefined();
  const artist = await t.query(api.example.getArtist, {
    id: request.resolvedArtistId,
  });
  expect(artist.name).toBe("Daft Punk");
});

test("importArtist by name resolves via search then promotes", async () => {
  const t = setup();
  await configure(t);
  stubFetch([
    TOKEN,
    {
      match: /\/v1\/search\?.*q=daft/,
      body: { artists: { items: [{ id: "a1", name: "Daft Punk", genres: [] }] } },
    },
    ARTIST,
  ]);
  const result = await t.action(api.example.importArtist, {
    provider: "spotify",
    targetMode: "name",
    name: "daft",
  });
  expect(result.status).toBe("completed");
});

test("importArtist by name with no search hit fails the request", async () => {
  const t = setup();
  await configure(t);
  stubFetch([
    TOKEN,
    { match: /\/v1\/search\?.*q=nope/, body: { artists: { items: [] } } },
  ]);
  const result = await t.action(api.example.importArtist, {
    provider: "spotify",
    targetMode: "name",
    name: "nope",
  });
  expect(result.status).toBe("failed");
  const request = await t.query(api.example.getImportRequest, {
    requestId: result.requestId,
  });
  expect(request.status).toBe("failed");
  expect(request.errorSummary).toContain("no artist found");
});

test("importArtist by providerId with no providerId fails", async () => {
  const t = setup();
  await configure(t);
  stubFetch([TOKEN]);
  const result = await t.action(api.example.importArtist, {
    provider: "spotify",
    targetMode: "providerId",
  });
  expect(result.status).toBe("failed");
});

test("importArtist withTracks promotes the artist's ISRC-bearing top tracks", async () => {
  const t = setup();
  await configure(t);
  stubFetch([
    TOKEN,
    ARTIST,
    {
      match: /\/v1\/artists\/a1\/top-tracks/,
      body: {
        tracks: [
          {
            id: "t1",
            name: "Genesis",
            artists: [{ id: "a1", name: "Justice" }],
            external_ids: { isrc: "FR1234567890" },
          },
          // a market-edge track with no ISRC is skipped (can't be unified)
          { id: "t2", name: "No ISRC", artists: [{ id: "a1", name: "Justice" }] },
        ],
      },
    },
  ]);
  const result = await t.action(api.example.importArtist, {
    provider: "spotify",
    targetMode: "providerId",
    providerId: "a1",
    withTracks: true,
  });
  expect(result.status).toBe("completed");
  const request = await t.query(api.example.getImportRequest, {
    requestId: result.requestId,
  });
  expect(request.resultSummary).toContain("+1 tracks");
  const track = await t.query(api.example.getTrackByIsrc, {
    isrc: "FR1234567890",
  });
  expect(track.title).toBe("Genesis");
});

test("withTracks tolerates a tracks-step failure: artist completes, tracks partial", async () => {
  const t = setup();
  await configure(t);
  // no top-tracks route -> the sub-step 404s, but the artist still imports
  stubFetch([TOKEN, ARTIST]);
  const result = await t.action(api.example.importArtist, {
    provider: "spotify",
    targetMode: "providerId",
    providerId: "a1",
    withTracks: true,
  });
  expect(result.status).toBe("completed");
  const request = await t.query(api.example.getImportRequest, {
    requestId: result.requestId,
  });
  expect(request.resultSummary).toContain("tracks partial");
});

test("re-importing the same artist keeps a single catalog row", async () => {
  const t = setup();
  await configure(t);
  stubFetch([TOKEN, ARTIST]);
  await t.action(api.example.importArtist, {
    provider: "spotify",
    targetMode: "providerId",
    providerId: "a1",
  });
  await t.action(api.example.importArtist, {
    provider: "spotify",
    targetMode: "providerId",
    providerId: "a1",
  });
  const found = await t.query(api.example.searchArtists, { query: "Daft" });
  expect(found).toHaveLength(1);
});
