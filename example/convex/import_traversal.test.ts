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

test("importArtist tracks:'all' promotes ISRC tracks across the artist's albums", async () => {
  const t = setup();
  await configure(t);
  stubFetch([
    TOKEN,
    ARTIST,
    {
      match: /\/v1\/artists\/a1\/albums/,
      body: { items: [{ id: "al1", name: "Discovery" }], total: 1 },
    },
    {
      match: /\/v1\/albums\/al1/,
      body: {
        id: "al1",
        name: "Discovery",
        artists: [{ id: "a1", name: "Daft Punk" }],
        tracks: {
          items: [
            {
              id: "t1",
              name: "One More Time",
              artists: [{ id: "a1", name: "Daft Punk" }],
              external_ids: { isrc: "GBALL00000001" },
              duration_ms: 320_000,
            },
          ],
        },
      },
    },
  ]);
  const result = await t.action(api.example.importArtist, {
    provider: "spotify",
    targetMode: "providerId",
    providerId: "a1",
    tracks: "all",
  });
  expect(result.status).toBe("completed");
  const request = await t.query(api.example.getImportRequest, {
    requestId: result.requestId,
  });
  expect(request.resultSummary).toContain("+1 tracks");
});

test("importTrack promotes the track + its credited artists (with + without id)", async () => {
  const t = setup();
  await configure(t);
  stubFetch([
    TOKEN,
    {
      match: /\/v1\/tracks\/t1/,
      body: {
        id: "t1",
        name: "Genesis",
        external_ids: { isrc: "FR1234567890" },
        artists: [
          { id: "a1", name: "Justice" },
          { name: "Uncredited" }, // no id -> skipped as a relation
        ],
      },
    },
  ]);
  const result = await t.action(api.example.importTrack, {
    provider: "spotify",
    providerId: "t1",
  });
  expect(result.status).toBe("completed");
  const track = await t.query(api.example.getTrackByIsrc, {
    isrc: "FR1234567890",
  });
  expect(track.title).toBe("Genesis");
  expect(track.artistIds).toHaveLength(1);
});

test("importPlaylist promotes ISRC tracks + ENRICHES the ISRC-less ones", async () => {
  const t = setup();
  await configure(t);
  stubFetch([
    TOKEN,
    {
      match: /\/v1\/playlists\/p1/,
      body: {
        id: "p1",
        name: "Top Hits",
        owner: { display_name: "Spotify" },
        tracks: {
          items: [
            {
              track: {
                id: "t1",
                name: "Genesis",
                artists: [{ id: "a1", name: "Justice" }],
                external_ids: { isrc: "FR1234567890" },
              },
            },
            // ISRC-less tracks trigger enrichment via GET /tracks
            { track: { id: "t2", name: "NoIsrc", artists: [{ id: "a1", name: "X" }] } },
            { track: { id: "t3", name: "StillNoIsrc", artists: [{ id: "a1", name: "X" }] } },
            { track: null },
          ],
        },
      },
    },
    {
      // enrichment: t2 recovers an ISRC, t3 still lacks one (dropped)
      match: /\/v1\/tracks\?.*ids=t2/,
      body: {
        tracks: [
          { id: "t2", name: "NoIsrc", artists: [{ id: "a1", name: "X" }], external_ids: { isrc: "ENRICHED0001" } },
          { id: "t3", name: "StillNoIsrc", artists: [{ id: "a1", name: "X" }] },
        ],
      },
    },
  ]);
  const result = await t.action(api.example.importPlaylist, {
    provider: "spotify",
    providerId: "p1",
  });
  expect(result.status).toBe("completed");
  const request = await t.query(api.example.getImportRequest, {
    requestId: result.requestId,
  });
  // t1 (had ISRC) + t2 (enriched) = 2; t3 stays ISRC-less and is dropped
  expect(request.resultSummary).toContain("2 tracks");
  const playlist = await t.query(api.example.getPlaylist, {
    id: request.resolvedPlaylistId,
  });
  expect(playlist.title).toBe("Top Hits");
  expect(playlist.trackIds).toHaveLength(2);
});

test("importPlaylist skips enrichment when every track already has an ISRC", async () => {
  const t = setup();
  await configure(t);
  // no /v1/tracks route: a needless enrichment call would 404 + fail the import
  stubFetch([
    TOKEN,
    {
      match: /\/v1\/playlists\/p2/,
      body: {
        id: "p2",
        name: "AllISRC",
        tracks: {
          items: [
            {
              track: {
                id: "t1",
                name: "Genesis",
                artists: [{ id: "a1", name: "Justice" }],
                external_ids: { isrc: "FR1234567890" },
              },
            },
          ],
        },
      },
    },
  ]);
  const result = await t.action(api.example.importPlaylist, {
    provider: "spotify",
    providerId: "p2",
  });
  expect(result.status).toBe("completed");
});

