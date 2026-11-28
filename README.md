# @vllnt/convex-music

TypeScript Convex component for a cached music catalog: tracks, artists, albums
and playlists from Spotify, Apple Music and Deezer, plus MusicBrainz artists.

## For coding agents

Docs for the installed version are in `node_modules/@vllnt/convex-music/`:
`docs/API.md`, `llms.txt`, `CHANGELOG.md` and the TypeScript `src/`. Read them
before writing code against this package.

## When to use

- Use it when a Convex app needs a music catalog that it can search and read in
  queries: artists, tracks keyed by ISRC, albums and playlists.
- Use it when artist and track facts come from more than one provider and must
  merge into one row.
- Use it when imports and periodic refreshes should run inside Convex.
- Do not use it when you only need to cache one provider API call: use
  `@convex-dev/action-cache`.

## Install

```bash
pnpm add @vllnt/convex-music
```

Peer dependency: `convex@^1.45.0`. Unreleased builds from `main` use the
`canary` dist-tag.

## Quick start

```ts
// convex/convex.config.ts
import music from "@vllnt/convex-music/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(music);
export default app;
```

```ts
// convex/music.ts
import { Music } from "@vllnt/convex-music";
import { v } from "convex/values";

import { components } from "./_generated/api";
import { action, internalMutation, query } from "./_generated/server";

const music = new Music(components.music);

export const setup = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("set the Spotify env vars");
    return music.configure(ctx, "spotify", { clientId, clientSecret });
  },
});

export const importArtist = action({
  args: { name: v.string() },
  returns: v.object({ requestId: v.string(), status: v.string() }),
  handler: async (ctx, { name }) => {
    const user = await ctx.auth.getUserIdentity();
    if (user === null) throw new Error("not signed in");
    return music.importArtist(ctx, {
      provider: "spotify",
      targetMode: "name",
      name,
      tracks: "top",
    });
  },
});

export const searchArtists = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: (ctx, args) => music.searchArtists(ctx, args.query, args.limit),
});
```

Run `npx convex dev` once to generate `components.music`. Then set the Spotify
credentials and store them in the component:

```bash
npx convex env set SPOTIFY_CLIENT_ID <client id>
npx convex env set SPOTIFY_CLIENT_SECRET <client secret>
npx convex run music:setup
```

A component cannot read the deployment's environment variables, so the host
reads them and passes them to `configure`. The component never reads auth; the
host checks it. Host functions that return component rows use a loose return
validator (`v.any()`), because a host cannot validate the component's
`v.id("artists")` ids; the TypeScript types come from the `Music` methods.

