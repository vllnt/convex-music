# API Reference — @vllnt/convex-music

**Compatibility (current main/canary):** `convex@^1.45.0`. npm `latest` is still
`0.1.0`; check the installed release before using the catalog/import surface
below.

The `Music` client wraps the mounted component (`components.music`). Construct
it once, then call from your host queries, mutations, and actions.

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

Provider-sourced fields are optional because they vary by provider — e.g.
`popularity` comes from Spotify, while `country` / `gender` / `members` /
`debutYear` come from MusicBrainz or Wikidata.

## Mutations

### `put(ctx, input: PutInput): Promise<string>`

Cache (insert or refresh) one provider's normalized facts for an entity. Upserts
by `(kind, provider, externalId)`. `ttlMs` is milliseconds from now; omit it for
an entry that never expires. Returns the entry id.

### `invalidate(ctx, key: EntryKey): Promise<boolean>`

Drop a single cached entry. Returns `true` if a row was deleted, `false` if the
key was not cached.

### `reconcileCacheStats(ctx): Promise<number>`

Backfill up to 100 pre-upgrade cache rows into the maintained counter. A full
batch reschedules another pass. The component runs this hourly; hosts may invoke
it immediately after upgrading.

### `pruneExpired(ctx): Promise<number>`

Delete up to 100 entries whose `expiresAt` is in the past using the expiry
index. A full batch reschedules another pass until the backlog drains. Returns
the number removed by this invocation.

## Queries

### `get(ctx, key: EntryKey): Promise<CacheEntry | null>`

Fetch one cached entry. Returns `null` if the entry is missing or has expired
(an expired entry is treated as a cache miss, not an error).

### `getByIsrc(ctx, isrc: string): Promise<CacheEntry[]>`

Return every fresh cached **track** for an ISRC, across providers — the
cross-provider resolution of one recording. Expired copies are excluded.

### `stats(ctx): Promise<{ total: number }>`

Return the maintained count of cached entries (fresh and expired) without
scanning the cache table.

## Durable catalog and provider actions

The raw cache above is separate from the durable catalog. The current client
also exposes:

| Methods                                                                    | Context  | Result                                                                                             |
| -------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `upsertArtist`, `upsertTrack`, `upsertPlaylist`, `upsertAlbum(ctx, input)` | mutation | Catalog id (`string`)                                                                              |
| `getArtist`, `getTrack`, `getPlaylist`, `getAlbum(ctx, id)`                | query    | Catalog row or `null`                                                                              |
| `getTrackByIsrc(ctx, isrc)`                                                | query    | Unified track or `null`                                                                            |
| `getAlbumByProvider(ctx, provider, providerId)`                            | query    | Album or `null`                                                                                    |
| `searchArtists`, `searchTracks(ctx, query, limit?)`                        | query    | Matching catalog rows                                                                              |
| `selectEligible(ctx, input)`                                               | query    | Artist/track rows; input requires `kind` and `limit`, optionally `excludeIds`, `salt`, `scanLimit` |
| `fetchArtist`, `fetchTrack(ctx, { provider, externalId, force? })`         | action   | Catalog row or `null`; fetches and promotes provider facts                                         |
| `search(ctx, { provider, query, type })`                                   | action   | Provider search hits; `type` is `"artist"` or `"track"`, no promotion                              |
| `resolveByIsrc(ctx, isrc, provider)`                                       | action   | Catalog track or `null`                                                                            |

Input and return types are exported from the [client](../src/client/index.ts)
and [client types](../src/client/types.ts). Provider discovery is an action, not
a reactive query.

## Credentials and imports

`configure(ctx, provider, secrets): Promise<null>` persists a
`Record<string, string>` in the component's `providerConfig` table. The host
reads its own environment and calls this from a trusted mutation. Spotify
expects `{ clientId, clientSecret }`; Apple expects
`{ issuer, keyId, privateKeyPem }`. Reconfiguration replaces the stored secrets.
Never expose this setup mutation or credentials to untrusted clients.

All four import methods require an action context and return
`{ requestId, status }`:

