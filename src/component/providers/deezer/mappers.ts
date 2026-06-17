/**
 * Map raw Deezer responses to the normalized schema. Deezer durations are in
 * seconds (→ ms); ids are numbers (→ string external ids).
 */

import type {
  ArtistRef,
  NormalizedAlbum,
  NormalizedArtist,
  NormalizedTrack,
} from "../../../client/types.js";
import type { NormalizedPlaylist } from "../types.js";
import type {
  DeezerAlbum,
  DeezerArtist,
  DeezerArtistRef,
  DeezerPlaylist,
  DeezerTrack,
} from "./types.js";

/** Deezer artist ref → credited artist. */
export function mapArtistRef(raw: DeezerArtistRef): ArtistRef {
  return { name: raw.name, externalId: String(raw.id) };
}

/** Deezer artist → normalized artist (no popularity; Deezer has fan-count, not 0–100). */
export function mapDeezerArtist(raw: DeezerArtist): NormalizedArtist {
  return {
    name: raw.name,
    genres: [],
    imageUrl: raw.picture_xl,
    url: raw.link,
  };
}

/** Deezer track → normalized track. */
export function mapDeezerTrack(raw: DeezerTrack): NormalizedTrack {
  return {
    title: raw.title,
    artists: raw.artist === undefined ? [] : [mapArtistRef(raw.artist)],
    isrc: raw.isrc,
    durationMs: raw.duration === undefined ? undefined : raw.duration * 1000,
    previewUrl: raw.preview,
    coverUrl: raw.album?.cover_xl,
    url: raw.link,
  };
}

/** Deezer album → normalized album. */
export function mapDeezerAlbum(raw: DeezerAlbum): NormalizedAlbum {
  return {
    title: raw.title,
    artists: raw.artist === undefined ? [] : [mapArtistRef(raw.artist)],
    releaseDate: raw.release_date,
    coverUrl: raw.cover_xl,
    url: raw.link,
    trackCount: raw.nb_tracks,
  };
}

/** Deezer playlist → normalized playlist metadata. */
export function mapDeezerPlaylist(raw: DeezerPlaylist): NormalizedPlaylist {
  return {
    title: raw.title,
    description: raw.description,
    coverUrl: raw.picture_xl,
    url: raw.link,
    owner: raw.creator?.name,
  };
}