[![CI status](https://github.com/vllnt/convex-music/actions/workflows/ci.yml/badge.svg)](https://github.com/vllnt/convex-music/actions/workflows/ci.yml)

## API

Full reference: [docs/API.md](docs/API.md).

| Export                                                                                      | Import from                                 | What it does                                                         |
| ------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| [`Music`](docs/API.md#music)                                                                | `@vllnt/convex-music`                       | Host client: `new Music(components.music)`                           |
| [`put(ctx, input)`](docs/API.md#put)                                                        | `Music` method, mutation                    | Cache one provider's facts with an optional TTL; returns the entry id |
| [`get(ctx, key)`](docs/API.md#get)                                                          | `Music` method, query                       | One cached entry, or `null` when missing or expired                  |
| [`getByIsrc(ctx, isrc)`](docs/API.md#getbyisrc)                                             | `Music` method, query                       | Every fresh cached track for an ISRC                                 |
| [`invalidate(ctx, key)`](docs/API.md#invalidate)                                            | `Music` method, mutation                    | Delete one cached entry; returns `boolean`                           |
| [`pruneExpired(ctx)`](docs/API.md#pruneexpired)                                             | `Music` method, mutation                    | Delete up to 100 expired entries; returns the count                  |
| [`reconcileCacheStats(ctx)`](docs/API.md#reconcilecachestats)                               | `Music` method, mutation                    | Count up to 100 pre-upgrade cache rows                               |
| [`stats(ctx)`](docs/API.md#stats)                                                           | `Music` method, query                       | `{ total }` cached entries, fresh and expired                        |
| [`upsertArtist(ctx, input)`](docs/API.md#upsertartist)                                      | `Music` method, mutation                    | Merge one provider's artist into the catalog; returns its id         |
| [`upsertTrack(ctx, input)`](docs/API.md#upserttrack)                                        | `Music` method, mutation                    | Merge one provider's track (ISRC required); returns its id           |
| [`upsertPlaylist(ctx, input)`](docs/API.md#upsertplaylist)                                  | `Music` method, mutation                    | Write a playlist and its track ids; returns its id                   |
| [`upsertAlbum(ctx, input)`](docs/API.md#upsertalbum)                                        | `Music` method, mutation                    | Write an album and its track ids; returns its id                     |
| [`getArtist(ctx, id)`](docs/API.md#getartist)                                               | `Music` method, query                       | Catalog artist or `null`                                             |
| [`getTrack(ctx, id)`](docs/API.md#gettrack)                                                 | `Music` method, query                       | Catalog track or `null`                                              |
| [`getPlaylist(ctx, id)`](docs/API.md#getplaylist)                                           | `Music` method, query                       | Catalog playlist or `null`                                           |
| [`getAlbum(ctx, id)`](docs/API.md#getalbum)                                                 | `Music` method, query                       | Catalog album or `null`                                              |
| [`getAlbumByProvider(ctx, provider, providerId)`](docs/API.md#getalbumbyprovider)           | `Music` method, query                       | Catalog album by provider id, or `null`                              |
| [`getTrackByIsrc(ctx, isrc)`](docs/API.md#gettrackbyisrc)                                   | `Music` method, query                       | Catalog track by ISRC, or `null`                                     |
| [`searchArtists(ctx, query, limit?)`](docs/API.md#searchartists)                            | `Music` method, query                       | Full-text search on artist names (default 20 results)                |
| [`searchTracks(ctx, query, limit?)`](docs/API.md#searchtracks)                              | `Music` method, query                       | Full-text search on track titles (default 20 results)                |
| [`selectEligible(ctx, input)`](docs/API.md#selecteligible)                                  | `Music` method, query                       | Stable daily rotation of artists or tracks                           |
| [`fetchArtist(ctx, input)`](docs/API.md#fetchartist)                                        | `Music` method, action                      | Catalog artist, fetched from the provider when missing               |
| [`fetchTrack(ctx, input)`](docs/API.md#fetchtrack)                                          | `Music` method, action                      | Catalog track, fetched from the provider when missing                |
| [`search(ctx, input)`](docs/API.md#search)                                                  | `Music` method, action                      | Search a provider; writes no catalog or cache rows                   |
| [`resolveByIsrc(ctx, isrc, provider)`](docs/API.md#resolvebyisrc)                           | `Music` method, action                      | Catalog track by ISRC, else look it up on a provider and store it    |
| [`configure(ctx, provider, secrets)`](docs/API.md#configure)                                | `Music` method, mutation                    | Store or replace a provider's credentials                            |
| [`importArtist(ctx, input)`](docs/API.md#importartist)                                      | `Music` method, action                      | Import an artist by name or id, optionally with tracks               |
| [`importTrack(ctx, input)`](docs/API.md#importtrack)                                        | `Music` method, action                      | Import a track and its artists, optionally its album                 |
| [`importPlaylist(ctx, input)`](docs/API.md#importplaylist)                                  | `Music` method, action                      | Import a playlist and its tracks                                     |
| [`importAlbum(ctx, input)`](docs/API.md#importalbum)                                        | `Music` method, action                      | Import an album, its tracks and artists                              |
| [`MusicComponent`](docs/API.md#musiccomponent)                                              | `@vllnt/convex-music` (type)                | Type of `components.music` that `Music` accepts                      |
| [`FetchInput`](docs/API.md#fetchinput)                                                      | `@vllnt/convex-music` (type)                | `{ provider, externalId, force? }`                                   |
| [`SearchInput`](docs/API.md#searchinput)                                                    | `@vllnt/convex-music` (type)                | `{ provider, query, type }`                                          |
| [`ImportArtistInput`](docs/API.md#importartistinput)                                        | `@vllnt/convex-music` (type)                | Input of `importArtist`                                              |
| [`ImportTrackInput`](docs/API.md#importtrackinput)                                          | `@vllnt/convex-music` (type)                | Input of `importTrack`                                               |
| [`ImportPlaylistInput`](docs/API.md#importplaylistinput)                                    | `@vllnt/convex-music` (type)                | Input of `importPlaylist`                                            |
| [`ImportAlbumInput`](docs/API.md#importalbuminput)                                          | `@vllnt/convex-music` (type)                | Input of `importAlbum`                                               |
| [`ImportResult`](docs/API.md#importresult)                                                  | `@vllnt/convex-music` (type)                | `{ requestId, status }`                                              |
| [`UpsertArtistInput`](docs/API.md#upsertartistinput)                                        | `@vllnt/convex-music` (type)                | Input of `upsertArtist`                                              |
| [`UpsertTrackInput`](docs/API.md#upserttrackinput)                                          | `@vllnt/convex-music` (type)                | Input of `upsertTrack`                                               |
| [`UpsertPlaylistInput`](docs/API.md#upsertplaylistinput)                                    | `@vllnt/convex-music` (type)                | Input of `upsertPlaylist`                                            |
| [`UpsertAlbumInput`](docs/API.md#upsertalbuminput)                                          | `@vllnt/convex-music` (type)                | Input of `upsertAlbum`                                               |
| [`SelectEligibleInput`](docs/API.md#selecteligibleinput)                                    | `@vllnt/convex-music` (type)                | Input of `selectEligible`                                            |
| [`ArtistRef`](docs/API.md#artistref)                                                        | `@vllnt/convex-music` (type)                | `{ name, externalId? }` credited artist                              |
| [`CacheEntry`](docs/API.md#cacheentry)                                                      | `@vllnt/convex-music` (type)                | A cached entry returned by `get` and `getByIsrc`                     |
| [`CacheValue`](docs/API.md#cachevalue)                                                      | `@vllnt/convex-music` (type)                | `NormalizedTrack \| NormalizedArtist \| NormalizedAlbum`             |
| [`CatalogArtist`](docs/API.md#catalogartist)                                                | `@vllnt/convex-music` and `./react` (type)  | Catalog artist row                                                   |
| [`CatalogTrack`](docs/API.md#catalogtrack)                                                  | `@vllnt/convex-music` and `./react` (type)  | Catalog track row                                                    |
| [`CatalogPlaylist`](docs/API.md#catalogplaylist)                                            | `@vllnt/convex-music` (type)                | Catalog playlist row                                                 |
| [`CatalogAlbum`](docs/API.md#catalogalbum)                                                  | `@vllnt/convex-music` (type)                | Catalog album row                                                    |
| [`EntryKey`](docs/API.md#entrykey)                                                          | `@vllnt/convex-music` (type)                | `{ kind, provider, externalId }` cache key                           |
| [`NormalizedArtist`](docs/API.md#normalizedartist)                                          | `@vllnt/convex-music` (type)                | Provider-neutral artist facts                                        |
| [`NormalizedTrack`](docs/API.md#normalizedtrack)                                            | `@vllnt/convex-music` (type)                | Provider-neutral track facts                                         |
| [`NormalizedAlbum`](docs/API.md#normalizedalbum)                                            | `@vllnt/convex-music` (type)                | Provider-neutral album facts                                         |
| [`PutInput`](docs/API.md#putinput)                                                          | `@vllnt/convex-music` (type)                | Input of `put`                                                       |
| [`SearchHit`](docs/API.md#searchhit)                                                        | `@vllnt/convex-music` (type)                | Result item of `search`                                              |
| [`useArtist`](docs/API.md#useartist)                                                        | `@vllnt/convex-music/react`                 | React hook: one catalog artist                                       |
| [`useTrack`](docs/API.md#usetrack)                                                          | `@vllnt/convex-music/react`                 | React hook: one catalog track                                        |
| [`useArtistImage`](docs/API.md#useartistimage)                                              | `@vllnt/convex-music/react`                 | React hook: artist image URL chosen by provider                      |
| [`useTrackPreview`](docs/API.md#usetrackpreview)                                            | `@vllnt/convex-music/react`                 | React hook: track preview URL chosen by provider                     |
| [`useSearchArtists`](docs/API.md#usesearchartists)                                          | `@vllnt/convex-music/react`                 | React hook: search artists                                           |
| [`useSearchTracks`](docs/API.md#usesearchtracks)                                            | `@vllnt/convex-music/react`                 | React hook: search tracks                                            |
| [`FieldSourcePolicy`](docs/API.md#fieldsourcepolicy)                                        | `@vllnt/convex-music/react` (type)          | `{ from }` or `{ prefer }` provider choice                           |
| [`ArtistRef` (React)](docs/API.md#artistref-react-query-ref)                                | `@vllnt/convex-music/react` (type)          | Query reference type taken by `useArtist`                            |
| [`TrackRef`](docs/API.md#trackref)                                                          | `@vllnt/convex-music/react` (type)          | Query reference type taken by `useTrack`                             |
| [`ProjectionRef`](docs/API.md#projectionref)                                                | `@vllnt/convex-music/react` (type)          | Query reference type taken by the image and preview hooks            |
| [`SearchRef`](docs/API.md#searchref)                                                        | `@vllnt/convex-music/react` (type)          | Query reference type taken by the search hooks                       |
| [`Provider`](docs/API.md#provider)                                                          | `@vllnt/convex-music/react` (type)          | `"spotify" \| "apple" \| "musicbrainz" \| "wikidata" \| "deezer"`    |
| [`default` (component config)](docs/API.md#convexconfig)                                    | `@vllnt/convex-music/convex.config`         | Pass to `app.use(...)`                                               |
| [`register`](docs/API.md#register)                                                          | `@vllnt/convex-music/test`                  | Mount the component in `convex-test`                                 |
| [`ComponentApi`](docs/API.md#componentapi)                                                  | `@vllnt/convex-music/_generated/component`  | Generated type of the mounted component                              |

Sources, import requests and stale rows have no `Music` method; call them on
`components.music`. See
[component functions without a client method](docs/API.md#component-functions-without-a-client-method).

## Common tasks

Fetch a track on first use, and look up the same recording by ISRC. Both are
actions: they call the provider only when the catalog has no row yet.

```ts
// convex/tracks.ts
import { Music } from "@vllnt/convex-music";
import { v } from "convex/values";

import { components } from "./_generated/api";
import { action } from "./_generated/server";

const music = new Music(components.music);
const track = v.union(
  v.null(),
  v.object({ id: v.string(), isrc: v.string(), title: v.string() }),
);

export const trackFromSpotify = action({
  args: { spotifyId: v.string() },
  returns: track,
  handler: async (ctx, { spotifyId }) => {
    const row = await music.fetchTrack(ctx, {
      provider: "spotify",
      externalId: spotifyId,
    });
    return row && { id: row._id, isrc: row.isrc, title: row.title };
  },
});

export const trackByIsrc = action({
  args: { isrc: v.string() },
  returns: track,
  handler: async (ctx, { isrc }) => {
    const row = await music.resolveByIsrc(ctx, isrc, "deezer");
    return row && { id: row._id, isrc: row.isrc, title: row.title };
  },
});
```

Keep a playlist synced. A registered source is imported by the hourly
auto-import cron, then again after each `cadenceMs`. Read the outcome of an
import from its request row:

```ts
// convex/sources.ts
import { v } from "convex/values";

import { components } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";

export const followPlaylist = internalMutation({
  args: { playlistId: v.string() },
  returns: v.string(),
  handler: (ctx, { playlistId }) =>
    ctx.runMutation(components.music.sources.mutations.addSource, {
      kind: "playlist",
      by: "providerId",
      value: playlistId,
      provider: "spotify",
      cadenceMs: 24 * 60 * 60 * 1000,
    }),
});

export const importStatus = internalQuery({
  args: { requestId: v.string() },
  returns: v.union(
    v.null(),
    v.object({ status: v.string(), error: v.optional(v.string()) }),
  ),
  handler: async (ctx, { requestId }) => {
    const request = await ctx.runQuery(
      components.music.imports.queries.getRequest,
      { requestId },
    );
    return request && { status: request.status, error: request.errorSummary };
  },
});
```

Cache one provider response for a day without touching the catalog:

```ts
// convex/cache.ts
import { Music } from "@vllnt/convex-music";
import { v } from "convex/values";

import { components } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";

const music = new Music(components.music);

export const cacheArtist = internalMutation({
  args: { externalId: v.string(), name: v.string() },
  returns: v.string(),
  handler: (ctx, { externalId, name }) =>
    music.put(ctx, {
      kind: "artist",
      provider: "spotify",
      externalId,
      value: { name, genres: [] },
      ttlMs: 24 * 60 * 60 * 1000,
    }),
});

export const cachedArtistName = query({
  args: { externalId: v.string() },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, { externalId }) => {
    const entry = await music.get(ctx, {
      kind: "artist",
      provider: "spotify",
      externalId,
    });
    return entry === null || !("name" in entry.value) ? null : entry.value.name;
  },
});
```

Pick today's artist. `selectEligible` returns the same order all UTC day; the
host stores the pick and the ids it must not repeat:

```ts
// convex/daily.ts
import { Music } from "@vllnt/convex-music";
import { v } from "convex/values";

import { components } from "./_generated/api";
import { query } from "./_generated/server";

const music = new Music(components.music);

export const dailyArtist = query({
  args: { recentIds: v.array(v.string()) },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, { recentIds }) => {
    const [pick] = await music.selectEligible(ctx, {
      kind: "artist",
      limit: 1,
      excludeIds: recentIds,
    });
    return pick?._id ?? null;
  },
});
```

Read the catalog from React. The hooks take your own query references, here
`searchArtists` from the Quick start:

```ts
// src/use-artist-search.ts
import { useSearchArtists } from "@vllnt/convex-music/react";

import { api } from "../convex/_generated/api";

export function useArtistNames(query: string): string[] | undefined {
  return useSearchArtists(api.music.searchArtists, query, 10)?.map(
    (artist) => artist.name,
  );
}
```

Keep two separate catalogs by mounting the component twice. Each mount has its
own tables, credentials and crons:

```ts
// convex/convex.config.ts
import music from "@vllnt/convex-music/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(music, { name: "artistCatalog" });
app.use(music, { name: "trackCatalog" });
export default app;
```

## Errors and fixes

Invalid input throws a `ConvexError` whose `data` is `{ code, message }`. Catch
it in the host with `error instanceof ConvexError` and read `error.data.code`.

| Code                | Message                                                         | Cause                                                                                                                                                 | Fix                                                                            |
| ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `INVALID_ARGUMENT`  | `<field> must not be empty`                                     | An empty `externalId` (`put`, `upsertArtist`, `upsertTrack`), artist `name`, `isrc`, `providerId` (`upsertPlaylist`, `upsertAlbum`) or source `value` | Pass a non-empty string                                                        |
| `INVALID_TTL`       | `ttlMs must be a finite number of milliseconds`                 | `put` got `ttlMs` `NaN` or `Infinity`                                                                                                                 | Pass a finite number, or omit `ttlMs` for an entry that never expires          |
| `INVALID_LIMIT`     | `limit must be a positive integer` (or `scanLimit`)             | `searchArtists`, `searchTracks`, `selectEligible`, `importPlaylist`, `importAlbum`, `runRefresh` or `runAutoImport` got a limit below 1 or fractional | Pass a positive integer, or omit it                                            |
| `INVALID_LIMIT`     | `limit must be an integer between 1 and 500`                    | `sync.mutations.markStale` got a limit outside 1..500                                                                                                 | Pass 1..500, or omit it (default 200)                                          |
| `INVALID_COUNT`     | `count must be a positive integer`                              | `sources.actions.consumeBudget` got a count below 1 or fractional                                                                                     | Pass a positive integer                                                        |
| `INVALID_CADENCE`   | `cadenceMs must be a positive finite number of milliseconds`    | `addSource` got `cadenceMs` 0, negative, `NaN` or `Infinity`                                                                                          | Pass a positive number, or omit it to stop after the first successful import   |
| `INVALID_BATCH`     | `batch must be an integer between 1 and 500`                    | `imports.mutations.recoverAbandoned` or `pruneTerminal` got a batch outside 1..500                                                                    | Pass 1..500, or omit it (default 100)                                          |
| `IMPORT_LEASE_LOST` | `import request is no longer running`                           | Internal; the host never sees this code. The import's request left `running` while the import ran, for example because the host called `imports.mutations.recoverAbandoned` with a `before` later than the request's last heartbeat. The import then throws the plain `Error` `Invalid import transition: stale -> failed` | Call `recoverAbandoned` with its default `before` (30 minutes for `running`; live imports renew their request at each step), then start the import again |

These are thrown as a plain `Error` (no code). `fetchArtist`, `fetchTrack`,
`search`, `resolveByIsrc` and the catalog upserts throw them. Import methods
catch them instead: the import returns `status: "failed"` and stores the
error text (`String(error)`) in the request's `errorSummary`, for example
`Error: no artist found for "x"` or `ProviderHttpError: deezer API error 404:
...`. The exception is `Invalid import transition`, which the import throws.

| Message                                                                     | Cause                                                                                              | Fix                                                                                      |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `upsertTrack requires the track to carry an ISRC`                           | `upsertTrack` got a value with no `isrc`, or a fetched provider track had none                      | Pass `value.isrc`; catalog tracks are keyed by ISRC                                      |
| `provider <p> id <id> changed ISRC <old> -> <new>; refusing to silently re-link` | A provider id already linked to a track with another ISRC                                        | Check the provider data; the existing link is kept                                       |
| `No credentials configured for provider "<p>". Call configure() first.`     | A Spotify or Apple call before `configure`                                                         | Call `configure` for that provider                                                       |
| `Missing required credential: <key>`                                        | The stored secrets lack `clientId` / `clientSecret` (Spotify) or `issuer` / `keyId` / `privateKeyPem` (Apple), or one is empty | Call `configure` again with every key                                         |
| `Apple private key PEM is empty` / `Apple private key PEM is malformed`     | `privateKeyPem` has no key body, or its body is not valid base64 (for example literal `\n` escapes) | Pass the `.p8` key text with real line breaks, including its header and footer lines     |
| A Web Crypto `importKey` error                                              | `privateKeyPem` is valid base64 but not a PKCS#8 P-256 key, for example a `BEGIN EC PRIVATE KEY` key | Convert it with `openssl pkcs8 -topk8 -nocrypt -in key.pem`, or pass the original `.p8` |
| `<provider> API error <status>: <body>`                                     | The provider answered a non-retryable status, or a retryable one on the last attempt                | Check the id and credentials; retry later on `429` / `5xx`                               |
| `<provider> API timeout after <ms>ms`                                       | The last attempt took longer than 15 seconds                                                       | Retry later                                                                              |
| `musicbrainz: <method> not supported (facts-only provider)` (or `wikidata:`) | A track, album, playlist or artist-tracks call on MusicBrainz or Wikidata                         | Use Spotify, Apple or Deezer for those; MusicBrainz and Wikidata supply artist facts     |
| `apple: <kind> "<id>" not found` / `wikidata: entity "<id>" not found`      | The provider has no entity with this id                                                            | Check the id                                                                             |
| `no artist found for "<name>"`                                              | `importArtist` by name found no search result                                                      | Check the name, or import by `providerId`                                                |
| `import by providerId requires a providerId` (or `track`, `playlist`, `album import requires a providerId`) | An import got an empty `providerId`, or `targetMode: "providerId"` without one | Pass the provider id                                                                     |
| `Invalid import transition: <from> -> <to>`                                 | An import tried to finish a request that is no longer `running`, after `IMPORT_LEASE_LOST`         | See `IMPORT_LEASE_LOST`                                                                  |
| `unsupported source target: <kind> by <by>`                                 | A source whose `kind` / `by` pair the auto-import sweep cannot import; the sweep action stops there | Remove the source; see [Limits and gotchas](#limits-and-gotchas) for supported pairs     |

Arguments of the wrong type, unknown fields, or an id from another table are
rejected by Convex argument validation before the component runs.

## Limits and gotchas

- Searches return at most `limit` rows (default 20). `selectEligible` reads
  only the first `scanLimit` rows by creation time (default 1000); rows after
  that are never picked.
- `get` and `getByIsrc` hide expired entries, but the rows stay until the
  hourly prune deletes them, 100 per batch. `stats` counts expired rows too.
  `getByIsrc` reads every cached track row for the ISRC, fresh or expired,
  and returns the fresh ones.
- `put` without `ttlMs` never expires. A `ttlMs` of 0 or less writes an entry
  that is already expired.
- Catalog tracks need an ISRC. Imports skip provider tracks without one.
  Playlist and album imports first look those tracks up again in one batch
  when the provider supports it (Spotify and Apple Music).
- Artists merge by provider id, else by case-normalized name: two different
  artists with the same name become one row.
- MusicBrainz and Wikidata supply artists only: artist fetch and artist search
  work, track search and ISRC lookup return no results, and track, album,
  playlist and artist-tracks calls throw.
- An import runs inside one action; it is not resumable. A second import with
  the same target, mode, track depth and `withAlbum` while one is active
  returns that request and its current status without running again; `limit`
  and `priority` are not compared, so a different `limit` is ignored.
  `ImportResult.status` is typed `string`; the values are `queued`, `claimed`,
  `running`, `retry_waiting`, `completed`, `failed`, `canceled` and `stale`.
- An artist import that fails while importing tracks still completes; the
  error is in the request's `resultSummary`.
- The component's crons always run. Every 24 hours artist and track rows past
  their freshness window (popularity 70+: 7 days, 40+: 30 days, else 90 days)
  are marked `stale`, and every 6 hours up to 10 stale artists and 10 stale tracks are
  imported again from their providers. Imports and refreshes each have a budget
  of 60 per hour. This freshness refresh covers only artists and tracks;
  albums and playlists update only through a source's `cadenceMs` or a manual
  import.
- The auto-import sweep reads the first 100 enabled sources and takes at most
  10 due ones per hourly run. Sources without `provider` count toward those 10
  and are then skipped, so 10 of them block every other source. A source is
  marked imported only when its import completes: a source without `cadenceMs`
  is imported once after its first success, and a failing source is retried
  every hour. The sweep imports artists by `name` or
  `providerId`, and tracks, playlists and albums by `providerId`; any other
  pair stops the sweep at that source every run.
- Import requests in a final state are deleted after 30 days. Active requests
  not updated for 10 minutes (30 minutes when `running`) are marked `stale`.
- Credentials are stored in the component's `providerConfig` table and stay
  until replaced; there is no delete method.
- `[planned]` Multiple catalogs per mount, each with its own providers and
  field-source policy. Today, mount the component once per catalog.
- `[planned]` Automatic artist-image sync with a configurable provider choice.

## Compatibility

- Peer dependency `convex@^1.45.0`. CI runs the unit tests on the locked convex
  version (1.51.0), and `pnpm test:package` installs, type-checks and runs the
  packed package against convex 1.45.0.
- Installing with an older convex can print an unmet-peer warning: a
  transitive dependency (`@convex-dev/rate-limiter` 0.4.3 →
  `@convex-dev/batch-worker` 0.3.5 → `convex-helpers` ^0.1.127) declares a
  newer convex peer. `convex-helpers` 0.1.136 declares `convex@^1.46.0`;
  0.1.137, the latest today, declares `convex@^1.49.0`.
- Optional peer dependency `react@^18.0.0 || ^19.0.0`, only for
  `@vllnt/convex-music/react`.
- ES modules only. The component runs in the default Convex runtime, not
  Node.js. `package.json` declares Node.js `>=18`; the convex CLI needs Node.js
  20 or later (22 or later from convex 1.49).
- `@vllnt/convex-music/test` needs `convex-test`, `vitest`, `vite` and
  `@edge-runtime/vm`, with the Vitest config shown under Testing.

## Testing

Mount the component in your own `convex-test` suite with `register`. It also
mounts the `action-cache` and `rate-limiter` child components. Use the Vitest
settings `convex-test` recommends:

```ts
// vitest.config.mts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
});
```

```ts
// convex/music.test.ts
/// <reference types="vite/client" />
import { Music } from "@vllnt/convex-music";
import { register } from "@vllnt/convex-music/test";
import { convexTest } from "convex-test";
import { expect, test } from "vitest";

import { api, components } from "./_generated/api";
import schema from "./schema";

test("searchArtists finds an artist in the catalog", async () => {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  register(t);
  const music = new Music(components.music);
  await t.mutation(async (ctx) => {
    await music.upsertArtist(ctx, {
      provider: "spotify",
      externalId: "4tZwfgrHOc3mvqYlEYSvVi",
      value: { name: "Daft Punk", genres: ["french house"] },
    });
  });
  const artists = await t.query(api.music.searchArtists, {
    query: "Daft",
    limit: 10,
  });
  expect(artists).toMatchObject([{ name: "Daft Punk" }]);
});
```

`register(t, name)` takes the mount name when you used
`app.use(music, { name })`. Provider calls need network access and
credentials, so test them in your own deployment, not in `convex-test`.

This repository's own tests use `convex-test` with stubbed provider responses
(`pnpm test:coverage`, 100% coverage enforced).

## Security

- The component does not authenticate. The host must authorize every call
  before it reaches `components.music`.
- `configure` stores provider secrets in the component's `providerConfig`
  table; only the component's token actions read them. Keep `configure` in an
  internal or admin-only function, and never return secrets to clients.
- Provider tokens are cached in the `action-cache` child component. Catalog
  rows hold only provider facts.

Report vulnerabilities as described in
[SECURITY.md](https://github.com/vllnt/convex-music/blob/main/SECURITY.md).

## Related packages

- [`@convex-dev/action-cache`](https://www.convex.dev/components/action-cache): mounted as a child component; caches the Spotify token and the signed Apple Music token.
- [`@convex-dev/rate-limiter`](https://www.convex.dev/components/rate-limiter): mounted as a child component; holds the hourly auto-import and refresh budgets.

## Contributing

See
[CONTRIBUTING.md](https://github.com/vllnt/convex-music/blob/main/CONTRIBUTING.md).

## Links

- Docs and changelog: [oss.vllnt.com/packages/convex-music](https://oss.vllnt.com/packages/convex-music) · [release feed](https://oss.vllnt.com/packages/convex-music/rss.xml)
- All @vllnt packages: [oss.vllnt.com](https://oss.vllnt.com) · [search packages and docs on index.vllnt.com](https://index.vllnt.com)
- Source and issues: [GitHub](https://github.com/vllnt/convex-music) · [issues](https://github.com/vllnt/convex-music/issues) · [npm](https://www.npmjs.com/package/@vllnt/convex-music)
- Questions and updates: [Discord](https://bntvllnt.com/discord) · [X @bntvllnt](https://x.com/bntvllnt)
- Company and author: [vllnt.com](https://vllnt.com) · [bntvllnt.com](https://bntvllnt.com) · [GitHub @bntvllnt](https://github.com/bntvllnt) · [LinkedIn](https://linkedin.com/in/bntvllnt)
- Sponsor: [GitHub Sponsors](https://github.com/sponsors/bntvllnt)

## License

MIT. See [LICENSE](LICENSE).

---

Part of [vllnt open source](https://oss.vllnt.com) · [Package page](https://oss.vllnt.com/packages/convex-music) · [vllnt.com](https://vllnt.com) · Built by [bntvllnt](https://bntvllnt.com)
