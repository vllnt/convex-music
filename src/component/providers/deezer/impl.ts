/**
 * Deezer adapter — a no-auth, full music provider (previews + ISRC). Requests
 * carry no bearer token. Ids are numbers (→ string external ids); the album/
 * playlist endpoints inline their track list; artist albums fan out to per-album
 * track fetches (bounded concurrency), like Spotify.
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
import {
  mapDeezerAlbum,
  mapDeezerArtist,
  mapDeezerPlaylist,
  mapDeezerTrack,
} from "./mappers.js";
import type {
  DeezerAlbum,
  DeezerArtist,
  DeezerList,
  DeezerPlaylist,
  DeezerTrack,
} from "./types.js";

/** Tunable Deezer settings. */
export interface DeezerConfig {
  baseUrl: string;
  retry: RetryConfig;
  searchLimit: number;
  topLimit: number;
  maxAlbumsPerArtist: number;
  albumConcurrency: number;
}

/** Default Deezer settings. */
export const DEFAULT_DEEZER_CONFIG: DeezerConfig = {
  baseUrl: "https://api.deezer.com",
  retry: DEFAULT_RETRY_CONFIG,
  searchLimit: 10,
  topLimit: 25,
  maxAlbumsPerArtist: 30,
  albumConcurrency: 5,
};

export class DeezerProvider implements MusicProvider {
  readonly id = "deezer" as const;

  constructor(
    private readonly cfg: DeezerConfig = DEFAULT_DEEZER_CONFIG,
    private readonly deps: FetchDeps = defaultFetchDeps,
  ) {}

  private async api<T>(
    path: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const url = new URL(this.cfg.baseUrl + path);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return fetchJson<T>("deezer", url.toString(), {}, this.cfg.retry, this.deps);
  }

  private toTrack(raw: DeezerTrack): ProviderTrack {
    return { externalId: String(raw.id), value: mapDeezerTrack(raw) };
  }

  private toAlbum(raw: DeezerAlbum): ProviderAlbum {
    return {
      externalId: String(raw.id),
      value: mapDeezerAlbum(raw),
      tracks: (raw.tracks?.data ?? []).map((track) => this.toTrack(track)),
    };
  }

  async getArtist(externalId: string): Promise<ProviderArtist> {
    const raw = await this.api<DeezerArtist>(
      `/artist/${encodeURIComponent(externalId)}`,
    );
    return { externalId: String(raw.id), value: mapDeezerArtist(raw) };
  }

  async getTrack(externalId: string): Promise<ProviderTrack> {
    return this.toTrack(
      await this.api<DeezerTrack>(`/track/${encodeURIComponent(externalId)}`),
    );
  }

  async getAlbum(externalId: string): Promise<ProviderAlbum> {
    return this.toAlbum(
      await this.api<DeezerAlbum>(`/album/${encodeURIComponent(externalId)}`),
    );
  }

  async getPlaylist(externalId: string): Promise<ProviderPlaylist> {
    const raw = await this.api<DeezerPlaylist>(
      `/playlist/${encodeURIComponent(externalId)}`,
    );
    return {
      externalId: String(raw.id),
      value: mapDeezerPlaylist(raw),
      tracks: (raw.tracks?.data ?? []).map((track) => this.toTrack(track)),
    };
  }

  async getArtistTopTracks(externalId: string): Promise<ProviderTrack[]> {
    const res = await this.api<DeezerList<DeezerTrack>>(
      `/artist/${encodeURIComponent(externalId)}/top`,
      { limit: String(this.cfg.topLimit) },
    );
    return res.data.map((track) => this.toTrack(track));
  }

  async getArtistAlbums(externalId: string): Promise<ArtistAlbumsResult> {
    const res = await this.api<DeezerList<DeezerAlbum> & { next?: string }>(
      `/artist/${encodeURIComponent(externalId)}/albums`,
      { limit: String(this.cfg.maxAlbumsPerArtist) },
    );
    const isPartial = res.next !== undefined;
    const slice = res.data.slice(0, this.cfg.maxAlbumsPerArtist);
    const albums = await mapWithConcurrency(
      slice,
      this.cfg.albumConcurrency,
      (album) => this.getAlbum(String(album.id)),
    );
    return { albums, isPartial };
  }

  async search(
    query: string,
    type: "artist" | "track",
  ): Promise<ProviderSearchResult[]> {
    if (type === "artist") {
      const res = await this.api<DeezerList<DeezerArtist>>("/search/artist", {
        q: query,
        limit: String(this.cfg.searchLimit),
      });
      return res.data.map(
        (artist): ProviderSearchResult => ({
          type: "artist",
          data: { externalId: String(artist.id), value: mapDeezerArtist(artist) },
        }),
      );
    }
    const res = await this.api<DeezerList<DeezerTrack>>("/search/track", {
      q: query,
      limit: String(this.cfg.searchLimit),
    });
    return res.data.map(
      (track): ProviderSearchResult => ({
        type: "track",
        data: this.toTrack(track),
      }),
    );
  }

  async searchByIsrc(isrc: string): Promise<ProviderTrack[]> {
    const raw = await this.api<DeezerTrack & { error?: unknown }>(
      `/track/isrc:${encodeURIComponent(isrc)}`,
    );
    return raw.error === undefined && raw.id !== undefined
      ? [this.toTrack(raw)]
      : [];
  }
}
