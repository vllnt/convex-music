/**
 * Raw Deezer API response shapes — private to the adapter. Deezer is a no-auth
 * public REST provider with previews + ISRC. Ids are numbers; durations are in
 * seconds. Only consumed fields are modeled.
 */

export interface DeezerArtistRef {
  id: number;
  name: string;
}

export interface DeezerArtist {
  id: number;
  name: string;
  picture_xl?: string;
  link?: string;
}

export interface DeezerAlbumRef {
  id: number;
  title: string;
  cover_xl?: string;
}

export interface DeezerTrack {
  id: number;
  title: string;
  isrc?: string;
  preview?: string;
  link?: string;
  duration?: number;
  artist?: DeezerArtistRef;
  album?: DeezerAlbumRef;
}

export interface DeezerAlbum {
  id: number;
  title: string;
  cover_xl?: string;
  release_date?: string;
  link?: string;
  nb_tracks?: number;
  artist?: DeezerArtistRef;
  tracks?: { data: DeezerTrack[] };
}

export interface DeezerPlaylist {
  id: number;
  title: string;
  description?: string;
  picture_xl?: string;
  link?: string;
  creator?: { name?: string };
  tracks?: { data: DeezerTrack[] };
}

export interface DeezerList<T> {
  data: T[];
}
