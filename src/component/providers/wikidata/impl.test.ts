import { describe, expect, it } from "vitest";
import type { FetchDeps } from "../fetch.js";
import { WikidataProvider } from "./impl.js";

interface Route {
  match: RegExp;
  body: unknown;
}

function makeProvider(routes: Route[]): WikidataProvider {
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
  return new WikidataProvider(undefined, deps);
}

describe("WikidataProvider", () => {
  it("getArtist resolves facts from claims", async () => {
    const p = makeProvider([
      {
        match: /wbgetentities/,
        body: {
          entities: {
            Q1: {
              labels: { en: { value: "Daft Punk" } },
              claims: { P31: [{ mainsnak: { datavalue: { value: { id: "Q215380" } } } }] },
            },
          },
        },
      },
    ]);
    const artist = await p.getArtist("Q1");
    expect(artist.value.name).toBe("Daft Punk");
    expect(artist.value.members).toBe("group");
  });

  it("getArtist throws for a missing entity", async () => {
    const p = makeProvider([{ match: /wbgetentities/, body: { entities: {} } }]);
    await expect(p.getArtist("Q404")).rejects.toThrow(/not found/);
  });

  it("search(artist) maps hits (label or blank) + tolerates an empty body", async () => {
    const p = makeProvider([
      {
        match: /wbsearchentities/,
        body: { search: [{ id: "Q1", label: "Daft Punk" }, { id: "Q2" }] },
      },
    ]);
    const results = await p.search("daft", "artist");
    expect(results[0]).toMatchObject({ type: "artist", data: { externalId: "Q1" } });
    expect(results[1]).toMatchObject({ data: { value: { name: "" } } });

    const empty = makeProvider([{ match: /wbsearchentities/, body: {} }]);
    expect(await empty.search("none", "artist")).toEqual([]);
  });

  it("search(track) + searchByIsrc return empty", async () => {
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
