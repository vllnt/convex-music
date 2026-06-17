/**
 * Raw Spotify Web API response shapes — private to the Spotify adapter. Only the
 * fields the mappers consume are modeled; the public contract is the normalized
 * schema, never these.
 */

export interface SpotifyImage {
  url: string;
  height?: number | null;
  width?: number | null;
}

export interface SpotifyExternalUrls {
  spotify?: string;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres?: string[];
  popularity?: number;
  images?: SpotifyImage[];
  external_urls?: SpotifyExternalUrls;
}

/** The reduced artist object embedded in a track/album. */
export interface SpotifyArtistRef {
  id: string;
  name: string;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images?: SpotifyImage[];
  release_date?: string;
  external_urls?: SpotifyExternalUrls;
  total_tracks?: number;
  artists?: SpotifyArtistRef[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms?: number;
  preview_url?: string | null;
  external_urls?: SpotifyExternalUrls;
  external_ids?: { isrc?: string };
  artists: SpotifyArtistRef[];
  album?: SpotifyAlbum;
}

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface SpotifySearchResponse {
  artists?: { items: SpotifyArtist[] };
  tracks?: { items: SpotifyTrack[] };
}

export interface SpotifySeveralTracksResponse {
  tracks: Array<SpotifyTrack | null>;
}

export interface SpotifyTopTracksResponse {
  tracks: SpotifyTrack[];
}

export interface SpotifyPagedAlbums {
  items: SpotifyAlbum[];
  total: number;
  next?: string | null;
}

export interface SpotifyPagedTracks {
  items: SpotifyTrack[];
  total: number;
  next?: string | null;
}

export interface SpotifyAlbumDetail extends SpotifyAlbum {
  tracks?: SpotifyPagedTracks;
}

export interface SpotifyPlaylistItem {
  track: SpotifyTrack | null;
}

export interface SpotifyPlaylistResponse {
  id: string;
  name: string;
  description?: string | null;
  images?: SpotifyImage[];
  external_urls?: SpotifyExternalUrls;
  owner?: { display_name?: string };
  tracks?: { items: SpotifyPlaylistItem[] };
}
