import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import type { Provider } from "../shared.js";
import type {
  CacheEntry,
  CatalogArtist,
  CatalogPlaylist,
  CatalogTrack,
  EntryKey,
  NormalizedArtist,
  NormalizedTrack,
  PutInput,
  SearchHit,
} from "./types.js";

/** Arguments to fetch a provider entity into the catalog (read-through). */
export type FetchInput = {
  provider: Provider;
  externalId: string;
  force?: boolean;
};

/** Arguments to search a provider for artists or tracks. */
export type SearchInput = {
  provider: Provider;
  query: string;
  type: "artist" | "track";
};

/** Arguments to upsert a provider's artist into the catalog. */
export type UpsertArtistInput = {
  provider: Provider;
  externalId: string;
  value: NormalizedArtist;
};

/** Arguments to upsert a provider's track (ISRC required) into the catalog. */
export type UpsertTrackInput = {
  provider: Provider;
  externalId: string;
  value: NormalizedTrack;
  artistIds?: string[];
};

/** Arguments to upsert a playlist by source-provider identity. */
export type UpsertPlaylistInput = {
  provider: Provider;
  providerId: string;
  title: string;
  description?: string;
  coverUrl?: string;
  url?: string;
  owner?: string;
  trackIds: string[];
};

/** Arguments to select eligible catalog rows for a daily picker. */
export type SelectEligibleInput = {
  kind: "artist" | "track";
  limit: number;
  excludeIds?: string[];
  salt?: string;
  scanLimit?: number;
};

/**
 * The component's function references, as exposed on the host via
 * `components.music`.
 */
export interface MusicComponent {
  mutations: {
    put: FunctionReference<"mutation", "internal", PutInput, string>;
    invalidate: FunctionReference<"mutation", "internal", EntryKey, boolean>;
    pruneExpired: FunctionReference<
      "mutation",
      "internal",
      Record<string, never>,
      number
    >;
  };
  queries: {
    get: FunctionReference<"query", "internal", EntryKey, CacheEntry | null>;
    getByIsrc: FunctionReference<
      "query",
      "internal",
      { isrc: string },
      CacheEntry[]
    >;
    stats: FunctionReference<
      "query",
      "internal",
      Record<string, never>,
      { total: number }
    >;
  };
  catalog: {
    mutations: {
      upsertArtist: FunctionReference<
        "mutation",
        "internal",
        UpsertArtistInput,
        string
      >;
      upsertTrack: FunctionReference<
        "mutation",
        "internal",
        UpsertTrackInput,
        string
      >;
      upsertPlaylist: FunctionReference<
        "mutation",
        "internal",
        UpsertPlaylistInput,
        string
      >;
    };
    queries: {
      getArtist: FunctionReference<
        "query",
        "internal",
        { id: string },
        CatalogArtist | null
      >;
      getTrack: FunctionReference<
        "query",
        "internal",
        { id: string },
        CatalogTrack | null
      >;
      getPlaylist: FunctionReference<
        "query",
        "internal",
        { id: string },
        CatalogPlaylist | null
      >;
      getTrackByIsrc: FunctionReference<
        "query",
        "internal",
        { isrc: string },
        CatalogTrack | null
      >;
      searchArtists: FunctionReference<
        "query",
        "internal",
        { query: string; limit?: number },
        CatalogArtist[]
      >;
      searchTracks: FunctionReference<
        "query",
        "internal",
        { query: string; limit?: number },
        CatalogTrack[]
      >;
      selectEligible: FunctionReference<
        "query",
        "internal",
        SelectEligibleInput,
        Array<CatalogArtist | CatalogTrack>
      >;
    };
  };
  actions: {
    fetchArtist: FunctionReference<
      "action",
      "internal",
      FetchInput,
      CatalogArtist | null
    >;
    fetchTrack: FunctionReference<
      "action",
      "internal",
      FetchInput,
      CatalogTrack | null
    >;
    search: FunctionReference<"action", "internal", SearchInput, SearchHit[]>;
  };
  config: {
    mutations: {
      configure: FunctionReference<
        "mutation",
        "internal",
        { provider: Provider; secrets: Record<string, string> },
        null
      >;
    };
  };
}

interface RunQueryCtx {
  runQuery<Q extends FunctionReference<"query", "internal">>(
    reference: Q,
    args: FunctionArgs<Q>,
  ): Promise<FunctionReturnType<Q>>;
}

interface RunMutationCtx {
  runMutation<M extends FunctionReference<"mutation", "internal">>(
    reference: M,
    args: FunctionArgs<M>,
  ): Promise<FunctionReturnType<M>>;
}

interface RunActionCtx {
  runAction<A extends FunctionReference<"action", "internal">>(
    reference: A,
    args: FunctionArgs<A>,
  ): Promise<FunctionReturnType<A>>;
}

/**
 * Consumer-facing client for `@vllnt/convex-music`. Construct with the mounted
 * component ref, then call from host queries/mutations/actions.
 *
 * `0.1.0` is the raw provider-fetch cache; the durable music catalog
 * (artists/tracks/playlists) the component will own is planned (see ROADMAP).
 * The host owns auth and gates write methods behind its own mutations, and keeps
 * gameplay + editorial, referencing catalog rows by id / ISRC.
 *
 * @example
 * ```ts
 * const music = new Music(components.music);
 * const hit = await music.get(ctx, { kind: "track", provider: "spotify", externalId: id });
 * ```
 */
export class Music {
  constructor(private readonly component: MusicComponent) {}

  /** Cache (insert or refresh) a provider's normalized facts for an entity. */
  put(ctx: RunMutationCtx, input: PutInput): Promise<string> {
    return ctx.runMutation(this.component.mutations.put, input);
  }

