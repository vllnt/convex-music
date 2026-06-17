/**
 * Wikidata adapter — a no-auth, facts-only provider (an alternative facts source
 * to MusicBrainz; the field-source policy chooses between them per field). Serves
 * artist facts via `wbgetentities` + artist discovery via `wbsearchentities`; it
 * does not serve tracks/albums/playlists (those methods reject). Requests carry a
 * `User-Agent` per Wikimedia policy.
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
import { mapWikidataArtist } from "./mappers.js";
import type {
  WikidataEntitiesResponse,
  WikidataSearchResponse,
} from "./types.js";

/** Tunable Wikidata settings. */
export interface WikidataConfig {
  apiUrl: string;
  userAgent: string;
  retry: RetryConfig;
  searchLimit: number;
}

/** Default Wikidata settings. */
export const DEFAULT_WIKIDATA_CONFIG: WikidataConfig = {
  apiUrl: "https://www.wikidata.org/w/api.php",
  userAgent: "vllnt-convex-music/0.1 (https://github.com/vllnt/convex-music)",
  retry: DEFAULT_RETRY_CONFIG,
  searchLimit: 10,
};

/** A method Wikidata (facts-only) does not serve. */
function unsupported<T>(method: string): Promise<T> {
  return Promise.reject(
    new Error(`wikidata: ${method} not supported (facts-only provider)`),
  );
}

export class WikidataProvider implements MusicProvider {
  readonly id = "wikidata" as const;

  constructor(
    private readonly cfg: WikidataConfig = DEFAULT_WIKIDATA_CONFIG,
    private readonly deps: FetchDeps = defaultFetchDeps,
  ) {}

  private async api<T>(params: Record<string, string>): Promise<T> {
    const url = new URL(this.cfg.apiUrl);
    url.searchParams.set("format", "json");
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return fetchJson<T>(
      "wikidata",
      url.toString(),
      { headers: { "User-Agent": this.cfg.userAgent } },
      this.cfg.retry,
      this.deps,
    );
  }

  async getArtist(externalId: string): Promise<ProviderArtist> {
    const res = await this.api<WikidataEntitiesResponse>({
      action: "wbgetentities",
      ids: externalId,
      props: "labels|claims",
      languages: "en",
    });
    const entity = res.entities?.[externalId];
    if (entity === undefined) {
      throw new Error(`wikidata: entity "${externalId}" not found`);
    }
    return { externalId, value: mapWikidataArtist(entity) };
  }

  async search(
    query: string,
    type: "artist" | "track",
  ): Promise<ProviderSearchResult[]> {
    if (type === "artist") {
      const res = await this.api<WikidataSearchResponse>({
        action: "wbsearchentities",
        search: query,
        language: "en",
        type: "item",
        limit: String(this.cfg.searchLimit),
      });
      return (res.search ?? []).map(
        (hit): ProviderSearchResult => ({
          type: "artist",
          data: {
            externalId: hit.id,
            value: { name: hit.label ?? "", genres: [] },
          },
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
