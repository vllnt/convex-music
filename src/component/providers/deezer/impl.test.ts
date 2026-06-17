import { describe, expect, it } from "vitest";
import type { FetchDeps } from "../fetch.js";
import { DEFAULT_DEEZER_CONFIG, DeezerProvider } from "./impl.js";

interface Route {
  match: RegExp;
  body: unknown;
}

function makeProvider(routes: Route[]): DeezerProvider {
  const deps: FetchDeps = {
    fetch: (url) => {
      const route = routes.find((r) => r.match.test(url));
      return Promise.resolve(
        new Response(JSON.stringify(route?.body ?? {}), {
          status: route === undefined ? 404 : 200,
          headers: { "content-type": "application/json" },
        }),
      );
    },
    sleep: () => Promise.resolve(),
    random: () => 0,
  };
  return new DeezerProvider(DEFAULT_DEEZER_CONFIG, deps);
}

const track = (id: number, isrc?: string) => ({
  id,
  title: `t${id}`,
  isrc,
  artist: { id: 27, name: "Daft Punk" },
  duration: 100,
});

describe("DeezerProvider", () => {
  it("getArtist / getTrack", async () => {
    const p = makeProvider([
      { match: /\/artist\/27$/, body: { id: 27, name: "Daft Punk" } },
      { match: /\/track\/1$/, body: track(1, "GBDUW0000059") },
    ]);
    expect((await p.getArtist("27")).value.name).toBe("Daft Punk");
    expect((await p.getTrack("1")).value.isrc).toBe("GBDUW0000059");
  });

  it("getAlbum + getPlaylist inline their tracks", async () => {
    const p = makeProvider([
      { match: /\/album\/9$/, body: { id: 9, title: "Discovery", tracks: { data: [track(1), track(2)] } } },
      { match: /\/playlist\/5$/, body: { id: 5, title: "PL", tracks: { data: [track(1)] } } },
    ]);
    expect((await p.getAlbum("9")).tracks).toHaveLength(2);
    expect((await p.getPlaylist("5")).tracks).toHaveLength(1);
  });

  it("getPlaylist + getAlbum tolerate no tracks", async () => {
    const p = makeProvider([
      { match: /\/playlist\/6$/, body: { id: 6, title: "Empty" } },
      { match: /\/album\/8$/, body: { id: 8, title: "NoTracks" } },
    ]);
    expect((await p.getPlaylist("6")).tracks).toEqual([]);
    expect((await p.getAlbum("8")).tracks).toEqual([]);
  });

  it("getArtistTopTracks", async () => {
    const p = makeProvider([
      { match: /\/artist\/27\/top/, body: { data: [track(1), track(2)] } },
    ]);
    expect(await p.getArtistTopTracks("27")).toHaveLength(2);
  });

  it("getArtistAlbums flags partial on next + fetches album tracks", async () => {
    const p = makeProvider([
      {
        match: /\/artist\/27\/albums/,
        body: { data: [{ id: 9, title: "Discovery" }], next: "https://more" },
      },
      { match: /\/album\/9$/, body: { id: 9, title: "Discovery", tracks: { data: [track(1)] } } },
    ]);
    const result = await p.getArtistAlbums("27");
    expect(result.isPartial).toBe(true);
    expect(result.albums[0]?.tracks).toHaveLength(1);
  });

  it("getArtistAlbums is complete with no next", async () => {
    const p = makeProvider([
      { match: /\/artist\/28\/albums/, body: { data: [] } },
    ]);
    expect((await p.getArtistAlbums("28")).isPartial).toBe(false);
  });

  it("search(artist) + search(track)", async () => {
    const p = makeProvider([
      { match: /\/search\/artist/, body: { data: [{ id: 27, name: "Daft Punk" }] } },
      { match: /\/search\/track/, body: { data: [track(1)] } },
    ]);
    expect((await p.search("daft", "artist"))[0]?.type).toBe("artist");
    expect((await p.search("one", "track"))[0]?.type).toBe("track");
  });

  it("searchByIsrc returns the track, or [] on a Deezer error", async () => {
    const hit = makeProvider([
      { match: /\/track\/isrc:GBDUW0000059/, body: track(1, "GBDUW0000059") },
    ]);
    expect(await hit.searchByIsrc("GBDUW0000059")).toHaveLength(1);
    const miss = makeProvider([
      { match: /\/track\/isrc:NONE/, body: { error: { type: "DataException" } } },
    ]);
    expect(await miss.searchByIsrc("NONE")).toEqual([]);
  });
});
