import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import type { CacheEntry, EntryKey, PutInput } from "./types.js";

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

/**
 * Consumer-facing client for `@vllnt/convex-music`. Construct with the mounted
 * component ref, then call from host queries/mutations/actions.
 *
 * The component is a TTL'd cache of provider facts: the host owns its own
 * domain tables and persists its curated copy — the cache never replaces them.
 * The host owns auth and gates write methods behind its own mutations.
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
}

export type {
  ArtistRef,
  CacheEntry,
  CacheValue,
  EntryKey,
  NormalizedAlbum,
  NormalizedArtist,
  NormalizedTrack,
  PutInput,
} from "./types.js";
