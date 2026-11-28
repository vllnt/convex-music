# API Reference — @vllnt/convex-music

**Compatibility:** `convex@^1.45.0`; optional `react@^18.0.0 || ^19.0.0` for
`./react`. `pnpm test:package` installs and type-checks the packed package with
convex 1.45.0. A transitive dependency (`@convex-dev/rate-limiter` 0.4.3 →
`@convex-dev/batch-worker` 0.3.5 → `convex-helpers`) declares a newer convex
peer (`^1.46.0` in 0.1.136, `^1.49.0` in 0.1.137), so installs below that print
an unmet-peer warning.

## Entry points

| Import                                                | Exports                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@vllnt/convex-music`                                 | `Music` class; types `MusicComponent`, `FetchInput`, `SearchInput`, `ImportArtistInput`, `ImportTrackInput`, `ImportPlaylistInput`, `ImportAlbumInput`, `ImportResult`, `UpsertArtistInput`, `UpsertTrackInput`, `UpsertPlaylistInput`, `UpsertAlbumInput`, `SelectEligibleInput`, `ArtistRef`, `CacheEntry`, `CacheValue`, `CatalogAlbum`, `CatalogArtist`, `CatalogPlaylist`, `CatalogTrack`, `EntryKey`, `NormalizedAlbum`, `NormalizedArtist`, `NormalizedTrack`, `PutInput`, `SearchHit` |
| `@vllnt/convex-music/react`                           | hooks `useArtist`, `useTrack`, `useArtistImage`, `useTrackPreview`, `useSearchArtists`, `useSearchTracks`; types `FieldSourcePolicy`, `ArtistRef` (a query reference, not the root `ArtistRef`), `TrackRef`, `ProjectionRef`, `SearchRef`, `CatalogArtist`, `CatalogTrack`, `Provider`                                                                                                                |
| `@vllnt/convex-music/convex.config` (or `.js`)        | default component config for `app.use(...)`                                                                                                                                                                                                                                                                                                                                                             |
| `@vllnt/convex-music/test`                            | `register(t, name = "music")` for `convex-test` (TypeScript source; needs Vite `import.meta.glob`)                                                                                                                                                                                                                                                                                                      |
| `@vllnt/convex-music/_generated/component` (or `.js`) | type `ComponentApi`                                                                                                                                                                                                                                                                                                                                                                                     |

`Provider` is `"spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer"`.
The root entry uses it but does not export it; import it from `./react` or
write the union. Every `id`, `externalId`, `providerId` and ISRC is an opaque
string: the component stores it as given.

The raw cache (`put`, `get`, ...) and the catalog (`upsert*`, `get*`, `search*`,
`fetch*`, `import*`) are separate tables. Writing one never writes the other.

## Client

### `Music`

```ts
new Music(component: MusicComponent)
```

`component` is the mounted component, `components.music` (or the name passed to
`app.use`). Call query methods with a context that has `runQuery`, mutation
methods with `runMutation` and action methods with `runAction`. The component
does not read auth or environment variables.

### `put`

```ts
put(ctx, input: PutInput): Promise<string>
```

Inserts or replaces the cache entry keyed by `(kind, provider, externalId)` and
returns its id. Every call sets `fetchedAt` to now. `expiresAt` is now plus
`ttlMs`; without `ttlMs` it is `Number.MAX_SAFE_INTEGER` (never expires). A
`ttlMs` of 0 or less writes an already-expired entry. Throws `INVALID_ARGUMENT`
for an empty `externalId` and `INVALID_TTL` for a non-finite `ttlMs`.

### `get`

```ts
get(ctx, key: EntryKey): Promise<CacheEntry | null>
```

Returns the entry, or `null` when it is missing or `expiresAt` is not in the
future.

### `getByIsrc`

```ts
getByIsrc(ctx, isrc: string): Promise<CacheEntry[]>
```

Returns every unexpired `kind: "track"` entry with this `isrc`, across
providers. It reads every cached track row for the ISRC, fresh or expired.

### `invalidate`

```ts
invalidate(ctx, key: EntryKey): Promise<boolean>
```

Deletes the entry. Returns `false` when no entry had this key.

### `pruneExpired`

```ts
pruneExpired(ctx): Promise<number>
```

Deletes up to 100 expired entries and returns how many it deleted. When it
deletes 100, it schedules itself again. A component cron runs it hourly.

### `reconcileCacheStats`

```ts
reconcileCacheStats(ctx): Promise<number>
```

Adds up to 100 cache rows written before the maintained counter existed to the
`stats` total and returns how many. When it counts 100, it schedules itself
again. A component cron runs it hourly.

### `stats`

```ts
stats(ctx): Promise<{ total: number }>
```

Returns the maintained count of cache entries, fresh and expired, without
scanning the table.

### `upsertArtist`

```ts
upsertArtist(ctx, input: UpsertArtistInput): Promise<string>
```

Merges one provider's artist into the catalog and returns the artist id. The
row is found by `(provider, externalId)`, else by the case-normalized name;
otherwise a new row is created. `name` is replaced, `genres` are merged,
`popularity` keeps the highest value, and the provider is added to
`providers`. Sets `syncStatus: "synced"`. Throws `INVALID_ARGUMENT` for an
empty `externalId` or a blank `name`.

### `upsertTrack`

```ts
upsertTrack(ctx, input: UpsertTrackInput): Promise<string>
```

Merges one provider's track into the catalog by `value.isrc` and returns the
track id. `artistIds` are added to the track's existing `artistIds`. Throws a
plain `Error` when `value.isrc` is missing or when `(provider, externalId)` is
already linked to a track with a different ISRC, and `INVALID_ARGUMENT` for an
empty `isrc` or `externalId`.

### `upsertPlaylist`

```ts
upsertPlaylist(ctx, input: UpsertPlaylistInput): Promise<string>
```

Writes the playlist keyed by `(provider, providerId)` and returns its id.
`trackIds` replaces the stored list, unless `membershipComplete` is `false` and
the playlist exists, in which case the ids are added to the stored list.
`membershipComplete` defaults to `true`. Throws `INVALID_ARGUMENT` for an empty
`providerId`.

### `upsertAlbum`

```ts
upsertAlbum(ctx, input: UpsertAlbumInput): Promise<string>
```

Writes the album keyed by `(provider, providerId)` and returns its id, with the
same `trackIds` and `membershipComplete` rules as `upsertPlaylist`. Throws
`INVALID_ARGUMENT` for an empty `providerId`.

### `getArtist`

```ts
getArtist(ctx, id: string): Promise<CatalogArtist | null>
```

### `getTrack`

```ts
getTrack(ctx, id: string): Promise<CatalogTrack | null>
```

### `getPlaylist`

```ts
getPlaylist(ctx, id: string): Promise<CatalogPlaylist | null>
```

### `getAlbum`

```ts
getAlbum(ctx, id: string): Promise<CatalogAlbum | null>
```

The four `get*` methods return the row or `null`. `id` must be an id of that
catalog table; any other string fails Convex argument validation.

### `getAlbumByProvider`

```ts
getAlbumByProvider(ctx, provider: Provider, providerId: string): Promise<CatalogAlbum | null>
```

### `getTrackByIsrc`

```ts
getTrackByIsrc(ctx, isrc: string): Promise<CatalogTrack | null>
```

### `searchArtists`

```ts
searchArtists(ctx, query: string, limit?: number): Promise<CatalogArtist[]>
```

Full-text search on artist `name`, in search-relevance order. Returns at most
`limit` rows (default 20). Throws `INVALID_LIMIT` when `limit` is not a
positive integer.

### `searchTracks`

```ts
searchTracks(ctx, query: string, limit?: number): Promise<CatalogTrack[]>
```

Full-text search on track `title`, with the same `limit` rules as
`searchArtists`.

### `selectEligible`

```ts
selectEligible(ctx, input: SelectEligibleInput): Promise<Array<CatalogArtist | CatalogTrack>>
```

Reads the first `scanLimit` rows of `kind` in creation order (default 1000),
drops `excludeIds`, orders the rest by a deterministic shuffle seeded by `salt`
(default: the current UTC date) and returns the first `limit`. The same inputs
give the same order all day. Throws `INVALID_LIMIT` when `limit` or `scanLimit`
is not a positive integer.

### `fetchArtist`

```ts
fetchArtist(ctx, input: FetchInput): Promise<CatalogArtist | null>
```

Returns the catalog artist linked to `(provider, externalId)`. When there is
none, or `force` is `true`, it fetches the artist from the provider, upserts it
and returns the row. Provider and credential errors are thrown.

### `fetchTrack`

```ts
fetchTrack(ctx, input: FetchInput): Promise<CatalogTrack | null>
```

Same as `fetchArtist` for a track; it also upserts the credited artists.
Throws when the provider's track has no ISRC.

### `search`

```ts
search(ctx, input: SearchInput): Promise<SearchHit[]>
```

Searches the provider and returns normalized hits. Writes no catalog or cache
rows; a Spotify or Apple Music call may store the provider token in the
`action-cache` child component. MusicBrainz and Wikidata return `[]` for
`type: "track"`.

### `resolveByIsrc`

```ts
resolveByIsrc(ctx, isrc: string, provider: Provider): Promise<CatalogTrack | null>
```

Returns the catalog track with this ISRC. Otherwise it looks the ISRC up on
`provider`, upserts the first hit and its artists, and returns the track, or
`null` when the provider has no match (MusicBrainz and Wikidata never match).

### `configure`

```ts
configure(ctx, provider: Provider, secrets: Record<string, string>): Promise<null>
```

Stores or replaces the provider's credentials in the component's
`providerConfig` table and bumps a revision, so the next provider call fetches
a fresh token. Spotify reads
`clientId` and `clientSecret`; Apple Music reads `issuer` (team id), `keyId`
and `privateKeyPem`. Deezer, MusicBrainz and Wikidata need no credentials. Keys
are only checked when a token is needed.

### `importArtist`

```ts
importArtist(ctx, input: ImportArtistInput): Promise<ImportResult>
```

With `targetMode: "name"` it imports the provider's first search hit for
`name`; with `"providerId"` it imports `providerId`. `tracks` is `"none"`
(default), `"top"` (the provider's top tracks) or `"all"` (the tracks of every
album). `withTracks: true` means `"top"` when `tracks` is unset. A failure
while importing tracks still completes the import; the error is appended to
the request's `resultSummary`.

### `importTrack`

```ts
importTrack(ctx, input: ImportTrackInput): Promise<ImportResult>
```

Imports the track and its credited artists. With `withAlbum: true` it also
imports the track's album when the provider supplies an album id.

### `importPlaylist`

```ts
importPlaylist(ctx, input: ImportPlaylistInput): Promise<ImportResult>
```

Imports the playlist, its tracks (at most `limit` when set) and their artists,
then writes the playlist with the imported track ids. With `limit`, or when the
provider returned a partial list, the ids are added to the stored list instead
of replacing it. Throws `INVALID_LIMIT` when `limit` is not a positive integer.

### `importAlbum`

```ts
importAlbum(ctx, input: ImportAlbumInput): Promise<ImportResult>
```

Imports the album, its tracks (at most `limit` when set) and their artists.
Throws `INVALID_LIMIT` when `limit` is not a positive integer.

All four imports create an import request and run it inside the same action;
they are not resumable. When an active request has the same target, mode,
track depth and `withAlbum`, they return that request and its current status
without running; `limit` and `priority` are not compared. A
provider or credential error does not throw: the import returns
`status: "failed"` and the error text (`String(error)`, for example
`Error: no artist found for "x"` or `ProviderHttpError: deezer API error 404:
...`) is in the request's `errorSummary` (read it
with [`imports.queries.getRequest`](#component-functions-without-a-client-method)).
`mode` (`"import" | "refresh" | "reimport" | "repair"`, default `"import"`) and
`priority` (`"high" | "normal" | "low"`, default `"normal"`) are stored on the
request.

## Types

### `MusicComponent`

The function references `Music` calls on `components.music`. The generated
`ComponentApi` is assignable to it.

### `FetchInput`

```ts
type FetchInput = { provider: Provider; externalId: string; force?: boolean };
```

### `SearchInput`

```ts
type SearchInput = { provider: Provider; query: string; type: "artist" | "track" };
```

### `ImportArtistInput`

```ts
type ImportArtistInput = {
  provider: Provider;
  targetMode: "name" | "providerId";
  name?: string;
  providerId?: string;
  withTracks?: boolean;
  tracks?: "none" | "top" | "all";
  mode?: "import" | "refresh" | "reimport" | "repair";
  priority?: "high" | "normal" | "low";
};
```

### `ImportTrackInput`

```ts
type ImportTrackInput = {
  provider: Provider;
  providerId: string;
  withAlbum?: boolean;
  mode?: "import" | "refresh" | "reimport" | "repair";
  priority?: "high" | "normal" | "low";
};
```

### `ImportPlaylistInput`

```ts
type ImportPlaylistInput = {
  provider: Provider;
  providerId: string;
  limit?: number;
  mode?: "import" | "refresh" | "reimport" | "repair";
  priority?: "high" | "normal" | "low";
};
```

### `ImportAlbumInput`

Same fields as `ImportPlaylistInput`; `limit` caps the album's tracks.

### `ImportResult`

```ts
type ImportResult = { requestId: string; status: string };
```

`status` is one of `queued`, `claimed`, `running`, `retry_waiting`,
`completed`, `failed`, `canceled`, `stale`. A finished import returns
`completed` or `failed`; a deduplicated call returns the active request's
status.

### `UpsertArtistInput`

```ts
type UpsertArtistInput = { provider: Provider; externalId: string; value: NormalizedArtist };
```

### `UpsertTrackInput`

```ts
type UpsertTrackInput = {
  provider: Provider;
  externalId: string;
  value: NormalizedTrack;
  artistIds?: string[];
};
```

### `UpsertPlaylistInput`

```ts
type UpsertPlaylistInput = {
  provider: Provider;
  providerId: string;
  title: string;
  description?: string;
  coverUrl?: string;
  url?: string;
  owner?: string;
  trackIds: string[];
  membershipComplete?: boolean;
};
```

### `UpsertAlbumInput`

```ts
type UpsertAlbumInput = {
  provider: Provider;
  providerId: string;
  title: string;
  artistIds: string[];
  releaseDate?: string;
  coverUrl?: string;
  url?: string;
  trackCount?: number;
  trackIds: string[];
  membershipComplete?: boolean;
};
```

`artistIds` and `trackIds` must be catalog ids of the component's `artists` and
`tracks` tables.

### `SelectEligibleInput`

```ts
type SelectEligibleInput = {
  kind: "artist" | "track";
  limit: number;
  excludeIds?: string[];
  salt?: string;
  scanLimit?: number;
};
```

### `ArtistRef`

```ts
interface ArtistRef { name: string; externalId?: string }
```

A credited artist inside a track or album value. `externalId` is the
provider's artist id when known.

### `NormalizedTrack`

```ts
interface NormalizedTrack {
  title: string;
  artists: ArtistRef[];
  isrc?: string;
  genres: string[]; // from Apple Music; [] otherwise
  popularity?: number; // 0-100, from Spotify
  durationMs?: number;
  previewUrl?: string;
  coverUrl?: string;
  url?: string;
  albumId?: string; // provider album id, used by importTrack({ withAlbum })
}
```

### `NormalizedArtist`

```ts
interface NormalizedArtist {
  name: string;
  genres: string[];
  popularity?: number; // from Spotify
  imageUrl?: string;
  url?: string;
  country?: string; // MusicBrainz
  gender?: string; // MusicBrainz / Wikidata
  debutYear?: number; // MusicBrainz / Wikidata
  members?: "solo" | "group"; // MusicBrainz / Wikidata
}
```

### `NormalizedAlbum`

```ts
interface NormalizedAlbum {
  title: string;
  artists: ArtistRef[];
  releaseDate?: string;
  coverUrl?: string;
  url?: string;
  trackCount?: number;
}
```

### `CacheValue`

```ts
type CacheValue = NormalizedTrack | NormalizedArtist | NormalizedAlbum;
```

The value is not tied to `kind`; narrow it with `"name" in value` (artist) or
`"title" in value` (track or album).

### `EntryKey`

```ts
type EntryKey = { kind: "track" | "artist" | "album"; provider: Provider; externalId: string };
```

### `PutInput`

```ts
type PutInput = EntryKey & { isrc?: string; value: CacheValue; ttlMs?: number };
```

### `CacheEntry`

```ts
interface CacheEntry extends EntryKey {
  _id: string;
  _creationTime: number;
  isrc?: string;
  value: CacheValue;
  fetchedAt: number;
  expiresAt: number;
}
```

### `SearchHit`

```ts
type SearchHit =
  | { type: "artist"; externalId: string; value: NormalizedArtist }
  | { type: "track"; externalId: string; value: NormalizedTrack };