- `importArtist(ctx, { provider, targetMode, name?, providerId?, tracks?, mode?, priority? })`:
  `targetMode` is `"name"` or `"providerId"`; supply its corresponding field.
  `tracks` is `"none"`, `"top"`, or `"all"`; `withTracks` remains an alias for
  top tracks.
- `importTrack(ctx, { provider, providerId, withAlbum?, mode?, priority? })`.
- `importPlaylist` /
  `importAlbum(ctx, { provider, providerId, limit?, mode?, priority? })`.

`mode` is `"import" | "refresh" | "reimport" | "repair"`; `priority` is
`"high" | "normal" | "low"`. Imports use a bounded in-action traversal and
request lifecycle, not a durable, resumable workflow. Inspect returned status; a
returned request is not by itself proof that all provider data was imported.

## Error codes

Reads favor return values over thrown errors: a missing or expired `get` returns
`null`, `getByIsrc` returns `[]`, and `invalidate` on an unknown key returns
`false`. Invalid arguments throw a `ConvexError` whose data is `{ code, message }`:

| Code                | Thrown by                                                                                                   | Meaning                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `INVALID_ARGUMENT`  | `put`, `upsertArtist`, `upsertTrack`, `upsertPlaylist`, `upsertAlbum`, `addSource`                           | A required identifier (`externalId`, `providerId`, `isrc`, artist `name`, source `value`) is empty. |
| `INVALID_TTL`       | `put`                                                                                                       | `ttlMs` is not a finite number (`NaN`, `Infinity`).               |
| `INVALID_LIMIT`     | `searchArtists`, `searchTracks`, `selectEligible`, `importPlaylist`, `importAlbum`, `runRefresh`, `runAutoImport`, `markStale`, `recoverStuckSyncs` | `limit` / `scanLimit` is not a positive integer (some also enforce a maximum). |
| `INVALID_COUNT`     | `consumeBudget`                                                                                             | `count` is not a positive integer.                                |
| `INVALID_CADENCE`   | `addSource`                                                                                                 | `cadenceMs` is not a positive finite number.                      |
| `INVALID_BATCH`     | import maintenance (`recoverAbandoned`, `pruneTerminal`)                                                    | `batch` is not an integer within the allowed range.               |
| `IMPORT_LEASE_LOST` | internal import heartbeat                                                                                   | The import request is no longer running.                          |

The component cannot read `ctx.auth`: authorization and ownership checks are the
host's job, enforced before it calls any write method.

## Cache / Maintenance

- TTL is set per `put` via `ttlMs`; entries without a TTL are stored with a
  never-expires sentinel so the expiry index never sweeps them.
- `get` / `getByIsrc` treat expired entries as misses at read time; the
  in-component hourly `pruneExpired` cron reclaims their storage in bounded,
  self-draining batches.
- The hourly `reconcileCacheStats` cron marks and counts pre-upgrade cache rows
  in bounded, concurrency-safe batches, so the maintained total converges
  without an unbounded migration.

## React hooks

Shipped in the current `./react` entry, wrapping the implemented catalog query
surface. Each hook is a thin wrapper over `convex/react`'s `useQuery` and takes
the host's **own re-exported** query ref as its first argument — the component
never owns the host's `api`. `react` is an optional peer; `convex/react` is part
of the required `convex` peer. Returns `undefined` while loading.

| Hook               | Signature                              | Returns                 |
| ------------------ | -------------------------------------- | ----------------------- |
| `useArtist`        | `(ref, id)`                            | `CatalogArtist \| null` |
| `useTrack`         | `(ref, id)`                            | `CatalogTrack \| null`  |
| `useArtistImage`   | `(ref, provider, providerId, policy?)` | `string \| null`        |
| `useTrackPreview`  | `(ref, provider, providerId, policy?)` | `string \| null`        |
| `useSearchArtists` | `(ref, query, limit?)`                 | `CatalogArtist[]`       |
| `useSearchTracks`  | `(ref, query, limit?)`                 | `CatalogTrack[]`        |

`policy` is a field-source policy: `{ from: Provider }` (single) or
`{ prefer: Provider[] }` (ordered pick-first-available).
