<!-- Badges -->

[![Convex Component](https://img.shields.io/badge/convex-component-EE342F.svg)](https://convex.dev/components)
[![npm](https://img.shields.io/npm/v/@vllnt/convex-music.svg)](https://www.npmjs.com/package/@vllnt/convex-music)
[![CI](https://github.com/vllnt/convex-music/actions/workflows/ci.yml/badge.svg)](https://github.com/vllnt/convex-music/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@vllnt/convex-music.svg)](LICENSE)

# @vllnt/convex-music

A provider-neutral, cached music catalog for Convex apps — look up tracks, artists, and albums
from Spotify, Apple Music, and more through one typed API, with results cached in the component's
own sandboxed tables.

```ts
const music = new Music(components.music);

// Cache a provider's normalized facts for an entity (TTL-bounded)…
await music.put(ctx, { kind: "track", provider: "spotify", externalId: id, isrc, value });
// …then read it back fast on the next request.
const hit = await music.get(ctx, { kind: "track", provider: "spotify", externalId: id });
```

## Features

- One typed API across providers — Spotify and Apple Music today; Deezer, MusicBrainz, and
  Wikidata as drop-in adapters.
- Sandboxed cache tables with a per-entry TTL — dedupe provider calls and ease rate limits.
- Tracks, artists, and albums, cached by opaque provider id and cross-referenced by ISRC.
- `getByIsrc` resolves the same recording across every provider you've cached.
- `pruneExpired` is an idempotent sweep, safe to run on a schedule.
- Stores only public catalog facts — no secrets or credentials.
- `[planned]` Owns a durable music catalog (artists / tracks / playlists) populated from providers
  and read via API; your app keeps gameplay + editorial, referencing catalog rows by id / ISRC.
- `[planned]` In-component import / sync / repair engine, driven by mount policy.
- `[planned]` Provider fetch/search adapters (`search`, `getTrack` / `getArtist` / `getAlbum`).
- `[planned]` Field-source policy — configure what comes back from search + catalog reads: which
  entity kinds, which fields, and — for **every field independently** — which provider(s) supply it:
  one, an ordered pick, an explicit subset (e.g. 3 of 4 preview URLs), or all. Multi-select returns a
  provider-keyed map, so adding providers never changes a field's type. Default at mount, override per call.
- `[planned]` Multiple catalogs per mount — one `app.use` holds many catalogs (e.g. artists, tracks),
  each with its own providers + field-source policy; a default catalog keeps single use zero-config.
  Named mounts remain available for hard isolation.
- `[planned]` Pluggable providers — add a provider as one adapter (its raw schema + a mapper to the
  internal normalized schema) registered in the registry; no core changes.
- `[planned]` Artist-image auto-sync with a configurable provider-selection policy.

## Installation

```bash
npm install @vllnt/convex-music
```

Requires `convex@^1.41.0` as a peer dependency.

### Environment variables `[planned]`

Provider credentials are supplied as [Convex environment variables](https://docs.convex.dev/production/environment-variables) on your deployment (used once the provider adapters ship):

| Provider | Variables |
| --- | --- |
| Spotify | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` |
| Apple Music | `APPLE_MUSIC_ISSUER`, `APPLE_MUSIC_KID`, `APPLE_MUSIC_PRIVATE_KEY` |

Which providers are enabled (and their preference order) is set in the mount policy, not via env flags.

## Usage

Mount the component in your app's `convex.config.ts`:

```ts
import { defineApp } from "convex/server";
import music from "@vllnt/convex-music/convex.config";

const app = defineApp();
app.use(music);
export default app;
```

Then use the client from your own queries and mutations. The host owns auth — gate the write
methods behind your own authorized functions, and persist results into your own domain tables:

```ts
import { Music } from "@vllnt/convex-music";
import { components } from "./_generated/api";

const music = new Music(components.music);

export const cacheTrack = internalMutation({
  args: { externalId: v.string(), isrc: v.string(), value: trackValue },
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

| Method | Kind | Description |
| --- | --- | --- |
| `put(ctx, input)` | mutation | Cache (insert or refresh) one provider's facts; returns the entry id. |
| `get(ctx, key)` | query | Fetch one cached entry, or `null` if missing or expired. |
| `getByIsrc(ctx, isrc)` | query | Every fresh cached track for an ISRC, across providers. |
| `invalidate(ctx, key)` | mutation | Drop one cached entry; returns whether a row was deleted. |
| `pruneExpired(ctx)` | mutation | Delete every expired entry; returns the count removed. |
| `stats(ctx)` | query | Count of cached entries. |

Full reference — signatures, value shapes, and error codes: [`docs/API.md`](docs/API.md).

## React [planned]

> Shipped in the `./react` entry; wraps the **planned** catalog query surface (not in 0.1.0).

Optional, tree-shakeable hooks over `convex/react`. The host re-exports its own catalog query
refs and passes them in — the component never owns the host's `api`. `react` + `convex/react`
are optional peer deps, so a backend-only consumer pulls in zero React.

```tsx
import { useArtist, useSearchTracks } from "@vllnt/convex-music/react";
import { api } from "../convex/_generated/api"; // your wrappers re-exporting the component queries

const artist = useArtist(api.music.getArtist, artistId);
const tracks = useSearchTracks(api.music.searchTracks, query, 20);
```

| Hook | Returns | Description |
| --- | --- | --- |
| `useArtist(ref, id)` | `CatalogArtist \| null` | Reactively read one unified artist by id. |
| `useTrack(ref, id)` | `CatalogTrack \| null` | Reactively read one unified track by id. |
| `useArtistImage(ref, provider, id, policy?)` | `string \| null` | Project an artist image per a field-source policy. |
| `useTrackPreview(ref, provider, id, policy?)` | `string \| null` | Project a track preview URL per a field-source policy. |
| `useSearchArtists(ref, query, limit?)` | `CatalogArtist[]` | Reactively search artists by name. |
| `useSearchTracks(ref, query, limit?)` | `CatalogTrack[]` | Reactively search tracks by title. |

## Security

- The component caches only public catalog facts — no secrets or credentials are stored.
- Provider credentials live in the host's environment; they never reach the client.
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

Built by [bntvllnt](https://github.com/bntvllnt) · [bntvllnt.com](https://bntvllnt.com) · [X @bntvllnt](https://x.com/bntvllnt)

Part of the [@vllnt](https://github.com/vllnt) Convex component fleet — [vllnt.com](https://vllnt.com)

If this is useful, [sponsor the work](https://github.com/sponsors/bntvllnt).

## License

MIT — see [LICENSE](LICENSE).
