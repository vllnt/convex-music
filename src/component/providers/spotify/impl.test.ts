import { describe, expect, it } from "vitest";
import type { FetchDeps } from "../fetch.js";
import {
  DEFAULT_SPOTIFY_CONFIG,
  type SpotifyConfig,
  SpotifyProvider,
} from "./impl.js";

interface Route {
  match: RegExp;
  body: unknown;
  status?: number;
}

/** A routed fake `fetch` returning fixtures keyed by URL pattern. */
function harness(routes: Route[]): {
  deps: FetchDeps;
  urls: string[];
} {
  const urls: string[] = [];
  return {
    urls,
    deps: {
      fetch: (url) => {
        urls.push(url);
        const route = routes.find((r) => r.match.test(url));
        if (route === undefined) {
          return Promise.resolve(new Response("no route", { status: 404 }));
        }
        return Promise.resolve(
          new Response(JSON.stringify(route.body), {
            status: route.status ?? 200,
            headers: { "content-type": "application/json" },
          }),
        );
      },
      sleep: () => Promise.resolve(),
      random: () => 0,
    },
  };
}

function makeProvider(
  routes: Route[],
  cfg: SpotifyConfig = DEFAULT_SPOTIFY_CONFIG,
): { provider: SpotifyProvider; urls: string[] } {
  const { deps, urls } = harness(routes);
  return {
    provider: new SpotifyProvider(() => Promise.resolve("tok"), cfg, deps),
    urls,
  };
}