  /** Fetch one cached entry, or `null` if missing or expired. */
  get(ctx: RunQueryCtx, key: EntryKey): Promise<CacheEntry | null> {
    return ctx.runQuery(this.component.queries.get, key);
  }

  /** Every fresh cached track for an ISRC, across providers. */
  getByIsrc(ctx: RunQueryCtx, isrc: string): Promise<CacheEntry[]> {
    return ctx.runQuery(this.component.queries.getByIsrc, { isrc });
  }

  /** Drop one cached entry. Returns whether a row was deleted. */
  invalidate(ctx: RunMutationCtx, key: EntryKey): Promise<boolean> {
    return ctx.runMutation(this.component.mutations.invalidate, key);
  }

  /** Delete every expired entry. Idempotent; safe to run on a schedule. */
  pruneExpired(ctx: RunMutationCtx): Promise<number> {
    return ctx.runMutation(this.component.mutations.pruneExpired, {});
  }

  /** Count of cached entries (fresh + expired). */
  stats(ctx: RunQueryCtx): Promise<{ total: number }> {
    return ctx.runQuery(this.component.queries.stats, {});
  }

  /** Upsert a provider's artist into the catalog; returns the unified artist id. */
  upsertArtist(ctx: RunMutationCtx, input: UpsertArtistInput): Promise<string> {
    return ctx.runMutation(this.component.catalog.mutations.upsertArtist, input);
  }

  /** Upsert a provider's track (ISRC required); returns the unified track id. */
  upsertTrack(ctx: RunMutationCtx, input: UpsertTrackInput): Promise<string> {
    return ctx.runMutation(this.component.catalog.mutations.upsertTrack, input);
  }

  /** Upsert a playlist by source-provider identity; returns the playlist id. */
  upsertPlaylist(
    ctx: RunMutationCtx,
    input: UpsertPlaylistInput,
  ): Promise<string> {
    return ctx.runMutation(
      this.component.catalog.mutations.upsertPlaylist,
      input,
    );
  }

  /** Fetch one unified artist by id. */
  getArtist(ctx: RunQueryCtx, id: string): Promise<CatalogArtist | null> {
    return ctx.runQuery(this.component.catalog.queries.getArtist, { id });
  }

  /** Fetch one unified track by id. */
  getTrack(ctx: RunQueryCtx, id: string): Promise<CatalogTrack | null> {
    return ctx.runQuery(this.component.catalog.queries.getTrack, { id });
  }

  /** Fetch one playlist by id. */
  getPlaylist(ctx: RunQueryCtx, id: string): Promise<CatalogPlaylist | null> {
    return ctx.runQuery(this.component.catalog.queries.getPlaylist, { id });
  }

  /** Resolve a unified track by ISRC. */
  getTrackByIsrc(ctx: RunQueryCtx, isrc: string): Promise<CatalogTrack | null> {
    return ctx.runQuery(this.component.catalog.queries.getTrackByIsrc, { isrc });
  }

  /** Full-text search artists by name. */
  searchArtists(
    ctx: RunQueryCtx,
    query: string,
    limit?: number,
  ): Promise<CatalogArtist[]> {
    return ctx.runQuery(this.component.catalog.queries.searchArtists, {
      query,
      limit,
    });
  }

  /** Full-text search tracks by title. */
  searchTracks(
    ctx: RunQueryCtx,
    query: string,
    limit?: number,
  ): Promise<CatalogTrack[]> {
    return ctx.runQuery(this.component.catalog.queries.searchTracks, {
      query,
      limit,
    });
  }

  /** Select eligible catalog rows for a daily picker (stable rotation). */
  selectEligible(
    ctx: RunQueryCtx,
    input: SelectEligibleInput,
  ): Promise<Array<CatalogArtist | CatalogTrack>> {
    return ctx.runQuery(this.component.catalog.queries.selectEligible, input);
  }

  /**
   * Read-through fetch an artist by provider id, promoting it into the catalog.
   * Cache-through unless `force`. Returns the unified artist row.
   */
  fetchArtist(ctx: RunActionCtx, input: FetchInput): Promise<CatalogArtist | null> {
    return ctx.runAction(this.component.actions.fetchArtist, input);
  }

  /**
   * Read-through fetch a track by provider id, promoting it + its artists.
   * Cache-through unless `force`. Returns the unified track row.
   */
  fetchTrack(ctx: RunActionCtx, input: FetchInput): Promise<CatalogTrack | null> {
    return ctx.runAction(this.component.actions.fetchTrack, input);
  }

  /** Search a provider for artists or tracks (discovery; no promotion). */
  search(ctx: RunActionCtx, input: SearchInput): Promise<SearchHit[]> {
    return ctx.runAction(this.component.actions.search, input);
  }

  /**
   * Store a provider's credentials (the host reads its own deployment env vars
   * and passes them in — a component is sandboxed from the deployment's env).
   * Spotify: `{ clientId, clientSecret }`; Apple: `{ issuer, keyId, privateKeyPem }`.
   */
  configure(
    ctx: RunMutationCtx,
    provider: Provider,
    secrets: Record<string, string>,
  ): Promise<null> {
    return ctx.runMutation(this.component.config.mutations.configure, {
      provider,
      secrets,
    });
  }
}

export type {
  ArtistRef,
  CacheEntry,
  CacheValue,
  CatalogArtist,
  CatalogPlaylist,
  CatalogTrack,
  EntryKey,
  NormalizedAlbum,
  NormalizedArtist,
  NormalizedTrack,
  PutInput,
  SearchHit,
} from "./types.js";
