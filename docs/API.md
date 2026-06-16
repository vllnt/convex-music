# API Reference — @vllnt/convex-music

**Compatibility:** `convex@^1.36.1`

The `Music` client wraps the mounted component (`components.music`). Construct it once, then call
from your host queries, mutations, and actions.

```ts
import { Music } from "@vllnt/convex-music";
const music = new Music(components.music);
```

## Types

```ts
type Provider = "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
type EntityKind = "track" | "artist" | "album";

type EntryKey = { kind: EntityKind; provider: Provider; externalId: string };

type ArtistRef = { name: string; externalId?: string };

type NormalizedTrack = {
  title: string;
  artists: ArtistRef[];
  isrc?: string;
  durationMs?: number;
  previewUrl?: string;
  coverUrl?: string;
  url?: string;
};

type NormalizedArtist = {
  name: string;
  genres: string[];
  popularity?: number;
  imageUrl?: string;
  url?: string;
  country?: string;
  gender?: string;
  debutYear?: number;
  members?: "solo" | "group";
};

type NormalizedAlbum = {
  title: string;
  artists: ArtistRef[];
  releaseDate?: string;
  coverUrl?: string;
  url?: string;
  trackCount?: number;
};

type CacheValue = NormalizedTrack | NormalizedArtist | NormalizedAlbum;

type PutInput = EntryKey & { isrc?: string; value: CacheValue; ttlMs?: number };

type CacheEntry = EntryKey & {
  _id: string;
  _creationTime: number;
  isrc?: string;
  value: CacheValue;
  fetchedAt: number;
  expiresAt: number;
};
```

Provider-sourced fields are optional because they vary by provider — e.g. `popularity` comes from
Spotify, while `country` / `gender` / `members` / `debutYear` come from MusicBrainz or Wikidata.

## Mutations

### `put(ctx, input: PutInput): Promise<string>`

Cache (insert or refresh) one provider's normalized facts for an entity. Upserts by
`(kind, provider, externalId)`. `ttlMs` is milliseconds from now; omit it for an entry that never
expires. Returns the entry id.

### `invalidate(ctx, key: EntryKey): Promise<boolean>`

Drop a single cached entry. Returns `true` if a row was deleted, `false` if the key was not cached.

### `pruneExpired(ctx): Promise<number>`

Delete every entry whose `expiresAt` is in the past. Idempotent and bounded to expired rows — safe
to run on a schedule. Returns the number of rows removed.

## Queries

### `get(ctx, key: EntryKey): Promise<CacheEntry | null>`

Fetch one cached entry. Returns `null` if the entry is missing or has expired (an expired entry is
treated as a cache miss, not an error).

### `getByIsrc(ctx, isrc: string): Promise<CacheEntry[]>`

Return every fresh cached **track** for an ISRC, across providers — the cross-provider resolution
of one recording. Expired copies are excluded.

### `stats(ctx): Promise<{ total: number }>`

Return the count of cached entries (fresh and expired).

## Error codes

This surface favors return values over thrown errors: a missing or expired `get` returns `null`,
`getByIsrc` returns `[]`, and `invalidate` on an unknown key returns `false`. No error codes are
thrown by the cache core.

## Cache / Maintenance

- TTL is set per `put` via `ttlMs`; entries without a TTL are stored with a never-expires sentinel
  so the expiry index never sweeps them.
- `get` / `getByIsrc` treat expired entries as misses at read time; `pruneExpired` reclaims their
  storage. Call it from your own scheduled function (a cron). `[planned]` an in-component prune cron.
