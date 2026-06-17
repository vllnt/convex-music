/**
 * Raw MusicBrainz API response shapes — private to the adapter. MusicBrainz is a
 * no-auth, facts-focused provider (nationality, gender, solo/group, debut). Only
 * the consumed fields are modeled.
 */

export interface MusicBrainzArtist {
  id: string;
  name: string;
  country?: string | null;
  gender?: string | null;
  /** "Person" | "Group" | "Orchestra" | … */
  type?: string | null;
  "life-span"?: { begin?: string | null };
  tags?: Array<{ name: string; count?: number }>;
}

export interface MusicBrainzArtistSearchResponse {
  artists?: MusicBrainzArtist[];
}