test("importPlaylist on a provider without batch fetch drops ISRC-less tracks", async () => {
  const t = setup();
  // Deezer is no-auth + has no getSeveralTracks; an ISRC-less track is dropped
  stubFetch([
    {
      match: /api\.deezer\.com\/playlist\/5/,
      body: {
        id: 5,
        title: "Deezer PL",
        tracks: {
          data: [
            { id: 1, title: "Has ISRC", isrc: "DE0000000001", artist: { id: 9, name: "X" } },
            { id: 2, title: "No ISRC", artist: { id: 9, name: "X" } },
          ],
        },
      },
    },
  ]);
  const result = await t.action(api.example.importPlaylist, {
    provider: "deezer",
    providerId: "5",
  });
  expect(result.status).toBe("completed");
  const request = await t.query(api.example.getImportRequest, {
    requestId: result.requestId,
  });
  expect(request.resultSummary).toContain("1 tracks");
});

test("importPlaylist caps tracks at the given limit", async () => {
  const t = setup();
  await configure(t);
  stubFetch([
    TOKEN,
    {
      match: /\/v1\/playlists\/p3/,
      body: {
        id: "p3",
        name: "Big",
        tracks: {
          items: [
            { track: { id: "t1", name: "A", artists: [], external_ids: { isrc: "GBLIM0000001" } } },
            { track: { id: "t2", name: "B", artists: [], external_ids: { isrc: "GBLIM0000002" } } },
          ],
        },
      },
    },
  ]);
  const result = await t.action(api.example.importPlaylist, {
    provider: "spotify",
    providerId: "p3",
    limit: 1,
  });
  const request = await t.query(api.example.getImportRequest, {
    requestId: result.requestId,
  });
  expect(request.resultSummary).toContain("1 tracks");
});

test("importPlaylist with no providerId fails", async () => {
  const t = setup();
  await configure(t);
  stubFetch([TOKEN]);
  const result = await t.action(api.example.importPlaylist, {
    provider: "spotify",
    providerId: "",
  });
  expect(result.status).toBe("failed");
});

