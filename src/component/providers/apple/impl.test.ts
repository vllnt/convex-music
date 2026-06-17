import { describe, expect, it } from "vitest";
import type { FetchDeps } from "../fetch.js";
import { AppleProvider, type AppleConfig, DEFAULT_APPLE_CONFIG } from "./impl.js";

interface Route {
  match: RegExp;
  body: unknown;
  status?: number;
}

function harness(routes: Route[]): { deps: FetchDeps; urls: string[] } {
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
  cfg: AppleConfig = DEFAULT_APPLE_CONFIG,
): { provider: AppleProvider; urls: string[] } {
  const { deps, urls } = harness(routes);
  return {
    provider: new AppleProvider(() => Promise.resolve("jwt"), cfg, deps),
    urls,
  };
}

function song(id: string, isrc?: string): unknown {
  return {
    id,
    type: "songs",
    attributes: { name: `song-${id}`, artistName: "X", isrc },
  };
}

describe("AppleProvider", () => {
  it("getArtist unwraps data[0]", async () => {
    const { provider, urls } = makeProvider([
      {
        match: /\/catalog\/us\/artists\/a1$/,
        body: {
          data: [{ id: "a1", type: "artists", attributes: { name: "Daft Punk" } }],
        },
      },
    ]);
    const result = await provider.getArtist("a1");
    expect(result.value.name).toBe("Daft Punk");
    expect(urls[0]).toBe("https://api.music.apple.com/v1/catalog/us/artists/a1");
  });

  it("getArtist throws when the entity is missing", async () => {
    const { provider } = makeProvider([
      { match: /\/artists\/missing$/, body: { data: [] } },
    ]);
    await expect(provider.getArtist("missing")).rejects.toThrow(
      'apple: artist "missing" not found',
    );
  });

  it("getTrack maps the song", async () => {
    const { provider } = makeProvider([
      { match: /\/songs\/s1$/, body: { data: [song("s1", "ISRC1")] } },
    ]);
    expect((await provider.getTrack("s1")).value.isrc).toBe("ISRC1");
  });

  it("getAlbum maps inline tracks", async () => {
    const { provider, urls } = makeProvider([
      {
        match: /\/albums\/al1\?/,
        body: {
          data: [
            {
              id: "al1",
              type: "albums",
              attributes: { name: "Discovery", artistName: "Daft Punk" },
              relationships: { tracks: { data: [song("t1"), song("t2")] } },
            },
          ],
        },
      },
    ]);
    const album = await provider.getAlbum("al1");
    expect(album.tracks.map((t) => t.externalId)).toEqual(["t1", "t2"]);
    expect(urls[0]).toContain("include=tracks");
  });

  it("getAlbum tolerates no relationships", async () => {
    const { provider } = makeProvider([
      {
        match: /\/albums\/al2\?/,
        body: {
          data: [
            { id: "al2", type: "albums", attributes: { name: "X", artistName: "Y" } },
          ],
        },
      },
    ]);
    expect((await provider.getAlbum("al2")).tracks).toEqual([]);
  });

  it("getPlaylist maps metadata + inline tracks", async () => {
    const { provider } = makeProvider([
      {
        match: /\/playlists\/p1\?/,
        body: {
          data: [
            {
              id: "p1",
              type: "playlists",
              attributes: { name: "Top", curatorName: "Apple" },
              relationships: { tracks: { data: [song("t1")] } },
            },
          ],
        },
      },
    ]);
    const playlist = await provider.getPlaylist("p1");
    expect(playlist.value.owner).toBe("Apple");
    expect(playlist.tracks).toHaveLength(1);
  });

  it("getPlaylist tolerates no tracks relationship", async () => {
    const { provider } = makeProvider([
      {
        match: /\/playlists\/p2\?/,
        body: {
          data: [{ id: "p2", type: "playlists", attributes: { name: "Bare" } }],
        },
      },
    ]);
    expect((await provider.getPlaylist("p2")).tracks).toEqual([]);
  });

  it("getArtistTopTracks maps every song", async () => {
    const { provider } = makeProvider([
      {
        match: /\/artists\/a1\/view\/top-songs$/,
        body: { data: [song("t1"), song("t2")] },
      },
    ]);
    expect(await provider.getArtistTopTracks("a1")).toHaveLength(2);
  });

  it("getArtistAlbums flags partial when a next page exists", async () => {
    const cfg: AppleConfig = { ...DEFAULT_APPLE_CONFIG, maxAlbumsPerArtist: 1 };
    const { provider } = makeProvider(
      [
        {
          match: /\/artists\/a1\/albums\?/,
          body: {
            next: "/v1/catalog/us/artists/a1/albums?offset=30",
            data: [
              {
                id: "al1",
                type: "albums",
                attributes: { name: "One", artistName: "X" },
                relationships: { tracks: { data: [song("t1")] } },
              },
              {
                id: "al2",
                type: "albums",
                attributes: { name: "Two", artistName: "X" },
              },
            ],
          },
        },
      ],
      cfg,
    );
    const result = await provider.getArtistAlbums("a1");
    expect(result.isPartial).toBe(true);
    expect(result.albums).toHaveLength(1);
    expect(result.albums[0]?.tracks).toHaveLength(1);
  });

  it("getArtistAlbums is complete with no next page", async () => {
    const { provider } = makeProvider([
      {
        match: /\/artists\/a2\/albums\?/,
        body: {
          data: [
            { id: "al9", type: "albums", attributes: { name: "Solo", artistName: "X" } },
          ],
        },
      },
    ]);
    expect((await provider.getArtistAlbums("a2")).isPartial).toBe(false);
  });

  it("search(artist) maps + tolerates missing results", async () => {
    const hit = makeProvider([
      {
        match: /\/search\?/,
        body: {
          results: {
            artists: {
              data: [{ id: "a1", type: "artists", attributes: { name: "X" } }],
            },
          },
        },
      },
    ]);
    const results = await hit.provider.search("x", "artist");
    expect(results[0]?.type).toBe("artist");
    const miss = makeProvider([{ match: /\/search\?/, body: {} }]);
    expect(await miss.provider.search("x", "artist")).toEqual([]);
  });

  it("search(track) maps + tolerates missing results", async () => {
    const hit = makeProvider([
      {
        match: /\/search\?/,
        body: { results: { songs: { data: [song("t1")] } } },
      },
    ]);
    expect((await hit.provider.search("a", "track"))[0]?.type).toBe("track");
    const miss = makeProvider([{ match: /\/search\?/, body: {} }]);
    expect(await miss.provider.search("a", "track")).toEqual([]);
  });

  it("searchByIsrc filters by isrc", async () => {
    const { provider, urls } = makeProvider([
      { match: /\/songs\?/, body: { data: [song("t1", "ISRC9")] } },
    ]);
    expect(await provider.searchByIsrc("ISRC9")).toHaveLength(1);
    expect(urls[0]).toContain("filter%5Bisrc%5D=ISRC9");
  });

  it("getSeveralTracks chunks ids", async () => {
    const cfg: AppleConfig = { ...DEFAULT_APPLE_CONFIG, batchSize: 2 };
    const { provider, urls } = makeProvider(
      [
        { match: /ids=t1%2Ct2/, body: { data: [song("t1"), song("t2")] } },
        { match: /ids=t3(&|$)/, body: { data: [song("t3")] } },
      ],
      cfg,
    );
    const tracks = await provider.getSeveralTracks(["t1", "t2", "t3"]);
    expect(tracks.map((t) => t.externalId)).toEqual(["t1", "t2", "t3"]);
    expect(urls).toHaveLength(2);
  });

  it("getSeveralTracks returns empty for no ids", async () => {
    const { provider, urls } = makeProvider([]);
    expect(await provider.getSeveralTracks([])).toEqual([]);
    expect(urls).toHaveLength(0);
  });
});
