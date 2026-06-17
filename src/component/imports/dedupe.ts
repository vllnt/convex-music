/**
 * Stable dedup key for an import request (songtrivia's `buildMusicImportDedupeKey`).
 * A pipe-joined, case-normalized key so a duplicate in-flight request collapses
 * onto the active one — but a `refresh` never dedups into an `import`, and a
 * `withTracks` import never collapses into a shallow one (both differ in the key).
 * Collapsing happens only against ACTIVE requests (see `state.ts`).
 */

/** The request fields that define identity for dedup. */
export interface DedupeKeyInput {
  entityType: string;
  requestType: string;
  targetMode: string;
  providerScope: string;
  provider?: string;
  providerId?: string;
  entityId?: string;
  name?: string;
  isrc?: string;
  url?: string;
  withTracks?: boolean;
}

/** Build the pipe-joined dedup key. Name lowercased, ISRC uppercased, urls trimmed. */
export function buildDedupeKey(input: DedupeKeyInput): string {
  return [
    input.entityType,
    input.requestType,
    input.targetMode,
    input.providerScope,
    input.provider ?? "_",
    input.providerId ?? "_",
    input.entityId ?? "_",
    input.name?.trim().toLowerCase() ?? "_",
    input.isrc?.trim().toUpperCase() ?? "_",
    input.url?.trim() ?? "_",
    input.withTracks === true ? "with_tracks" : "no_tracks",
  ].join("|");
}