test("importTrack with no providerId fails", async () => {
  const t = setup();
  await configure(t);
  stubFetch([TOKEN]);
  const result = await t.action(api.example.importTrack, {
    provider: "spotify",
    providerId: "",
  });
  expect(result.status).toBe("failed");
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

test("importAlbum promotes ISRC tracks (+enrich) + artists + stores the album", async () => {
  const t = setup();
  await configure(t);
  stubFetch([
    TOKEN,
    {
      match: /\/v1\/albums\/al1/,
      body: {
        id: "al1",
        name: "Discovery",
        artists: [{ id: "a1", name: "Daft Punk" }],
        release_date: "2001-03-12",
        tracks: {
          items: [
            { id: "t1", name: "One More Time", artists: [{ id: "a1", name: "Daft Punk" }], external_ids: { isrc: "GBALB0000001" } },
            { id: "t2", name: "Aerodynamic", artists: [{ id: "a1", name: "Daft Punk" }] },
          ],
        },
      },
    },
    {
      match: /\/v1\/tracks\?.*ids=t2/,
      body: { tracks: [{ id: "t2", name: "Aerodynamic", artists: [{ id: "a1", name: "Daft Punk" }], external_ids: { isrc: "GBALB0000002" } }] },
    },
  ]);
  const result = await t.action(api.example.importAlbum, { provider: "spotify", providerId: "al1" });
  expect(result.status).toBe("completed");
  const request = await t.query(api.example.getImportRequest, { requestId: result.requestId });
  expect(request.resultSummary).toContain("2 tracks");
  const album = await t.query(api.example.getAlbum, { id: request.resolvedAlbumId });
  expect(album.title).toBe("Discovery");
  expect(album.trackIds).toHaveLength(2);
  expect(album.artistIds).toHaveLength(1);
});

test("importAlbum with no providerId fails", async () => {
  const t = setup();
  await configure(t);
  stubFetch([TOKEN]);
  const result = await t.action(api.example.importAlbum, { provider: "spotify", providerId: "" });
  expect(result.status).toBe("failed");
});

test("importAlbum caps tracks at the limit (every track already has an ISRC)", async () => {
  const t = setup();
  await configure(t);
  // no /v1/tracks route -> a needless enrichment call would fail; all tracks have ISRC
  stubFetch([
    TOKEN,
    {
      match: /\/v1\/albums\/al2/,
      body: {
        id: "al2",
        name: "Capped",
        artists: [{ id: "a1", name: "X" }],
        tracks: {
          items: [
            { id: "t1", name: "A", artists: [], external_ids: { isrc: "GBCAP0000001" } },
            { id: "t2", name: "B", artists: [], external_ids: { isrc: "GBCAP0000002" } },
          ],
        },
      },
    },
  ]);
  const result = await t.action(api.example.importAlbum, { provider: "spotify", providerId: "al2", limit: 1 });
  const request = await t.query(api.example.getImportRequest, { requestId: result.requestId });
  expect(request.resultSummary).toContain("1 tracks");
});

test("importAlbum on a provider without batch fetch drops ISRC-less tracks", async () => {
  const t = setup();
  stubFetch([
    {
      match: /api\.deezer\.com\/album\/9/,
      body: {
        id: 9,
        title: "Deezer Album",
        artist: { id: 1, name: "X" },
        tracks: { data: [
          { id: 1, title: "Has ISRC", isrc: "DEALB0000001", artist: { id: 1, name: "X" } },
          { id: 2, title: "No ISRC", artist: { id: 1, name: "X" } },
        ] },
      },
    },
  ]);
  const result = await t.action(api.example.importAlbum, { provider: "deezer", providerId: "9" });
  const request = await t.query(api.example.getImportRequest, { requestId: result.requestId });
  expect(request.resultSummary).toContain("1 tracks");
});

test("importTrack withAlbum also imports the track's album", async () => {
  const t = setup();
  await configure(t);
  stubFetch([
    TOKEN,
    {
      match: /\/v1\/tracks\/t1/,
      body: {
        id: "t1",
        name: "One More Time",
        external_ids: { isrc: "GBWAL0000001" },
        artists: [{ id: "a1", name: "Daft Punk" }],
        album: { id: "al1", name: "Discovery", images: [] },
      },
    },
    {
      match: /\/v1\/albums\/al1/,
      body: { id: "al1", name: "Discovery", artists: [{ id: "a1", name: "Daft Punk" }], tracks: { items: [] } },
    },
  ]);
  const result = await t.action(api.example.importTrack, {
    provider: "spotify",
    providerId: "t1",
    withAlbum: true,
  });
  expect(result.status).toBe("completed");
  const album = await t.query(api.example.getAlbumByProvider, {
    provider: "spotify",
    providerId: "al1",
  });
  expect(album.title).toBe("Discovery");
});

test("importTrack withAlbum is a no-op when the track has no album", async () => {
  const t = setup();
  await configure(t);
  stubFetch([
    TOKEN,
    {
      match: /\/v1\/tracks\/t2/,
      body: { id: "t2", name: "Standalone", external_ids: { isrc: "GBWAL0000002" }, artists: [] },
    },
  ]);
  const result = await t.action(api.example.importTrack, {
    provider: "spotify",
    providerId: "t2",
    withAlbum: true,
  });
  expect(result.status).toBe("completed");
});

test("an entry point attaches to an in-flight request instead of re-running", async () => {
  const t = setup();
  // pre-seed an active (queued) request the importArtist call will collapse onto
  const seeded = await t.mutation(api.example.createImportRequest, {
    entityType: "artist",
    requestType: "import",
    targetMode: "providerId",
    providerScope: "spotify",
    provider: "spotify",
    providerId: "a1",
  });
  expect(seeded.deduped).toBe(false);
  // no creds + no fetch stub: a dedup attach must NOT run the traversal
  const res = await t.action(api.example.importArtist, {
    provider: "spotify",
    targetMode: "providerId",
    providerId: "a1",
  });
  expect(res.requestId).toBe(seeded.requestId);
  expect(res.status).toBe("queued"); // the active request's status, not re-run
});

test("driving a transition on a missing request is rejected", async () => {
  const t = setup();
  await expect(
    t.action(api.example.runArtistImport, {
      requestId: "000000000000999999importRequests",
      provider: "spotify",
      targetMode: "providerId",
      name: "",
      providerId: "a1",
    }),
  ).rejects.toThrow(/not found/);
});

test("re-driving a completed request is rejected by the transition guard", async () => {
  const t = setup();
  await configure(t);
  stubFetch([TOKEN, ARTIST]);
  const done = await t.action(api.example.importArtist, {
    provider: "spotify",
    targetMode: "providerId",
    providerId: "a1",
  });
  expect(done.status).toBe("completed");
  // a second drive of the same now-completed request: completed → claimed is illegal
  await expect(
    t.action(api.example.runArtistImport, {
      requestId: done.requestId,
      provider: "spotify",
      targetMode: "providerId",
      name: "",
      providerId: "a1",
    }),
  ).rejects.toThrow(/Invalid import transition/);
});