```

### `CatalogArtist`

One merged artist row: `_id`, `_creationTime`, `name`, `nameKey` (the
case-normalized name), `genres`, `popularity?`, `imageUrl?`, `country?`,
`gender?`, `debutYear?`, `members?`, `providers` (one
`{ provider, providerId, imageUrl?, url?, popularity?, genres? }` per
provider), `updatedAt`, and the sync and repair fields below.

### `CatalogTrack`

One merged track row: `_id`, `_creationTime`, `isrc`, `title`, `artistIds`,
`genres`, `popularity?`, `durationMs?`, `providers` (one
`{ provider, providerId, previewUrl?, coverUrl?, url? }` per provider),
`updatedAt`, and the sync and repair fields.

### `CatalogPlaylist`

`_id`, `_creationTime`, `title`, `provider`, `providerId`, `description?`,
`coverUrl?`, `url?`, `owner?`, `trackIds` (in import order, not guaranteed to
match the provider's playlist order), `membershipComplete?`,
`snapshotVersion?`, `updatedAt`, and the sync and repair fields.

### `CatalogAlbum`

`_id`, `_creationTime`, `title`, `provider`, `providerId`, `artistIds`,
`releaseDate?`, `coverUrl?`, `url?`, `trackCount?`, `trackIds`,
`membershipComplete?`, `updatedAt`, and the sync and repair fields.

Sync fields on every catalog row: `syncStatus?` (`pending`, `running`,
`synced`, `failed`, `stale`), `syncRetryCount?`, `lastSyncError?`,
`nextSyncAt`, `lastSyncedAt?`. Repair fields: `repairStatus?` (`clean`,
`needs_repair`, `repairing`, `failed_repair`), `repairAttempts?`,
`repairError?`, `lastRepairAt?`, `repairStartedAt?`. Ids are plain strings on
the host.

## React

The hooks wrap `useQuery` from `convex/react` and return `undefined` while
loading. Each takes a query reference from your own `api`: a host query that
calls the matching `Music` method or component query. The component never
reads your `api`.

### `useArtist`

```ts
useArtist(query: ArtistRef, id: string): CatalogArtist | null | undefined
```

### `useTrack`

```ts
useTrack(query: TrackRef, id: string): CatalogTrack | null | undefined
```

### `useArtistImage`

```ts
useArtistImage(query: ProjectionRef, provider: Provider, providerId: string, policy?: FieldSourcePolicy): string | null | undefined
```

For a host query over `components.music.catalog.queries.getArtistImage`.
Returns the image URL of the provider the policy picks, falling back to the
artist's `imageUrl`; without a policy, the artist's `imageUrl`. `null` when no
artist is linked to `(provider, providerId)` or there is no image.

### `useTrackPreview`

```ts
useTrackPreview(query: ProjectionRef, provider: Provider, providerId: string, policy?: FieldSourcePolicy): string | null | undefined
```

For a host query over `components.music.catalog.queries.getTrackPreview`.
Returns the preview URL of the provider the policy picks, or `null`. Without a
policy it returns `null`.

### `useSearchArtists`

```ts
useSearchArtists(query: SearchRef<CatalogArtist>, search: string, limit?: number): CatalogArtist[] | undefined
```

### `useSearchTracks`

```ts
useSearchTracks(query: SearchRef<CatalogTrack>, search: string, limit?: number): CatalogTrack[] | undefined
```

### `FieldSourcePolicy`

```ts
type FieldSourcePolicy = { from: Provider } | { prefer: Provider[] };
```

`from` takes that provider's value; `prefer` takes the first provider in the
list that has a value.

### `ArtistRef` (React query ref)

```ts
type ArtistRef = FunctionReference<"query", "public", { id: string }, CatalogArtist | null>;
```

### `TrackRef`

```ts
type TrackRef = FunctionReference<"query", "public", { id: string }, CatalogTrack | null>;
```

### `ProjectionRef`

```ts
type ProjectionRef = FunctionReference<
  "query",
  "public",
  { provider: Provider; providerId: string; policy?: FieldSourcePolicy },
  string | null
