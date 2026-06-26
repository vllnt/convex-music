/**
 * MusicBrainz adapter — a **no-auth, facts-only** provider. It supplies the
 * artist facts Spotify/Apple lack (country, gender, solo/group, debut), which
 * merge into the unified artist by name. It does NOT serve tracks/albums/
 * playlists, so those `MusicProvider` methods reject; `search(track)` /
 * `searchByIsrc` return empty rather than throwing (graceful for cross-provider
 * fallback). No bearer token — requests carry a `User-Agent` per MB policy.
 */

import {
  DEFAULT_RETRY_CONFIG,
  type FetchDeps,
  type RetryConfig,
  defaultFetchDeps,
  fetchJson,
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
import { mapMusicBrainzArtist } from "./mappers.js";
import type {
  MusicBrainzArtist,
  MusicBrainzArtistSearchResponse,
} from "./types.js";

/** Tunable MusicBrainz settings. */
export interface MusicBrainzConfig {
  baseUrl: string;
  /** Required by MB policy; identifies the client. */
  userAgent: string;
  retry: RetryConfig;
  searchLimit: number;
}

/** Default MusicBrainz settings. */
export const DEFAULT_MUSICBRAINZ_CONFIG: MusicBrainzConfig = {
  baseUrl: "https://musicbrainz.org/ws/2",
  userAgent: "vllnt-convex-music/0.1 (https://github.com/vllnt/convex-music)",
  retry: DEFAULT_RETRY_CONFIG,
  searchLimit: 10,
};

/** A method MusicBrainz (facts-only) does not serve. */
function unsupported<T>(method: string): Promise<T> {
  return Promise.reject(
    new Error(`musicbrainz: ${method} not supported (facts-only provider)`),
  );
}

export class MusicBrainzProvider implements MusicProvider {
  readonly id = "musicbrainz" as const;

  constructor(
    private readonly cfg: MusicBrainzConfig = DEFAULT_MUSICBRAINZ_CONFIG,
    private readonly deps: FetchDeps = defaultFetchDeps,
  ) {}

  private async api<T>(
    path: string,
    params: Record<string, string>,
  ): Promise<T> {
    const url = new URL(this.cfg.baseUrl + path);
    url.searchParams.set("fmt", "json");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return fetchJson<T>(
      "musicbrainz",
      url.toString(),
      { headers: { "User-Agent": this.cfg.userAgent } },
      this.cfg.retry,
      this.deps,
    );
  }

  async getArtist(externalId: string): Promise<ProviderArtist> {
    const raw = await this.api<MusicBrainzArtist>(
      `/artist/${encodeURIComponent(externalId)}`,
      { inc: "tags" },
    );
    return { externalId: raw.id, value: mapMusicBrainzArtist(raw) };
  }

  async search(
    query: string,
    type: "artist" | "track",
  ): Promise<ProviderSearchResult[]> {
    if (type === "artist") {
      const res = await this.api<MusicBrainzArtistSearchResponse>("/artist", {
        query,
        limit: String(this.cfg.searchLimit),
      });
      return (res.artists ?? []).map(
        (artist): ProviderSearchResult => ({
          type: "artist",
          data: { externalId: artist.id, value: mapMusicBrainzArtist(artist) },
        }),
      );
    }
    return [];
  }

  searchByIsrc(): Promise<ProviderTrack[]> {
    return Promise.resolve([]);
  }

  getTrack(): Promise<ProviderTrack> {
    return unsupported("getTrack");
  }

  getAlbum(): Promise<ProviderAlbum> {
    return unsupported("getAlbum");
  }

  getPlaylist(): Promise<ProviderPlaylist> {
    return unsupported("getPlaylist");
  }

  getArtistTopTracks(): Promise<ProviderTrack[]> {
    return unsupported("getArtistTopTracks");
  }

  getArtistAlbums(): Promise<ArtistAlbumsResult> {
    return unsupported("getArtistAlbums");
  }
}
