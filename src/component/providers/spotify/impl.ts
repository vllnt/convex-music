/**
 * Spotify adapter. Implements {@link MusicProvider} over the Web API. Token
 * acquisition is injected (`getToken`) so the class stays pure + testable; the
 * action layer wires it to the cached client-credentials token. Album/playlist
 * listings take the first page (bounded by `pageLimit`); deep pagination is a
 * follow-up (`read-through-fetch` / catalog import enrich ISRC separately).
 */

import {
  DEFAULT_RETRY_CONFIG,
  type FetchDeps,
  type RetryConfig,
  defaultFetchDeps,
  fetchJson,
  mapWithConcurrency,
} from "../fetch.js";
import type {
  ArtistAlbumsResult,
  MusicProvider,
  ProviderAlbum,
  ProviderArtist,
  ProviderPlaylist,
  ProviderSearchResult,
  ProviderTrack,
} from "../types.js";
import { SPOTIFY_API_BASE } from "./client.js";
import { mapAlbum, mapArtist, mapPlaylist, mapTrack } from "./mappers.js";
import type {
  SpotifyAlbumDetail,
  SpotifyArtist,
  SpotifyPagedAlbums,
  SpotifyPlaylistResponse,
  SpotifySearchResponse,
  SpotifySeveralTracksResponse,
  SpotifyTopTracksResponse,
  SpotifyTrack,
} from "./types.js";

/** Tunable Spotify limits (songtrivia-derived defaults; all overridable). */
export interface SpotifyConfig {
  /** Market for catalog availability + previews. */
  market: string;
  /** Retry/timeout policy for each call. */
  retry: RetryConfig;
  /** Max results per free-text search. */
  searchLimit: number;
  /** Max results per ISRC search. */
  isrcSearchLimit: number;
  /** Ids per batch `GET /tracks` request. */
  batchSize: number;
  /** Cap on albums fetched per artist. */
  maxAlbumsPerArtist: number;
  /** Page size for album/playlist/artist-album listings. */
  pageLimit: number;
  /** Concurrent album fetches per artist. */
  albumConcurrency: number;
  /** `include_groups` filter for artist albums. */
  albumGroups: string;
}

/** Default Spotify limits. */
export const DEFAULT_SPOTIFY_CONFIG: SpotifyConfig = {
  market: "US",
  retry: DEFAULT_RETRY_CONFIG,
  searchLimit: 10,
  isrcSearchLimit: 5,
  batchSize: 50,
  maxAlbumsPerArtist: 30,
  pageLimit: 50,
  albumConcurrency: 5,
  albumGroups: "album,single",
};

export class SpotifyProvider implements MusicProvider {
  readonly id = "spotify" as const;

  constructor(
    private readonly getToken: () => Promise<string>,
    private readonly cfg: SpotifyConfig = DEFAULT_SPOTIFY_CONFIG,
    private readonly deps: FetchDeps = defaultFetchDeps,
  ) {}

  private async api<T>(
    path: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const token = await this.getToken();
    const url = new URL(SPOTIFY_API_BASE + path);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return fetchJson<T>(
      "spotify",
      url.toString(),
      { headers: { Authorization: `Bearer ${token}` } },
      this.cfg.retry,
      this.deps,
    );
  }

  private toTrack(raw: SpotifyTrack): ProviderTrack {
    return { externalId: raw.id, value: mapTrack(raw) };
  }

  async getArtist(externalId: string): Promise<ProviderArtist> {
    const raw = await this.api<SpotifyArtist>(`/artists/${externalId}`);
    return { externalId: raw.id, value: mapArtist(raw) };
  }

  async getTrack(externalId: string): Promise<ProviderTrack> {
    const raw = await this.api<SpotifyTrack>(`/tracks/${externalId}`, {
      market: this.cfg.market,
    });
    return this.toTrack(raw);
  }

  async getAlbum(externalId: string): Promise<ProviderAlbum> {
    const raw = await this.api<SpotifyAlbumDetail>(`/albums/${externalId}`, {
      market: this.cfg.market,
      limit: String(this.cfg.pageLimit),
    });
    const items = raw.tracks?.items ?? [];
    return {
      externalId: raw.id,
      value: mapAlbum(raw),
      tracks: items.map((track) => this.toTrack(track)),
    };
  }

  async getPlaylist(externalId: string): Promise<ProviderPlaylist> {
    const raw = await this.api<SpotifyPlaylistResponse>(
      `/playlists/${externalId}`,
      { market: this.cfg.market },
    );
    const tracks: ProviderTrack[] = [];
    for (const item of raw.tracks?.items ?? []) {
      if (item.track !== null) tracks.push(this.toTrack(item.track));
    }
    return { externalId: raw.id, value: mapPlaylist(raw), tracks };
  }

  async getArtistTopTracks(externalId: string): Promise<ProviderTrack[]> {
    const raw = await this.api<SpotifyTopTracksResponse>(
      `/artists/${externalId}/top-tracks`,
      { market: this.cfg.market },
    );
    return raw.tracks.map((track) => this.toTrack(track));
  }

  async getArtistAlbums(externalId: string): Promise<ArtistAlbumsResult> {
    const raw = await this.api<SpotifyPagedAlbums>(
      `/artists/${externalId}/albums`,
      {
        market: this.cfg.market,
        limit: String(this.cfg.pageLimit),
        include_groups: this.cfg.albumGroups,
      },
    );
    const isPartial = raw.total > this.cfg.maxAlbumsPerArtist;
    const slice = raw.items.slice(0, this.cfg.maxAlbumsPerArtist);
    const albums = await mapWithConcurrency(
      slice,
      this.cfg.albumConcurrency,
      (album) => this.getAlbum(album.id),
    );
    return { albums, isPartial };
  }

  async search(
    query: string,
    type: "artist" | "track",
  ): Promise<ProviderSearchResult[]> {
    const raw = await this.api<SpotifySearchResponse>("/search", {
      q: query,
      type,
      limit: String(this.cfg.searchLimit),
      market: this.cfg.market,
    });
    if (type === "artist") {
      return (raw.artists?.items ?? []).map(
        (artist): ProviderSearchResult => ({
          type: "artist",
          data: { externalId: artist.id, value: mapArtist(artist) },
        }),
      );
    }
    return (raw.tracks?.items ?? []).map(
      (track): ProviderSearchResult => ({
        type: "track",
        data: this.toTrack(track),
      }),
    );
  }

  async searchByIsrc(isrc: string): Promise<ProviderTrack[]> {
    const raw = await this.api<SpotifySearchResponse>("/search", {
      q: `isrc:${isrc}`,
      type: "track",
      limit: String(this.cfg.isrcSearchLimit),
      market: this.cfg.market,
    });
    return (raw.tracks?.items ?? []).map((track) => this.toTrack(track));
  }

  async getSeveralTracks(externalIds: string[]): Promise<ProviderTrack[]> {
    const chunks: string[][] = [];
    for (let i = 0; i < externalIds.length; i += this.cfg.batchSize) {
      chunks.push(externalIds.slice(i, i + this.cfg.batchSize));
    }
    const pages = await mapWithConcurrency(
      chunks,
      this.cfg.albumConcurrency,
      (chunk) =>
        this.api<SpotifySeveralTracksResponse>("/tracks", {
          ids: chunk.join(","),
          market: this.cfg.market,
        }),
    );
    const out: ProviderTrack[] = [];
    for (const page of pages) {
      for (const track of page.tracks) {
        if (track !== null) out.push(this.toTrack(track));
      }
    }
    return out;
  }
}