>;
```

### `SearchRef`

```ts
type SearchRef<T> = FunctionReference<"query", "public", { query: string; limit?: number }, T[]>;
```

### `Provider`

```ts
type Provider = "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
```

`./react` also re-exports `CatalogArtist` and `CatalogTrack` from the root.

## Other entry points

### `convex.config`

```ts
import music from "@vllnt/convex-music/convex.config";
```

The default export is the component definition (`defineComponent("music")`).
Pass it to `app.use(music)` or `app.use(music, { name })`. It mounts the
`@convex-dev/action-cache` and `@convex-dev/rate-limiter` child components.

### `register`

```ts
register(t: TestConvex<SchemaDefinition<GenericSchema, boolean>>, name?: string): void
```

Registers the component and its two child components with a `convex-test`
instance under `name` (default `"music"`). Use the mount name you passed to
`app.use`.

### `ComponentApi`

The generated type of `components.music`, from
`@vllnt/convex-music/_generated/component`. It lists every public component
function, including the ones below.

## Component functions without a client method

Call these from your own host functions with `ctx.runQuery`,
`ctx.runMutation` or `ctx.runAction` on `components.music.<path>`.

| Path                                | Kind     | Args                                                                | Returns                                         |
| ----------------------------------- | -------- | ------------------------------------------------------------------- | ----------------------------------------------- |
| `catalog.queries.getArtistImage`    | query    | `{ provider, providerId, policy? }`                                 | `string \| null` (see `useArtistImage`)         |
| `catalog.queries.getTrackPreview`   | query    | `{ provider, providerId, policy? }`                                 | `string \| null` (see `useTrackPreview`)        |
| `sources.mutations.addSource`       | mutation | `{ kind, by, value, provider?, withTracks?, cadenceMs?, enabled? }` | Source id                                       |
| `sources.mutations.removeSource`    | mutation | `{ sourceId }`                                                      | `null`                                          |
| `sources.mutations.setSourceEnabled` | mutation | `{ sourceId, enabled }`                                            | `null`                                          |
| `sources.queries.listSources`       | query    | `{ enabledOnly?, limit? }` (default 100)                            | Source rows                                     |
| `sources.actions.runAutoImport`     | action   | `{ limit?, now? }` (default 10)                                     | `{ imported, skipped }`                         |
| `sources.actions.runRefresh`        | action   | `{ kind, limit? }` (default 10)                                     | `{ refreshed }`                                 |
| `sources.actions.consumeBudget`     | action   | `{ budget: "autoImport" \| "refresh", count }`                      | `boolean` (whether the budget allowed it)       |
| `imports.queries.getRequest`        | query    | `{ requestId }`                                                     | Import request or `null`                        |
| `imports.queries.listRequests`      | query    | `{ status, limit? }` (default 50, newest first)                     | Import requests                                 |
| `imports.mutations.createRequest`   | mutation | request fields                                                      | `{ requestId, deduped, status }` (does not run) |
| `imports.mutations.recoverAbandoned` | mutation | `{ status, before?, batch? }` (batch 1..500, default 100)          | Number marked `stale`                           |
| `imports.mutations.pruneTerminal`   | mutation | `{ status, before?, batch? }` (batch 1..500, default 100)           | Number deleted                                  |
| `sync.queries.listStale`            | query    | `{ kind, limit? }` (default 100)                                    | Stale artist or track rows                      |
| `sync.mutations.markStale`          | mutation | `{ kind, limit?, now? }` (limit 1..500, default 200)                | Number marked `stale`                           |
| `sync.mutations.recoverStuckSyncs`  | mutation | `{ kind, leaseMs?, now?, limit? }` (lease 10 min, limit 200)        | Number moved from `running` back to `stale`     |

`addSource` `kind` is `"artist" | "track" | "playlist" | "album"` and `by` is
`"name" | "url" | "isrc" | "providerId" | "entityId"`, but the auto-import
sweep only imports artists by `name` or `providerId` and tracks, playlists and
albums by `providerId`. Any other pair makes the sweep throw
`unsupported source target` at that source. A source is due when it was never
imported, or when `cadenceMs` has passed since its last import. A source is
marked imported only when its import completes, so a failing source is retried
every hour; without `cadenceMs` it stops after the first successful import.
Each run takes at most 10 due sources; sources without `provider` count toward
those 10 and are then skipped. The
full argument validators are in `src/component/`, which ships in the package.

## Scheduled jobs

Every mount runs these crons:

| Interval | Job                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------- |
| 1 hour   | `reconcileCacheStats`, `pruneExpired`                                                             |
| 1 hour   | Auto-import: when an enabled source is due, run `runAutoImport` (first 100 enabled sources)      |
| 1 hour   | `recoverStuckSyncs` for artists and tracks; `recoverAbandoned` for each active import status     |
| 6 hours  | `runRefresh` for artists and for tracks (10 rows each)                                            |
| 24 hours | `markStale` for artists and for tracks; `pruneTerminal` for each final import status (30 days)    |

An artist or track row becomes stale after its freshness window: 7 days when
`popularity` is 70 or more, 30 days when 40 or more, otherwise 90 days. This
freshness refresh covers only artists and tracks; albums and playlists update
only through a source's `cadenceMs` or a manual import. Auto-import and refresh
each consume a token-bucket budget of 60 per hour.

## Errors

Invalid input throws a `ConvexError` whose `data` is `{ code, message }`.

| Code                | Thrown by                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_ARGUMENT`  | `put`, `upsertArtist`, `upsertTrack`, `upsertPlaylist`, `upsertAlbum`, `sources.mutations.addSource`: an empty required string                       |
| `INVALID_TTL`       | `put`: non-finite `ttlMs`                                                                                                                           |
| `INVALID_LIMIT`     | `searchArtists`, `searchTracks`, `selectEligible`, `importPlaylist`, `importAlbum`, `runRefresh`, `runAutoImport` (positive integer); `markStale` (1..500) |
| `INVALID_COUNT`     | `sources.actions.consumeBudget`: `count` not a positive integer                                                                                     |
| `INVALID_CADENCE`   | `sources.mutations.addSource`: `cadenceMs` not a positive finite number                                                                             |
| `INVALID_BATCH`     | `imports.mutations.recoverAbandoned`, `imports.mutations.pruneTerminal`: `batch` outside 1..500                                                    |
| `IMPORT_LEASE_LOST` | Internal `imports.mutations.heartbeat` only; the host never sees it. Happens when the request left `running` mid-import, for example after a host call to `recoverAbandoned` with a later `before`; the import then throws the plain `Error` `Invalid import transition: stale -> failed` |

Missing and expired reads return `null` or `[]` instead of throwing. Plain
`Error` messages (credentials, provider HTTP errors, missing ISRC) and their
fixes are in the
[README errors table](../README.md#errors-and-fixes).
