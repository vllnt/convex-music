import { describe, expect, it } from "vitest";
import {
  APPLE_ARTWORK_SIZE,
  formatArtwork,
  mapAppleAlbum,
  mapAppleArtist,
  mapApplePlaylist,
  mapAppleTrack,
} from "./mappers.js";
import type {
  AppleAlbum,
  AppleArtist,
  ApplePlaylist,
  AppleSong,
} from "./types.js";

describe("formatArtwork", () => {
  it("templates {w}x{h} at the default size", () => {
    expect(
      formatArtwork({ url: "https://a/{w}x{h}.jpg", width: 3000, height: 3000 }),
    ).toBe(`https://a/${APPLE_ARTWORK_SIZE}x${APPLE_ARTWORK_SIZE}.jpg`);
  });

  it("templates at a custom size", () => {
    expect(formatArtwork({ url: "https://a/{w}x{h}.jpg" }, 100)).toBe(
      "https://a/100x100.jpg",
    );
  });

  it("returns undefined when absent", () => {
    expect(formatArtwork(undefined)).toBe(undefined);
  });
});

describe("mapAppleArtist", () => {
  it("maps a full artist", () => {
    const raw: AppleArtist = {
      id: "a1",
      type: "artists",
      attributes: {
        name: "Daft Punk",
        genreNames: ["Electronic"],
        url: "https://music.apple.com/artist/a1",
        artwork: { url: "https://art/{w}x{h}.jpg" },
      },
    };
    expect(mapAppleArtist(raw)).toEqual({
      name: "Daft Punk",
      genres: ["Electronic"],
      imageUrl: "https://art/600x600.jpg",
      url: "https://music.apple.com/artist/a1",
    });
  });

  it("defaults genres + omits missing fields", () => {
    expect(
      mapAppleArtist({ id: "a2", type: "artists", attributes: { name: "X" } }),
    ).toEqual({ name: "X", genres: [], imageUrl: undefined, url: undefined });
  });
});

describe("mapAppleTrack", () => {
  it("maps a full song with relationship artist id", () => {
    const raw: AppleSong = {
      id: "s1",
      type: "songs",
      attributes: {
        name: "One More Time",
        isrc: "GBDUW0000059",
        artistName: "Daft Punk",
        durationInMillis: 320_000,
        artwork: { url: "https://art/{w}x{h}.jpg" },
        url: "https://music.apple.com/song/s1",
        previews: [{ url: "https://preview/1" }],
      },
      relationships: { artists: { data: [{ id: "a1" }] } },
    };
    expect(mapAppleTrack(raw)).toEqual({
      title: "One More Time",
      artists: [{ name: "Daft Punk", externalId: "a1" }],
      isrc: "GBDUW0000059",
      durationMs: 320_000,
      previewUrl: "https://preview/1",
      coverUrl: "https://art/600x600.jpg",
      url: "https://music.apple.com/song/s1",
    });
  });

  it("maps a song with no relationship + no previews", () => {
    const raw: AppleSong = {
      id: "s2",
      type: "songs",
      attributes: { name: "Bare", artistName: "Solo" },
    };
    expect(mapAppleTrack(raw)).toEqual({
      title: "Bare",
      artists: [{ name: "Solo" }],
      isrc: undefined,
      durationMs: undefined,
      previewUrl: undefined,
      coverUrl: undefined,
      url: undefined,
    });
  });
});

describe("mapAppleAlbum", () => {
  it("maps a full album", () => {
    const raw: AppleAlbum = {
      id: "al1",
      type: "albums",
      attributes: {
        name: "Discovery",
        artistName: "Daft Punk",
        releaseDate: "2001-03-12",
        trackCount: 14,
        artwork: { url: "https://art/{w}x{h}.jpg" },
        url: "https://music.apple.com/album/al1",
      },
      relationships: { artists: { data: [{ id: "a1" }] } },
    };
    expect(mapAppleAlbum(raw)).toEqual({
      title: "Discovery",
      artists: [{ name: "Daft Punk", externalId: "a1" }],
      releaseDate: "2001-03-12",
      coverUrl: "https://art/600x600.jpg",
      url: "https://music.apple.com/album/al1",
      trackCount: 14,
    });
  });

  it("maps a bare album", () => {
    expect(
      mapAppleAlbum({
        id: "al2",
        type: "albums",
        attributes: { name: "Bare", artistName: "Solo" },
      }),
    ).toEqual({
      title: "Bare",
      artists: [{ name: "Solo" }],
      releaseDate: undefined,
      coverUrl: undefined,
      url: undefined,
      trackCount: undefined,
    });
  });
});

describe("mapApplePlaylist", () => {
  it("maps a full playlist", () => {
    const raw: ApplePlaylist = {
      id: "p1",
      type: "playlists",
      attributes: {
        name: "Top",
        description: { standard: "the best" },
        curatorName: "Apple Music",
        artwork: { url: "https://art/{w}x{h}.jpg" },
        url: "https://music.apple.com/playlist/p1",
      },
    };
    expect(mapApplePlaylist(raw)).toEqual({
      title: "Top",
      description: "the best",
      coverUrl: "https://art/600x600.jpg",
      url: "https://music.apple.com/playlist/p1",
      owner: "Apple Music",
    });
  });

  it("maps a bare playlist", () => {
    expect(
      mapApplePlaylist({
        id: "p2",
        type: "playlists",
        attributes: { name: "Bare" },
      }),
    ).toEqual({
      title: "Bare",
      description: undefined,
      coverUrl: undefined,
      url: undefined,
      owner: undefined,
    });
  });
});
