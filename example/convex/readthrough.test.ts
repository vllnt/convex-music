/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import schema from "./schema.js";
import { register } from "../../src/test.js";

const modules = import.meta.glob("./**/*.ts");

/** Node provides `process.env` at test runtime; declared for the type checker. */
declare const process: { env: Record<string, string | undefined> };

function setup() {
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

beforeAll(async () => {
  process.env.SPOTIFY_CLIENT_ID = "id";
  process.env.SPOTIFY_CLIENT_SECRET = "secret";
  process.env.APPLE_MUSIC_ISSUER = "TEAM123456";
  process.env.APPLE_MUSIC_KID = "KEY7890AB";
  process.env.APPLE_MUSIC_PRIVATE_KEY = await generatePem();
});

afterEach(() => vi.unstubAllGlobals());

test("fetchArtist: cache-miss fetches + promotes; cache-hit + force re-fetch", async () => {
  const t = setup();
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
  expect(first?.providers).toHaveLength(1);
  expect(artistCalls).toBe(1);

  // cache-through: no new provider call
  const hit = await t.action(api.example.fetchArtist, {
    provider: "spotify",
    externalId: "a1",
  });
  expect(hit?.name).toBe("Daft Punk");
  expect(artistCalls).toBe(1);

  // force: re-fetch
  await t.action(api.example.fetchArtist, {
    provider: "spotify",
    externalId: "a1",
    force: true,
  });
  expect(artistCalls).toBe(2);
});

test("fetchTrack (spotify): promotes the track + its credited artist", async () => {
  const t = setup();
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

  // cache-through + force
  await t.action(api.example.fetchTrack, { provider: "spotify", externalId: "t1" });
  await t.action(api.example.fetchTrack, {
    provider: "spotify",
    externalId: "t1",
    force: true,
  });
  const byIsrc = await t.query(api.example.getTrackByIsrc, {
    isrc: "GBDUW0000059",
  });
  expect(byIsrc?.providers).toHaveLength(1);
});

test("fetchTrack (apple): a song with no artist relationship promotes no artists", async () => {
  const t = setup();
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
  expect(artists).toEqual([
    { type: "artist", externalId: "a1", value: expect.objectContaining({ name: "Daft Punk" }) },
  ]);
  const tracks = await t.action(api.example.search, {
    provider: "spotify",
    query: "lucky",
    type: "track",
  });
  expect(tracks[0]?.type).toBe("track");
});

test("a provider without a token resolver rejects", async () => {
  const t = setup();
  stubFetch([SPOTIFY_TOKEN]);
  await expect(
    t.action(api.example.fetchArtist, {
      provider: "musicbrainz",
      externalId: "x",
    }),
  ).rejects.toThrow(/No token resolver/);
});

test("a missing credential rejects", async () => {
  const t = setup();
  const saved = process.env.SPOTIFY_CLIENT_SECRET;
  delete process.env.SPOTIFY_CLIENT_SECRET;
  stubFetch([SPOTIFY_TOKEN]);
  try {
    await expect(
      t.action(api.example.fetchArtist, { provider: "spotify", externalId: "a1" }),
    ).rejects.toThrow(/Missing required environment variable/);
  } finally {
    process.env.SPOTIFY_CLIENT_SECRET = saved;
  }
});
