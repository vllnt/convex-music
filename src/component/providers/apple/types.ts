/**
 * Raw Apple Music API response shapes — private to the Apple adapter. Apple wraps
 * resources as `{ data: [{ id, type, attributes, relationships }] }`; only the
 * consumed fields are modeled. The public contract is the normalized schema.
 */

export interface AppleArtwork {
  url: string;
  width?: number;
  height?: number;
}

export interface AppleArtistRelationship {
  data?: Array<{ id: string }>;
}

export interface AppleArtistAttributes {
  name: string;
  genreNames?: string[];
  url?: string;
  artwork?: AppleArtwork;
}

export interface AppleSongAttributes {
  name: string;
  isrc?: string;
  artistName: string;
  durationInMillis?: number;
  artwork?: AppleArtwork;
  url?: string;
  previews?: Array<{ url: string }>;
}

export interface AppleAlbumAttributes {
  name: string;
  artistName: string;
  releaseDate?: string;
  trackCount?: number;
  artwork?: AppleArtwork;
  url?: string;
}

export interface ApplePlaylistAttributes {
  name: string;
  description?: { standard?: string };
  curatorName?: string;
  artwork?: AppleArtwork;
  url?: string;
}

export interface AppleResource<A> {
  id: string;
  type: string;
  attributes: A;
  relationships?: {
    artists?: AppleArtistRelationship;
    tracks?: { data?: Array<AppleResource<AppleSongAttributes>> };
  };
}

export type AppleArtist = AppleResource<AppleArtistAttributes>;
export type AppleSong = AppleResource<AppleSongAttributes>;
export type AppleAlbum = AppleResource<AppleAlbumAttributes>;
export type ApplePlaylist = AppleResource<ApplePlaylistAttributes>;

export interface AppleDataResponse<T> {
  data: T[];
  next?: string;
}

export interface AppleSearchResponse {
  results?: {
    artists?: { data: AppleArtist[] };
    songs?: { data: AppleSong[] };
  };
}
