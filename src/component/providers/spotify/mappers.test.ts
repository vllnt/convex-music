import { describe, expect, it } from "vitest";
import {
  mapAlbum,
  mapArtist,
  mapArtistRef,
  mapPlaylist,
  mapTrack,
} from "./mappers.js";
import type {
  SpotifyAlbum,
  SpotifyArtist,
  SpotifyPlaylistResponse,
  SpotifyTrack,
} from "./types.js";

describe("mapArtistRef", () => {
  it("carries name + provider id", () => {
    expect(mapArtistRef({ id: "a1", name: "Daft Punk" })).toEqual({
      name: "Daft Punk",
      externalId: "a1",
    });
  });
});

describe("mapArtist", () => {
  it("maps a full artist", () => {
    const raw: SpotifyArtist = {
      id: "a1",
      name: "Daft Punk",
      genres: ["french house"],
      popularity: 82,
      images: [{ url: "https://img/1" }, { url: "https://img/2" }],
      external_urls: { spotify: "https://open.spotify.com/artist/a1" },
    };
    expect(mapArtist(raw)).toEqual({
      name: "Daft Punk",
      genres: ["french house"],
      popularity: 82,
      imageUrl: "https://img/1",
      url: "https://open.spotify.com/artist/a1",
    });
  });

  it("defaults genres + omits missing image/url", () => {
    expect(mapArtist({ id: "a2", name: "Unknown" })).toEqual({
      name: "Unknown",
      genres: [],
      popularity: undefined,
      imageUrl: undefined,
      url: undefined,
    });
  });

  it("treats an empty image array as no image", () => {
    expect(mapArtist({ id: "a3", name: "NoArt", images: [] }).imageUrl).toBe(
      undefined,
    );
  });
});

describe("mapTrack", () => {
  it("maps a full track with ISRC, preview, cover, url", () => {
    const raw: SpotifyTrack = {
      id: "t1",
      name: "One More Time",
      duration_ms: 320_000,
      preview_url: "https://preview/1",
      external_urls: { spotify: "https://open.spotify.com/track/t1" },
      external_ids: { isrc: "GBDUW0000059" },
      artists: [{ id: "a1", name: "Daft Punk" }],
      album: { id: "al1", name: "Discovery", images: [{ url: "https://cov/1" }] },
    };
    expect(mapTrack(raw)).toEqual({
      title: "One More Time",
      artists: [{ name: "Daft Punk", externalId: "a1" }],
      isrc: "GBDUW0000059",
      durationMs: 320_000,
      previewUrl: "https://preview/1",
      coverUrl: "https://cov/1",
      url: "https://open.spotify.com/track/t1",
      albumId: "al1",
    });
  });

  it("maps a reduced track (no isrc, null preview, no album)", () => {
    const raw: SpotifyTrack = {
      id: "t2",
      name: "Reduced",
      preview_url: null,
      artists: [{ id: "a1", name: "Daft Punk" }],
    };
    expect(mapTrack(raw)).toEqual({
      title: "Reduced",
      artists: [{ name: "Daft Punk", externalId: "a1" }],
      isrc: undefined,
      durationMs: undefined,
      previewUrl: undefined,
      coverUrl: undefined,
      url: undefined,
    });
  });

  it("reads ISRC from external_ids when present but empty", () => {
    const raw: SpotifyTrack = {
      id: "t3",
      name: "NoIsrcField",
      external_ids: {},
      artists: [{ id: "a1", name: "X" }],
    };
    expect(mapTrack(raw).isrc).toBe(undefined);
  });
});

describe("mapAlbum", () => {
  it("maps a full album", () => {
    const raw: SpotifyAlbum = {
      id: "al1",
      name: "Discovery",
      images: [{ url: "https://cov/1" }],
      release_date: "2001-03-12",
      external_urls: { spotify: "https://open.spotify.com/album/al1" },
      total_tracks: 14,
      artists: [{ id: "a1", name: "Daft Punk" }],
    };
    expect(mapAlbum(raw)).toEqual({
      title: "Discovery",
      artists: [{ name: "Daft Punk", externalId: "a1" }],
      releaseDate: "2001-03-12",
      coverUrl: "https://cov/1",
      url: "https://open.spotify.com/album/al1",
      trackCount: 14,
    });
  });

  it("defaults artists + omits missing fields", () => {
    expect(mapAlbum({ id: "al2", name: "Bare" })).toEqual({
      title: "Bare",
      artists: [],
      releaseDate: undefined,
      coverUrl: undefined,
      url: undefined,
      trackCount: undefined,
    });
  });
});

describe("mapPlaylist", () => {
  it("maps full playlist metadata", () => {
    const raw: SpotifyPlaylistResponse = {
      id: "p1",
      name: "Top Hits",
      description: "the best",
      images: [{ url: "https://cov/p1" }],
      external_urls: { spotify: "https://open.spotify.com/playlist/p1" },
      owner: { display_name: "Spotify" },
    };
    expect(mapPlaylist(raw)).toEqual({
      title: "Top Hits",
      description: "the best",
      coverUrl: "https://cov/p1",
      url: "https://open.spotify.com/playlist/p1",
      owner: "Spotify",
    });
  });

  it("nulls a missing description + owner", () => {
    expect(
      mapPlaylist({ id: "p2", name: "Bare", description: null }),
    ).toEqual({
      title: "Bare",
      description: undefined,
      coverUrl: undefined,
      url: undefined,
      owner: undefined,
    });
  });
});