describe("SpotifyProvider", () => {
  it("getArtist maps the artist (no query params)", async () => {
    const { provider, urls } = makeProvider([
      {
        match: /\/artists\/a1$/,
        body: { id: "a1", name: "Daft Punk", genres: ["house"], popularity: 80 },
      },
    ]);
    const result = await provider.getArtist("a1");
    expect(result.externalId).toBe("a1");
    expect(result.value.name).toBe("Daft Punk");
    expect(urls[0]).toBe("https://api.spotify.com/v1/artists/a1");
  });

  it("getTrack passes the market param", async () => {
    const { provider, urls } = makeProvider([
      {
        match: /\/tracks\/t1\?/,
        body: {
          id: "t1",
          name: "One More Time",
          artists: [{ id: "a1", name: "Daft Punk" }],
          external_ids: { isrc: "GBDUW0000059" },
        },
      },
    ]);
    const result = await provider.getTrack("t1");
    expect(result.value.isrc).toBe("GBDUW0000059");
    expect(urls[0]).toContain("market=US");
  });

  it("getAlbum maps album + first-page tracks", async () => {
    const { provider } = makeProvider([
      {
        match: /\/albums\/al1\?/,
        body: {
          id: "al1",
          name: "Discovery",
          total_tracks: 2,
          tracks: {
            items: [
              { id: "t1", name: "A", artists: [{ id: "a1", name: "Daft Punk" }] },
              { id: "t2", name: "B", artists: [{ id: "a1", name: "Daft Punk" }] },
            ],
            total: 2,
          },
        },
      },
    ]);
    const album = await provider.getAlbum("al1");
    expect(album.value.title).toBe("Discovery");
    expect(album.tracks.map((t) => t.externalId)).toEqual(["t1", "t2"]);
  });

  it("getAlbum tolerates a missing tracks object", async () => {
    const { provider } = makeProvider([
      { match: /\/albums\/al2\?/, body: { id: "al2", name: "Empty" } },
    ]);
    expect((await provider.getAlbum("al2")).tracks).toEqual([]);
  });

  it("getPlaylist maps metadata + filters null tracks", async () => {
    const { provider } = makeProvider([
      {
        match: /\/playlists\/p1\?/,
        body: {
          id: "p1",
          name: "Top",
          description: "d",
          owner: { display_name: "Spotify" },
          tracks: {
            items: [
              {
                track: {
                  id: "t1",
                  name: "A",
                  artists: [{ id: "a1", name: "X" }],
                },
              },
              { track: null },
            ],
          },
        },
      },
    ]);
    const playlist = await provider.getPlaylist("p1");
    expect(playlist.value.owner).toBe("Spotify");
    expect(playlist.tracks).toHaveLength(1);
  });

  it("getPlaylist tolerates a missing tracks object", async () => {
    const { provider } = makeProvider([
      { match: /\/playlists\/p2\?/, body: { id: "p2", name: "Bare" } },
    ]);
    const playlist = await provider.getPlaylist("p2");
    expect(playlist.tracks).toEqual([]);
    expect(playlist.value.title).toBe("Bare");
  });

  it("getArtistTopTracks maps every track", async () => {
    const { provider } = makeProvider([
      {
        match: /\/artists\/a1\/top-tracks\?/,
        body: {
          tracks: [
            { id: "t1", name: "A", artists: [{ id: "a1", name: "X" }] },
            { id: "t2", name: "B", artists: [{ id: "a1", name: "X" }] },
          ],
        },
      },
    ]);
    expect(await provider.getArtistTopTracks("a1")).toHaveLength(2);
  });

  it("getArtistAlbums slices to the cap + flags partial", async () => {
    const cfg: SpotifyConfig = { ...DEFAULT_SPOTIFY_CONFIG, maxAlbumsPerArtist: 1 };
    const { provider } = makeProvider(
      [
        {
          match: /\/artists\/a1\/albums\?/,
          body: {
            total: 2,
            items: [
              { id: "al1", name: "One" },
              { id: "al2", name: "Two" },
            ],
          },
        },
        { match: /\/albums\/al1\?/, body: { id: "al1", name: "One" } },
        { match: /\/albums\/al2\?/, body: { id: "al2", name: "Two" } },
      ],
      cfg,
    );
    const result = await provider.getArtistAlbums("a1");
    expect(result.isPartial).toBe(true);
    expect(result.albums).toHaveLength(1);
    expect(result.albums[0]?.externalId).toBe("al1");
  });

  it("getArtistAlbums returns all when under the cap", async () => {
    const { provider } = makeProvider([
      {
        match: /\/artists\/a2\/albums\?/,
        body: { total: 1, items: [{ id: "al9", name: "Solo" }] },
      },
      { match: /\/albums\/al9\?/, body: { id: "al9", name: "Solo" } },
    ]);
    const result = await provider.getArtistAlbums("a2");
    expect(result.isPartial).toBe(false);
    expect(result.albums).toHaveLength(1);
  });

  it("search(artist) maps hits", async () => {
    const { provider } = makeProvider([
      {
        match: /\/search\?/,
        body: { artists: { items: [{ id: "a1", name: "X", genres: [] }] } },
      },
    ]);
    const results = await provider.search("x", "artist");
    expect(results).toEqual([
      {
        type: "artist",
        data: {
          externalId: "a1",
          value: {
            name: "X",
            genres: [],
            popularity: undefined,
            imageUrl: undefined,
            url: undefined,
          },
        },
      },
    ]);
  });

  it("search(artist) tolerates a missing artists field", async () => {
    const { provider } = makeProvider([{ match: /\/search\?/, body: {} }]);
    expect(await provider.search("x", "artist")).toEqual([]);
  });

  it("search(track) maps hits", async () => {
    const { provider } = makeProvider([
      {
        match: /\/search\?/,
        body: {
          tracks: {
            items: [{ id: "t1", name: "A", artists: [{ id: "a1", name: "X" }] }],
          },
        },
      },
    ]);
    const results = await provider.search("a", "track");
    expect(results[0]?.type).toBe("track");
  });

  it("search(track) tolerates a missing tracks field", async () => {
    const { provider } = makeProvider([{ match: /\/search\?/, body: {} }]);
    expect(await provider.search("x", "track")).toEqual([]);
  });

  it("searchByIsrc maps + tolerates empties", async () => {
    const hit = makeProvider([
      {
        match: /\/search\?/,
        body: {
          tracks: {
            items: [
              {
                id: "t1",
                name: "A",
                artists: [{ id: "a1", name: "X" }],
                external_ids: { isrc: "X" },
              },
            ],
          },
        },
      },
    ]);
    expect(await hit.provider.searchByIsrc("X")).toHaveLength(1);
    const miss = makeProvider([{ match: /\/search\?/, body: {} }]);
    expect(await miss.provider.searchByIsrc("Y")).toEqual([]);
  });

  it("getSeveralTracks chunks ids + filters market-restricted nulls", async () => {
    const cfg: SpotifyConfig = { ...DEFAULT_SPOTIFY_CONFIG, batchSize: 2 };
    const { provider, urls } = makeProvider(
      [
        {
          match: /ids=t1%2Ct2/,
          body: {
            tracks: [
              { id: "t1", name: "A", artists: [{ id: "a", name: "X" }] },
              null,
            ],
          },
        },
        {
          match: /ids=t3(&|$)/,
          body: {
            tracks: [{ id: "t3", name: "C", artists: [{ id: "a", name: "X" }] }],
          },
        },
      ],
      cfg,
    );
    const tracks = await provider.getSeveralTracks(["t1", "t2", "t3"]);
    expect(tracks.map((t) => t.externalId)).toEqual(["t1", "t3"]);
    expect(urls).toHaveLength(2);
  });

  it("getSeveralTracks returns empty for no ids", async () => {
    const { provider, urls } = makeProvider([]);
    expect(await provider.getSeveralTracks([])).toEqual([]);
    expect(urls).toHaveLength(0);
  });
});
