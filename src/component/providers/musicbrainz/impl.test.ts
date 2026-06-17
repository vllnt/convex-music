import { describe, expect, it } from "vitest";
import type { FetchDeps } from "../fetch.js";
import { MusicBrainzProvider } from "./impl.js";

interface Route {
  match: RegExp;
  body: unknown;
}

function makeProvider(routes: Route[]): MusicBrainzProvider {
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
  return new MusicBrainzProvider(undefined, deps);
}

describe("MusicBrainzProvider", () => {
  it("getArtist maps facts", async () => {
    const p = makeProvider([
      {
        match: /\/artist\/mb1\?/,
        body: {
          id: "mb1",
          name: "Daft Punk",
          country: "FR",
          type: "Group",
          "life-span": { begin: "1993" },
        },
      },
    ]);
    const artist = await p.getArtist("mb1");
    expect(artist.externalId).toBe("mb1");
    expect(artist.value.country).toBe("FR");
    expect(artist.value.members).toBe("group");
    expect(artist.value.debutYear).toBe(1993);
  });

  it("search(artist) maps hits + tolerates an empty body", async () => {
    const hit = makeProvider([
      {
        match: /\/artist\?.*query=daft/,
        body: { artists: [{ id: "mb1", name: "Daft Punk", country: "FR" }] },
      },
    ]);
    const results = await hit.search("daft", "artist");
    expect(results[0]).toMatchObject({
      type: "artist",
      data: { externalId: "mb1" },
    });

    const empty = makeProvider([{ match: /\/artist\?/, body: {} }]);
    expect(await empty.search("none", "artist")).toEqual([]);
  });

  it("search(track) + searchByIsrc return empty (facts-only)", async () => {
    const p = makeProvider([]);
    expect(await p.search("x", "track")).toEqual([]);
    expect(await p.searchByIsrc()).toEqual([]);
  });

  it("rejects the track/album/playlist methods it does not serve", async () => {
    const p = makeProvider([]);
    await expect(p.getTrack()).rejects.toThrow(/not supported/);
    await expect(p.getAlbum()).rejects.toThrow(/not supported/);
    await expect(p.getPlaylist()).rejects.toThrow(/not supported/);
    await expect(p.getArtistTopTracks()).rejects.toThrow(/not supported/);
    await expect(p.getArtistAlbums()).rejects.toThrow(/not supported/);
  });
});
