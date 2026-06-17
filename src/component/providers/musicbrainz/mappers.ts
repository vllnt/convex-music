/**
 * Map raw MusicBrainz responses to the normalized artist schema. MusicBrainz
 * supplies the facts Spotify/Apple lack — country, gender, solo/group, debut
 * year — which merge into the unified artist by name.
 */

import type { NormalizedArtist } from "../../../client/types.js";
import type { MusicBrainzArtist } from "./types.js";

/** Parse a leading 4-digit year from an MB `life-span.begin` (`YYYY[-MM-DD]`). */
function parseYear(begin: string | null | undefined): number | undefined {
  if (begin === null || begin === undefined) return undefined;
  const match = begin.match(/^(\d{4})/);
  return match === null ? undefined : Number(match[1]);
}

/** MB artist `type` → solo/group (undefined for other types). */
function membersOf(type: string | null | undefined): "solo" | "group" | undefined {
  if (type === "Person") return "solo";
  if (type === "Group") return "group";
  return undefined;
}

/** MusicBrainz artist → normalized artist (facts only; no image/popularity). */
export function mapMusicBrainzArtist(raw: MusicBrainzArtist): NormalizedArtist {
  return {
    name: raw.name,
    genres: (raw.tags ?? []).map((tag) => tag.name),
    country: raw.country ?? undefined,
    gender: raw.gender ?? undefined,
    members: membersOf(raw.type),
    debutYear: parseYear(raw["life-span"]?.begin),
  };
}
