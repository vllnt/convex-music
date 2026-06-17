/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import type { GenericSchema, SchemaDefinition } from "convex/server";
import { api } from "./_generated/api.js";
import schema from "./schema.js";
import { register } from "../../src/test.js";

const modules = import.meta.glob("./**/*.ts");

type T = TestConvex<SchemaDefinition<GenericSchema, boolean>>;

function setup(): T {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}

interface Route {
  match: RegExp;
  body: unknown;
  status?: number;
}

function stubFetch(routes: Route[]): void {
  vi.stubGlobal("fetch", (url: string | URL): Promise<Response> => {
    const target = String(url);
    const route = routes.find((r) => r.match.test(target));
    if (route === undefined) {
      return Promise.resolve(new Response(`no route: ${target}`, { status: 404 }));
    }
    return Promise.resolve(
      new Response(JSON.stringify(route.body), {
        status: route.status ?? 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });
}

const SPOTIFY_TOKEN: Route = {
  match: /accounts\.spotify\.com\/api\/token/,
  body: { access_token: "tok", token_type: "Bearer", expires_in: 3600 },
};

let applePem: string;

async function generatePem(): Promise<string> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", pair.privateKey),
  );
  let binary = "";
  for (const byte of pkcs8) binary += String.fromCharCode(byte);
  const lines = btoa(binary).match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`;
}

async function configureCreds(t: T): Promise<void> {
  await t.mutation(api.example.configure, {
    provider: "spotify",
    secrets: { clientId: "id", clientSecret: "secret" },
  });
  await t.mutation(api.example.configure, {
    provider: "apple",
    secrets: {
      issuer: "TEAM123456",
      keyId: "KEY7890AB",
      privateKeyPem: applePem,
    },
  });
}

beforeAll(async () => {
  applePem = await generatePem();
});

afterEach(() => vi.unstubAllGlobals());

test("configure is an upsert (insert then patch)", async () => {
  const t = setup();
  await t.mutation(api.example.configure, {
    provider: "spotify",
    secrets: { clientId: "old", clientSecret: "x" },
  });
  await t.mutation(api.example.configure, {
    provider: "spotify",
    secrets: { clientId: "new", clientSecret: "y" },
  });
  stubFetch([SPOTIFY_TOKEN, { match: /\/v1\/artists\/a1$/, body: { id: "a1", name: "A", genres: [] } }]);
  // a second provider config row exercises insert again
  await t.mutation(api.example.configure, {
    provider: "apple",
    secrets: { issuer: "T", keyId: "K", privateKeyPem: applePem },
  });
  const artist = await t.action(api.example.fetchArtist, {
    provider: "spotify",
    externalId: "a1",
  });
  expect(artist?.name).toBe("A");
});

test("fetchArtist: cache-miss fetches + promotes; cache-hit + force re-fetch", async () => {
  const t = setup();
  await configureCreds(t);
  let artistCalls = 0;
  stubFetch([
    SPOTIFY_TOKEN,
    {
      match: /\/v1\/artists\/a1$/,
      get body() {
        artistCalls += 1;
        return { id: "a1", name: "Daft Punk", genres: ["house"], popularity: 80 };
      },
    },
  ]);
  const first = await t.action(api.example.fetchArtist, {
    provider: "spotify",
    externalId: "a1",
  });
  expect(first?.name).toBe("Daft Punk");
  expect(artistCalls).toBe(1);

  const hit = await t.action(api.example.fetchArtist, {
    provider: "spotify",
    externalId: "a1",
  });
  expect(hit?.name).toBe("Daft Punk");
  expect(artistCalls).toBe(1);

  await t.action(api.example.fetchArtist, {
    provider: "spotify",
    externalId: "a1",
    force: true,
  });
  expect(artistCalls).toBe(2);
});

test("fetchTrack (spotify): promotes the track + its credited artist", async () => {
  const t = setup();
  await configureCreds(t);
  stubFetch([
    SPOTIFY_TOKEN,
    {
      match: /\/v1\/tracks\/t1/,
      body: {
        id: "t1",
        name: "One More Time",
        artists: [{ id: "sa1", name: "Daft Punk" }],
        external_ids: { isrc: "GBDUW0000059" },
        duration_ms: 320_000,
      },
    },
  ]);
  const track = await t.action(api.example.fetchTrack, {
    provider: "spotify",
    externalId: "t1",
  });
  expect(track?.isrc).toBe("GBDUW0000059");
  expect(track?.artistIds).toHaveLength(1);

  await t.action(api.example.fetchTrack, { provider: "spotify", externalId: "t1" });
  await t.action(api.example.fetchTrack, {
    provider: "spotify",
    externalId: "t1",
    force: true,
  });
});

test("fetchTrack (apple): a song with no artist relationship promotes no artists", async () => {
  const t = setup();
  await configureCreds(t);
  stubFetch([
    {
      match: /\/catalog\/us\/songs\/s1/,
      body: {
        data: [
          {
            id: "s1",
            type: "songs",
            attributes: {
              name: "Apple Song",
              artistName: "Solo",
              isrc: "USAPPLE00001",
            },
          },
        ],
      },
    },
  ]);
  const track = await t.action(api.example.fetchTrack, {
    provider: "apple",
    externalId: "s1",
  });
  expect(track?.isrc).toBe("USAPPLE00001");
  expect(track?.artistIds).toHaveLength(0);
});

test("search returns normalized artist + track hits", async () => {
  const t = setup();
  await configureCreds(t);
  stubFetch([
    SPOTIFY_TOKEN,
    {
      match: /\/v1\/search\?.*type=artist/,
      body: { artists: { items: [{ id: "a1", name: "Daft Punk", genres: [] }] } },
    },
    {
      match: /\/v1\/search\?.*type=track/,
      body: {
        tracks: {
          items: [{ id: "t1", name: "Get Lucky", artists: [{ id: "a", name: "X" }] }],
        },
      },
    },
  ]);
  const artists = await t.action(api.example.search, {
    provider: "spotify",
    query: "daft",
    type: "artist",
  });
  expect(artists[0]).toMatchObject({ type: "artist", externalId: "a1" });
  const tracks = await t.action(api.example.search, {
    provider: "spotify",
    query: "lucky",
    type: "track",
  });
  expect(tracks[0]?.type).toBe("track");
});

test("resolveByIsrc: catalog hit returns without searching", async () => {
  const t = setup();
  await configureCreds(t);
  await t.mutation(api.example.upsertTrack, {
    provider: "spotify",
    externalId: "t1",
    value: {
      title: "Cached",
      artists: [{ name: "X" }],
      isrc: "GBDUW0000059",
    },
  });
  // no fetch stub: a catalog hit must not hit the network
  vi.stubGlobal("fetch", () => Promise.reject(new Error("should not fetch")));
  const track = await t.action(api.example.resolveByIsrc, {
    isrc: "GBDUW0000059",
    provider: "spotify",
  });
  expect(track.title).toBe("Cached");
});

test("resolveByIsrc: cross-provider miss searches + promotes", async () => {
  const t = setup();
  await configureCreds(t);
  stubFetch([
    SPOTIFY_TOKEN,
    {
      match: /\/v1\/search\?.*q=isrc/,
      body: {
        tracks: {
          items: [
            {
              id: "t9",
              name: "Resolved",
              artists: [{ id: "a1", name: "X" }],
              external_ids: { isrc: "USNEW0000001" },
            },
          ],
        },
      },
    },
  ]);
  const track = await t.action(api.example.resolveByIsrc, {
    isrc: "USNEW0000001",
    provider: "spotify",
  });
  expect(track.title).toBe("Resolved");
});

test("resolveByIsrc: no provider has it -> null", async () => {
  const t = setup();
  await configureCreds(t);
  stubFetch([
    SPOTIFY_TOKEN,
    { match: /\/v1\/search\?.*q=isrc/, body: { tracks: { items: [] } } },
  ]);
  expect(
    await t.action(api.example.resolveByIsrc, {
      isrc: "USNONE0000001",
      provider: "spotify",
    }),
  ).toBeNull();
});

test("a provider without a token resolver rejects", async () => {
  const t = setup();
  await configureCreds(t);
  stubFetch([SPOTIFY_TOKEN]);
  await expect(
    t.action(api.example.fetchArtist, { provider: "musicbrainz", externalId: "x" }),
  ).rejects.toThrow(/No token resolver/);
});

test("an unconfigured provider rejects", async () => {
  const t = setup();
  stubFetch([SPOTIFY_TOKEN]);
  await expect(
    t.action(api.example.fetchArtist, { provider: "spotify", externalId: "a1" }),
  ).rejects.toThrow(/No credentials configured/);
});

test("a missing credential field rejects", async () => {
  const t = setup();
  await t.mutation(api.example.configure, {
    provider: "spotify",
    secrets: { clientId: "id" }, // clientSecret missing
  });
  stubFetch([SPOTIFY_TOKEN]);
  await expect(
    t.action(api.example.fetchArtist, { provider: "spotify", externalId: "a1" }),
  ).rejects.toThrow(/Missing required credential/);
});
