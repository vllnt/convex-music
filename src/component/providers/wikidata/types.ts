/**
 * Raw Wikidata API shapes — private to the adapter. Wikidata is a no-auth,
 * facts-only provider (an alternative source the field-source policy can prefer
 * over MusicBrainz per field). Claim values are either a referenced entity
 * (`{ id }`) or a time (`{ time }`); only consumed fields are modeled.
 */

export interface WikidataSnakValue {
  id?: string;
  time?: string;
}

export interface WikidataClaim {
  mainsnak?: { datavalue?: { value?: WikidataSnakValue } };
}

export interface WikidataEntity {
  labels?: { en?: { value: string } };
  claims?: Record<string, WikidataClaim[]>;
}

export interface WikidataEntitiesResponse {
  entities?: Record<string, WikidataEntity>;
}

export interface WikidataSearchResponse {
  search?: Array<{ id: string; label?: string }>;
}
