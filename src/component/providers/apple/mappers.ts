/**
 * Map raw Apple Music responses to the component's normalized schema. Pure
 * functions; Apple's `{w}x{h}` artwork URLs are templated to a concrete size.
 */

import type {
  ArtistRef,
  NormalizedAlbum,
  NormalizedArtist,
  NormalizedTrack,
} from "../../../client/types.js";
import type { NormalizedPlaylist } from "../types.js";
import type {
  AppleAlbum,
  AppleArtist,
  AppleArtwork,
  ApplePlaylist,
  AppleSong,
} from "./types.js";

/** Default artwork edge length when templating `{w}`/`{h}`. */
export const APPLE_ARTWORK_SIZE = 600;

/** Resolve Apple's templated artwork URL to a concrete size, if present. */
export function formatArtwork(
  artwork: AppleArtwork | undefined,
  size: number = APPLE_ARTWORK_SIZE,
): string | undefined {
  if (artwork === undefined) return undefined;
  return artwork.url
    .replace("{w}", String(size))
    .replace("{h}", String(size));
}

/** The credited artist ref for a song/album (Apple gives one primary name). */
function primaryArtistRef(
  name: string,
  relationshipArtistId: string | undefined,
): ArtistRef {
  return relationshipArtistId === undefined
    ? { name }
    : { name, externalId: relationshipArtistId };
}

/** Apple artist → normalized artist (no popularity; genres from genreNames). */
export function mapAppleArtist(raw: AppleArtist): NormalizedArtist {
  return {
    name: raw.attributes.name,
    genres: raw.attributes.genreNames ?? [],
    imageUrl: formatArtwork(raw.attributes.artwork),
    url: raw.attributes.url,
  };
}

/** Apple song → normalized track. */
export function mapAppleTrack(raw: AppleSong): NormalizedTrack {
  return {
    title: raw.attributes.name,
    artists: [
      primaryArtistRef(
        raw.attributes.artistName,
        raw.relationships?.artists?.data?.[0]?.id,
      ),
    ],
    isrc: raw.attributes.isrc,
    durationMs: raw.attributes.durationInMillis,
    previewUrl: raw.attributes.previews?.[0]?.url,
    coverUrl: formatArtwork(raw.attributes.artwork),
    url: raw.attributes.url,
  };
}

/** Apple album → normalized album. */
export function mapAppleAlbum(raw: AppleAlbum): NormalizedAlbum {
  return {
    title: raw.attributes.name,
    artists: [
      primaryArtistRef(
        raw.attributes.artistName,
        raw.relationships?.artists?.data?.[0]?.id,
      ),
    ],
    releaseDate: raw.attributes.releaseDate,
    coverUrl: formatArtwork(raw.attributes.artwork),
    url: raw.attributes.url,
    trackCount: raw.attributes.trackCount,
  };
}

/** Apple playlist → normalized playlist metadata. */
export function mapApplePlaylist(raw: ApplePlaylist): NormalizedPlaylist {
  return {
    title: raw.attributes.name,
    description: raw.attributes.description?.standard,
    coverUrl: formatArtwork(raw.attributes.artwork),
    url: raw.attributes.url,
    owner: raw.attributes.curatorName,
  };
}
