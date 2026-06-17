/**
 * Map raw Wikidata entities to the normalized artist schema. Wikidata claims
 * reference other entities by Q-id; we resolve the small, stable sets that
 * matter for music facts (gender, person/group) and parse the inception date for
 * debut year. Country is left to MusicBrainz (its Q-id needs a second lookup).
 */

import type { NormalizedArtist } from "../../../client/types.js";
import type { WikidataClaim, WikidataEntity, WikidataSnakValue } from "./types.js";

/** Common gender Q-ids → label. */
const GENDER_BY_QID: Record<string, string> = {
  Q6581072: "Female",
  Q6581097: "Male",
};

/** P31 (instance-of) Q-ids that mark a group. */
const GROUP_QIDS = new Set(["Q215380", "Q2088357", "Q9212979"]);

/** P31 Q-id for a human (solo artist). */
const HUMAN_QID = "Q5";

/** First claim value for a property. */
function firstValue(
  claims: Record<string, WikidataClaim[]> | undefined,
  pid: string,
): WikidataSnakValue | undefined {
  return claims?.[pid]?.[0]?.mainsnak?.datavalue?.value;
}

/** All referenced entity Q-ids for a property. */
function entityIds(
  claims: Record<string, WikidataClaim[]> | undefined,
  pid: string,
): string[] {
  return (claims?.[pid] ?? [])
    .map((claim) => claim.mainsnak?.datavalue?.value?.id)
    .filter((id): id is string => id !== undefined);
}

/** Parse a 4-digit year from a Wikidata time literal (`+1993-00-00T…`). */
function parseYear(time: string | undefined): number | undefined {
  if (time === undefined) return undefined;
  const match = time.match(/(\d{4})/);
  return match === null ? undefined : Number(match[1]);
}

/** Solo/group from the instance-of (P31) entities. */
function membersOf(instanceIds: string[]): "solo" | "group" | undefined {
  if (instanceIds.includes(HUMAN_QID)) return "solo";
  if (instanceIds.some((id) => GROUP_QIDS.has(id))) return "group";
  return undefined;
}

/** Wikidata entity → normalized artist (facts only). */
export function mapWikidataArtist(entity: WikidataEntity): NormalizedArtist {
  const claims = entity.claims;
  const genderId = firstValue(claims, "P21")?.id;
  return {
    name: entity.labels?.en?.value ?? "",
    genres: [],
    gender: genderId === undefined ? undefined : GENDER_BY_QID[genderId],
    members: membersOf(entityIds(claims, "P31")),
    debutYear: parseYear(firstValue(claims, "P571")?.time),
  };
}
