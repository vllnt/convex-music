/**
 * Map raw Spotify responses to the component's normalized schema. Pure functions;
 * the only Spotify-specific knowledge in the adapter beyond endpoint paths.
 */

import type {
  ArtistRef,
  NormalizedAlbum,
  NormalizedArtist,
  NormalizedTrack,
} from "../../../client/types.js";
import type { NormalizedPlaylist } from "../types.js";
import type {
  SpotifyAlbum,
  SpotifyArtist,
  SpotifyArtistRef,
  SpotifyImage,
  SpotifyPlaylistResponse,
  SpotifyTrack,
} from "./types.js";

/** First image url, if any. */
function firstImage(images: SpotifyImage[] | undefined): string | undefined {
  const first = images?.[0];
  return first?.url;
}

/** Reduced track/album artist → credited artist ref. */
export function mapArtistRef(raw: SpotifyArtistRef): ArtistRef {
  return { name: raw.name, externalId: raw.id };
}

/** Full Spotify artist → normalized artist. */
export function mapArtist(raw: SpotifyArtist): NormalizedArtist {
  return {
    name: raw.name,
    genres: raw.genres ?? [],
    popularity: raw.popularity,
    imageUrl: firstImage(raw.images),
    url: raw.external_urls?.spotify,
  };
}

/** Spotify track → normalized track. ISRC lives in `external_ids` (full objects only). */
export function mapTrack(raw: SpotifyTrack): NormalizedTrack {
  return {
    title: raw.name,
    artists: raw.artists.map(mapArtistRef),
    isrc: raw.external_ids?.isrc,
    durationMs: raw.duration_ms,
    previewUrl: raw.preview_url ?? undefined,
    coverUrl: firstImage(raw.album?.images),
    url: raw.external_urls?.spotify,
    albumId: raw.album?.id,
  };
}

/** Spotify album → normalized album. */
export function mapAlbum(raw: SpotifyAlbum): NormalizedAlbum {
  return {
    title: raw.name,
    artists: (raw.artists ?? []).map(mapArtistRef),
    releaseDate: raw.release_date,
    coverUrl: firstImage(raw.images),
    url: raw.external_urls?.spotify,
    trackCount: raw.total_tracks,
  };
}

/** Spotify playlist → normalized playlist metadata (membership is separate). */
export function mapPlaylist(raw: SpotifyPlaylistResponse): NormalizedPlaylist {
  return {
    title: raw.name,
    description: raw.description ?? undefined,
    coverUrl: firstImage(raw.images),
    url: raw.external_urls?.spotify,
    owner: raw.owner?.display_name,
  };
}
