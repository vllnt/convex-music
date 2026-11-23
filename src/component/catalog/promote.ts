/**
 * Shared catalog-promotion helpers used by both the read-through fetch actions
 * and the import traversal: resolve a track/album's credited artists into the
 * unified catalog, bounded so a large credit list never opens unbounded mutations.
 */

import { api, internal } from "../_generated/api.js";
import type { Id } from "../_generated/dataModel.js";
import type { ActionCtx } from "../_generated/server.js";
import type { ArtistRef } from "../../client/types.js";
import type { Provider } from "../../shared.js";
import type { ProviderTrack } from "../providers/types.js";
import { UPSERT_TRACKS_BATCH } from "./mutations.js";
import { mapWithConcurrency } from "../providers/fetch.js";

/** Max concurrent cross-boundary upserts in a traversal (provider-429 safe). */
export const IMPORT_CONCURRENCY = 5;

/** A credited artist ref that carries a provider id (so it can be unified). */
export function hasExternalId(
  ref: ArtistRef,
): ref is ArtistRef & { externalId: string } {
  return ref.externalId !== undefined;
}

/**
 * Upsert the credited artists that carry a provider id, bounded so a big credit
 * list never opens unbounded mutations. Returns the resolved catalog artist ids.
 */
export async function upsertCreditedArtists(
  ctx: ActionCtx,
  prov: Provider,
  refs: readonly ArtistRef[],
): Promise<Array<Id<"artists">>> {
  return mapWithConcurrency(refs.filter(hasExternalId), IMPORT_CONCURRENCY, (ref) =>
    ctx.runMutation(api.catalog.mutations.upsertArtist, {
      provider: prov,
      externalId: ref.externalId,
      value: { name: ref.name, genres: [] },
    }),
  );
}

export async function upsertTracksBatched(
  ctx: ActionCtx,
  prov: Provider,
  tracks: ReadonlyArray<{
    externalId: string;
    value: ProviderTrack["value"];
    artistIds?: Array<Id<"artists">>;
  }>,
): Promise<Array<Id<"tracks">>> {
  const trackIds: Array<Id<"tracks">> = [];
  let firstError: string | undefined;
  for (let start = 0; start < tracks.length; start += UPSERT_TRACKS_BATCH) {
    const results = await ctx.runMutation(internal.catalog.mutations.upsertTracks, {
      provider: prov,
      tracks: tracks.slice(start, start + UPSERT_TRACKS_BATCH),
    });
    for (const result of results) {
      if ("error" in result) {
        firstError ??= result.error;
      } else {
        trackIds.push(result.trackId);
      }
    }
  }
  if (firstError !== undefined) {
    throw new Error(firstError);
  }
  return trackIds;
}
