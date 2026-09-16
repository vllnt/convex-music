<!-- Badges -->

[![Convex Component](https://img.shields.io/badge/convex-component-EE342F.svg)](https://convex.dev/components)
[![npm](https://img.shields.io/npm/v/@vllnt/convex-music.svg)](https://www.npmjs.com/package/@vllnt/convex-music)
[![CI](https://github.com/vllnt/convex-music/actions/workflows/ci.yml/badge.svg)](https://github.com/vllnt/convex-music/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@vllnt/convex-music.svg)](LICENSE)

# @vllnt/convex-music

A provider-neutral, cached music catalog for Convex apps — look up tracks,
artists, and albums from Spotify, Apple Music, and more through one typed API,
with results cached in the component's own sandboxed tables.

```ts
const music = new Music(components.music);

// Cache a provider's normalized facts for an entity (TTL-bounded)…
await music.put(ctx, {
  kind: "track",
  provider: "spotify",
  externalId: id,
  isrc,
  value,
});
// …then read it back fast on the next request.
const hit = await music.get(ctx, {
  kind: "track",
  provider: "spotify",
  externalId: id,
});
```

## Features

- One typed API across providers — Spotify and Apple Music today; Deezer,
  MusicBrainz, and Wikidata as drop-in adapters.
- Sandboxed cache tables with a per-entry TTL — dedupe provider calls and ease
  rate limits.
- Tracks, artists, and albums, cached by opaque provider id and cross-referenced
  by ISRC.
- `getByIsrc` resolves the same recording across every provider you've cached.
- `pruneExpired` deletes an indexed 100-row batch and reschedules full batches
  until the backlog drains.
- Owns a durable music catalog (artists / tracks / playlists / albums) populated
  from providers and read via API; your app keeps gameplay + editorial,
  referencing catalog rows by id / ISRC.
- In-component import / sync / repair lifecycle and opt-in auto-import.
- Provider fetch/search actions (`fetchArtist`, `fetchTrack`, `search`,
  `resolveByIsrc`), distinct from reactive catalog reads (`getArtist`,
  `getTrack`, `getAlbum`).
- Field-source projection queries for provider provenance; see the current
  [catalog query surface](src/component/catalog/queries.ts).
- `[planned]` Multiple catalogs per mount — one `app.use` holds many catalogs
  (e.g. artists, tracks), each with its own providers + field-source policy; a
  default catalog keeps single use zero-config. Named mounts remain available
  for hard isolation.
- Pluggable providers — add a provider as one adapter (its raw schema + a mapper
  to the internal normalized schema) registered in the registry; no core
  changes.
- `[planned]` Artist-image auto-sync with a configurable provider-selection
  policy.

## Installation

```bash
npm install @vllnt/convex-music
```

Current `main`/canary requires `convex@^1.45.0`. npm `latest` remains `0.1.0`;
this README describes current source, not a promise that every API exists in
that stable release. Use `npm install @vllnt/convex-music@canary` to follow the
current implementation.

### Provider credentials

The host reads
[Convex environment variables](https://docs.convex.dev/production/environment-variables)
and passes them to `music.configure(ctx, provider, secrets)` from a trusted
mutation. The component cannot read the host's environment: **it persists these
secrets in its sandboxed `providerConfig` table** and caches provider tokens
internally.

| Provider    | Variables                                                          |
| ----------- | ------------------------------------------------------------------ |
| Spotify     | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`                       |
| Apple Music | `APPLE_MUSIC_ISSUER`, `APPLE_MUSIC_KID`, `APPLE_MUSIC_PRIVATE_KEY` |

Pass `{ clientId, clientSecret }` for Spotify or
`{ issuer, keyId, privateKeyPem }` for Apple. Keep setup internal or
admin-authorized; never return secrets to browser clients or log them. Calling
`configure` again replaces that provider's stored secrets.

## Usage

Mount the component in your app's `convex.config.ts`:

```ts
import { defineApp } from "convex/server";
import music from "@vllnt/convex-music/convex.config";

const app = defineApp();
app.use(music);
export default app;
```

Run `npx convex dev` to generate the component references. For separate catalogs
today, use named mounts such as `app.use(music, { name: "primaryMusic" })` and
`app.use(music, { name: "secondaryMusic" })`, with clients constructed from
`components.primaryMusic` and `components.secondaryMusic`. Each mount has its
own data and provider configuration; runtime multi-catalog APIs remain planned.

Then use the client from your own queries and mutations. The host owns auth —
gate the write methods behind your own authorized functions. Store only
app-specific domain data in your own tables:

```ts
import { v } from "convex/values";
import { Music } from "@vllnt/convex-music";
import { components } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const music = new Music(components.music);
const trackValue = v.object({
  title: v.string(),
  artists: v.array(
    v.object({ name: v.string(), externalId: v.optional(v.string()) }),
  ),
});

export const cacheTrack = internalMutation({
  args: { externalId: v.string(), isrc: v.string(), value: trackValue },
  returns: v.string(),
  handler: (ctx, args) =>
    music.put(ctx, {
      kind: "track",
      provider: "spotify",
      externalId: args.externalId,
      isrc: args.isrc,
      value: args.value,
      ttlMs: 1000 * 60 * 60 * 24, // refresh daily
    }),
});
```

## API Reference

| Method                                                                        | Kind     | Description                                                                                     |
| ----------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `put(ctx, input)`                                                             | mutation | Cache (insert or refresh) one provider's facts; returns the entry id.                           |
| `get(ctx, key)`                                                               | query    | Fetch one cached entry, or `null` if missing or expired.                                        |
| `getByIsrc(ctx, isrc)`                                                        | query    | Every fresh cached track for an ISRC, across providers.                                         |
| `invalidate(ctx, key)`                                                        | mutation | Drop one cached entry; returns whether a row was deleted.                                       |
| `pruneExpired(ctx)`                                                           | mutation | Delete one bounded expired-entry batch, rescheduling until drained; returns this batch's count. |
| `stats(ctx)`                                                                  | query    | Maintained count of cached entries (no table scan).                                             |
| `getArtist` / `getTrack` / `getPlaylist` / `getAlbum(ctx, id)`                | query    | Read a durable catalog entity.                                                                  |
| `searchArtists` / `searchTracks(ctx, query, limit?)`                          | query    | Search the local catalog.                                                                       |
| `fetchArtist` / `fetchTrack(ctx, input)`                                      | action   | Read-through provider fetch and catalog promotion.                                              |
| `search(ctx, input)`                                                          | action   | Provider discovery without catalog promotion.                                                   |
| `importArtist` / `importTrack` / `importPlaylist` / `importAlbum(ctx, input)` | action   | Import traversal with request status.                                                           |
| `configure(ctx, provider, secrets)`                                           | mutation | Persist provider credentials (trusted setup only).                                              |

Full reference — signatures, value shapes, and error codes:
[`docs/API.md`](docs/API.md).

## React

Available on current `main`/canary in the `./react` entry, over the implemented
catalog queries. All hooks return `undefined` while loading, in addition to the
results below.

Optional, tree-shakeable hooks over `convex/react`. The host re-exports its own
catalog query refs and passes them in — the component never owns the host's
`api`. `react` is an optional peer dependency; `convex/react` comes from the
required `convex` peer.

```tsx
import { useArtist, useSearchTracks } from "@vllnt/convex-music/react";
import { api } from "../convex/_generated/api"; // your wrappers re-exporting the component queries

const artist = useArtist(api.music.getArtist, artistId);
const tracks = useSearchTracks(api.music.searchTracks, query, 20);
```

| Hook                                          | Returns                 | Description                                            |
| --------------------------------------------- | ----------------------- | ------------------------------------------------------ |
| `useArtist(ref, id)`                          | `CatalogArtist \| null` | Reactively read one unified artist by id.              |
| `useTrack(ref, id)`                           | `CatalogTrack \| null`  | Reactively read one unified track by id.               |
| `useArtistImage(ref, provider, id, policy?)`  | `string \| null`        | Project an artist image per a field-source policy.     |
| `useTrackPreview(ref, provider, id, policy?)` | `string \| null`        | Project a track preview URL per a field-source policy. |
| `useSearchArtists(ref, query, limit?)`        | `CatalogArtist[]`       | Reactively search artists by name.                     |
| `useSearchTracks(ref, query, limit?)`         | `CatalogTrack[]`        | Reactively search tracks by title.                     |

## Security

- Catalog facts and provider credentials are stored separately in sandboxed
  component tables.
- `configure` persists provider secrets in `providerConfig`; internal token
  actions read them. Do not expose credential setup, stored secrets, or cached
  tokens to browser clients.
- The host gates every write method behind its own authorized functions.

See [`SECURITY.md`](SECURITY.md) for vulnerability reporting.

## Testing

```bash
pnpm test            # vitest + convex-test + @edge-runtime/vm
pnpm test:coverage   # 100% coverage gate
```

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Issues and pull requests welcome.

## Author

Built by [bntvllnt](https://github.com/bntvllnt) ·
[bntvllnt.com](https://bntvllnt.com) · [X @bntvllnt](https://x.com/bntvllnt)

Part of the [@vllnt](https://github.com/vllnt) Convex component fleet —
[vllnt.com](https://vllnt.com)

If this is useful, [sponsor the work](https://github.com/sponsors/bntvllnt).

## License

MIT — see [LICENSE](LICENSE).
