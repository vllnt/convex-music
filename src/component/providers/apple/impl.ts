/**
 * Apple Music adapter. Implements {@link MusicProvider} over the Apple Music API.
 * The developer token (signed by {@link signAppleDeveloperToken}) is injected via
 * `getToken` so the class stays pure + testable; the action layer signs + caches
 * it. Apple inlines album/playlist tracks via `include=tracks`, so traversal needs
 * fewer requests than Spotify.
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
  mapAppleAlbum,
  mapAppleArtist,
  mapApplePlaylist,
  mapAppleTrack,
} from "./mappers.js";
import type {
  AppleAlbum,
  AppleArtist,
  AppleDataResponse,
  ApplePlaylist,
  AppleSearchResponse,
  AppleSong,
} from "./types.js";

/** Apple Music API base. */
export const APPLE_API_BASE = "https://api.music.apple.com/v1";

/** Tunable Apple limits (all overridable via mount policy). */
export interface AppleConfig {
  /** Storefront / locale segment (e.g. `us`). */
  storefront: string;
  /** Retry/timeout policy for each call. */
  retry: RetryConfig;
  /** Max results per free-text search. */
  searchLimit: number;
  /** Page size for artist-album listings. */
  albumLimit: number;
  /** Cap on albums per artist. */
  maxAlbumsPerArtist: number;
  /** Ids per batch songs request. */
  batchSize: number;
  /** Concurrent batch requests. */
  concurrency: number;
}

/** Default Apple limits. */
export const DEFAULT_APPLE_CONFIG: AppleConfig = {
  storefront: "us",
  retry: DEFAULT_RETRY_CONFIG,
  searchLimit: 10,
  albumLimit: 30,
  maxAlbumsPerArtist: 30,
  batchSize: 25,
  concurrency: 5,
};

export class AppleProvider implements MusicProvider {
  readonly id = "apple" as const;

  constructor(
    private readonly getToken: () => Promise<string>,
    private readonly cfg: AppleConfig = DEFAULT_APPLE_CONFIG,
    private readonly deps: FetchDeps = defaultFetchDeps,
  ) {}

  private get catalog(): string {
    return `/catalog/${this.cfg.storefront}`;
  }

  private async api<T>(
    path: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    const token = await this.getToken();
    const url = new URL(APPLE_API_BASE + path);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return fetchJson<T>(
      "apple",
      url.toString(),
      { headers: { Authorization: `Bearer ${token}` } },
      this.cfg.retry,
      this.deps,
    );
  }

  private firstOrThrow<T>(data: T[], kind: string, id: string): T {
    const item = data[0];
    if (item === undefined) throw new Error(`apple: ${kind} "${id}" not found`);
    return item;
  }

  private toTrack(raw: AppleSong): ProviderTrack {
    return { externalId: raw.id, value: mapAppleTrack(raw) };
  }

  private toAlbum(raw: AppleAlbum): ProviderAlbum {
    const tracks = raw.relationships?.tracks?.data ?? [];
    return {
      externalId: raw.id,
      value: mapAppleAlbum(raw),
      tracks: tracks.map((track) => this.toTrack(track)),
    };
  }

  async getArtist(externalId: string): Promise<ProviderArtist> {
    const res = await this.api<AppleDataResponse<AppleArtist>>(
      `${this.catalog}/artists/${externalId}`,
    );
    const raw = this.firstOrThrow(res.data, "artist", externalId);
    return { externalId: raw.id, value: mapAppleArtist(raw) };
  }

  async getTrack(externalId: string): Promise<ProviderTrack> {
    const res = await this.api<AppleDataResponse<AppleSong>>(
      `${this.catalog}/songs/${externalId}`,
    );
    return this.toTrack(this.firstOrThrow(res.data, "song", externalId));
  }

  async getAlbum(externalId: string): Promise<ProviderAlbum> {
    const res = await this.api<AppleDataResponse<AppleAlbum>>(
      `${this.catalog}/albums/${externalId}`,
      { include: "tracks,artists" },
    );
    return this.toAlbum(this.firstOrThrow(res.data, "album", externalId));
  }

  async getPlaylist(externalId: string): Promise<ProviderPlaylist> {
    const res = await this.api<AppleDataResponse<ApplePlaylist>>(
      `${this.catalog}/playlists/${externalId}`,
      { include: "tracks" },
    );
    const raw = this.firstOrThrow(res.data, "playlist", externalId);
    const tracks = raw.relationships?.tracks?.data ?? [];
    return {
      externalId: raw.id,
      value: mapApplePlaylist(raw),
      tracks: tracks.map((track) => this.toTrack(track)),
    };
  }

  async getArtistTopTracks(externalId: string): Promise<ProviderTrack[]> {
    const res = await this.api<AppleDataResponse<AppleSong>>(
      `${this.catalog}/artists/${externalId}/view/top-songs`,
    );
    return res.data.map((track) => this.toTrack(track));
  }

  async getArtistAlbums(externalId: string): Promise<ArtistAlbumsResult> {
    const res = await this.api<AppleDataResponse<AppleAlbum>>(
      `${this.catalog}/artists/${externalId}/albums`,
      { include: "tracks,artists", limit: String(this.cfg.albumLimit) },
    );
    const isPartial = res.next !== undefined;
    const albums = res.data
      .slice(0, this.cfg.maxAlbumsPerArtist)
      .map((album) => this.toAlbum(album));
    return { albums, isPartial };
  }

  async search(
    query: string,
    type: "artist" | "track",
  ): Promise<ProviderSearchResult[]> {
    const res = await this.api<AppleSearchResponse>(`${this.catalog}/search`, {
      term: query,
      types: type === "artist" ? "artists" : "songs",
      limit: String(this.cfg.searchLimit),
    });
    if (type === "artist") {
      return (res.results?.artists?.data ?? []).map(
        (artist): ProviderSearchResult => ({
          type: "artist",
          data: { externalId: artist.id, value: mapAppleArtist(artist) },
        }),
      );
    }
    return (res.results?.songs?.data ?? []).map(
      (song): ProviderSearchResult => ({
        type: "track",
        data: this.toTrack(song),
      }),
    );
  }

  async searchByIsrc(isrc: string): Promise<ProviderTrack[]> {
    const res = await this.api<AppleDataResponse<AppleSong>>(
      `${this.catalog}/songs`,
      { "filter[isrc]": isrc },
    );
    return res.data.map((track) => this.toTrack(track));
  }

  async getSeveralTracks(externalIds: string[]): Promise<ProviderTrack[]> {
    const chunks: string[][] = [];
    for (let i = 0; i < externalIds.length; i += this.cfg.batchSize) {
      chunks.push(externalIds.slice(i, i + this.cfg.batchSize));
    }
    const pages = await mapWithConcurrency(chunks, this.cfg.concurrency, (chunk) =>
      this.api<AppleDataResponse<AppleSong>>(`${this.catalog}/songs`, {
        ids: chunk.join(","),
      }),
    );
    return pages.flatMap((page) => page.data.map((track) => this.toTrack(track)));
  }
}
