import { describe, expect, it } from "vitest";
import {
  mapArtistRef,
  mapDeezerAlbum,
  mapDeezerArtist,
  mapDeezerPlaylist,
  mapDeezerTrack,
} from "./mappers.js";

describe("deezer mappers", () => {
  it("mapArtistRef stringifies the id", () => {
    expect(mapArtistRef({ id: 27, name: "Daft Punk" })).toEqual({
      name: "Daft Punk",
      externalId: "27",
    });
  });

  it("mapDeezerArtist maps image + url, omitting absent", () => {
    expect(
      mapDeezerArtist({ id: 27, name: "Daft Punk", picture_xl: "https://p", link: "https://l" }),
    ).toEqual({ name: "Daft Punk", genres: [], imageUrl: "https://p", url: "https://l" });
    expect(mapDeezerArtist({ id: 28, name: "Bare" })).toEqual({
      name: "Bare",
      genres: [],
      imageUrl: undefined,
      url: undefined,
    });
  });

  it("mapDeezerTrack converts seconds→ms + handles missing artist/album/duration", () => {
    expect(
      mapDeezerTrack({
        id: 1,
        title: "One More Time",
        isrc: "GBDUW0000059",
        preview: "https://prev",
        link: "https://l",
        duration: 320,
        artist: { id: 27, name: "Daft Punk" },
        album: { id: 9, title: "Discovery", cover_xl: "https://cov" },
      }),
    ).toEqual({
      title: "One More Time",
      artists: [{ name: "Daft Punk", externalId: "27" }],
      isrc: "GBDUW0000059",
      durationMs: 320_000,
      previewUrl: "https://prev",
      coverUrl: "https://cov",
      url: "https://l",
    });
    expect(mapDeezerTrack({ id: 2, title: "Bare" })).toEqual({
      title: "Bare",
      artists: [],
      isrc: undefined,
      durationMs: undefined,
      previewUrl: undefined,
      coverUrl: undefined,
      url: undefined,
    });
  });

  it("mapDeezerAlbum handles missing artist", () => {
    expect(
      mapDeezerAlbum({ id: 9, title: "Discovery", artist: { id: 27, name: "Daft Punk" }, nb_tracks: 14 }),
    ).toMatchObject({ title: "Discovery", artists: [{ externalId: "27" }], trackCount: 14 });
    expect(mapDeezerAlbum({ id: 10, title: "Bare" }).artists).toEqual([]);
  });

  it("mapDeezerPlaylist maps creator + handles absent", () => {
    expect(
      mapDeezerPlaylist({ id: 5, title: "Top", picture_xl: "https://c", creator: { name: "Deezer" } }),
    ).toMatchObject({ title: "Top", coverUrl: "https://c", owner: "Deezer" });
    expect(mapDeezerPlaylist({ id: 6, title: "Bare" }).owner).toBeUndefined();
  });
});
