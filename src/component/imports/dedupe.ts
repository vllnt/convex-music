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
  /** `withTracks: true` is the legacy alias for the `top` artist depth. */
  withTracks?: boolean;
  /** Artist track-traversal depth (`none` | `top` | `all`) — overrides `withTracks`. */
  tracks?: string;
  /** Track import: also import the track's album. */
  withAlbum?: boolean;
}

/**
 * The effective artist track-traversal depth: explicit `tracks`, else the legacy
 * `withTracks` alias (`top`/`none`). The key includes this so a deep import (`top`
 * /`all`) never collapses onto a shallow one and silently skips its tracks.
 */
function effectiveDepth(input: DedupeKeyInput): string {
  return input.tracks ?? (input.withTracks === true ? "top" : "none");
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
    `tracks:${effectiveDepth(input)}`,
    `album:${input.withAlbum === true ? "1" : "0"}`,
  ].join("|");
}
